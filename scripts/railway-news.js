#!/usr/bin/env node
/**
 * Avrasya Bülteni - Railway Cron Job
 * Günde 2 kez (08:00, 20:00 UTC) çalışır:
 * 1. RSS taraması (scanner.js) ile gerçek haberleri toplar
 * 2. DeepSeek ile yeni haberlerin özetini çıkarır
 * 
 * Railway'in cron trigger'ı ile tetiklenir.
 * Env: DEEPSEEK_API_KEY, DB_PATH
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// --- Yapılandırma ---
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'data', 'avrasya.db');
const API_KEY = process.env.DEEPSEEK_API_KEY;
if (!API_KEY) {
  console.error('HATA: DEEPSEEK_API_KEY env değişkeni bulunamadı');
  process.exit(1);
}

// --- Scanner'ı çalıştır (RSS taraması) ---
async function runScanner() {
  console.log('🔍 RSS taraması başlatılıyor...');
  try {
    const scanner = require('./scanner');
    await scanner.runScan();
    console.log('✅ RSS taraması tamamlandı');
  } catch (e) {
    console.error('❌ RSS taraması hatası:', e.message);
  }
}

// --- DeepSeek ile özet + başlık çevirisi ---
async function callDeepSeek(title, text) {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  const prompt = `Aşağıdaki haberi Türkçeye çevir ve 200-300 kelimeyle Türkçe özet çıkar.

Orijinal başlık: ${title}
Haber metni: ${text}

Yanıt formatı (sadece JSON):
{
  "title_tr": "Türkçe başlık",
  "summary": "200-300 kelime Türkçe özet"
}`;
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: 'Sen bir haber çevirmeni ve özetleyicisin. Verilen haberi Türkçeye çevir ve 200-300 kelimeyle Türkçe özetle. Sadece JSON formatında yanıt ver.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  });

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body,
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`DeepSeek API hatası (${resp.status}): ${errBody}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content.trim();
}

// --- Özet çıkarılmamış haberleri bul ---
async function summarizeUnsummarized() {
  console.log('📝 Özet çıkarılmamış haberler taranıyor...');
  
  const db = new Database(DB_PATH);
  
  // ai_summarized=0 ve full_text dolu olan haberleri bul
  const rows = db.prepare(
    `SELECT id, title, full_text FROM contents WHERE ai_summarized = 0 AND full_text != '' ORDER BY created_at DESC LIMIT 20`
  ).all();
  
  db.close();
  
  if (rows.length === 0) {
    console.log('  Özet çıkarılacak haber bulunamadı');
    return 0;
  }
  
  console.log(`  ${rows.length} haber bulundu, özet çıkarılıyor...`);
  let summarized = 0;
  
  for (const row of rows) {
    const text = row.full_text;
    if (!text || text.length < 50) {
      // Kısa metinleri özetleme, ai_summarized=1 yap
      const db2 = new Database(DB_PATH);
      db2.prepare('UPDATE contents SET ai_summarized = 1 WHERE id = ?').run(row.id);
      db2.close();
      continue;
    }
    
    try {
      console.log(`  Özet: ${row.title.substring(0, 50)}...`);
      const result = await callDeepSeek(row.title, text.substring(0, 3000));
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch {
        // fallback: JSON değilse direkt summary olarak kullan
        const db2 = new Database(DB_PATH);
        db2.prepare('UPDATE contents SET summary = ?, ai_summarized = 1 WHERE id = ?').run(result, row.id);
        db2.close();
        summarized++;
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      const newTitle = parsed.title_tr || row.title;
      const newSummary = parsed.summary || result;
      const db2 = new Database(DB_PATH);
      db2.prepare('UPDATE contents SET title = ?, summary = ?, ai_summarized = 1 WHERE id = ?').run(newTitle, newSummary, row.id);
      db2.close();
      summarized++;
      await new Promise(r => setTimeout(r, 1000)); // rate limit
    } catch (e) {
      console.error(`  HATA: ${row.title.substring(0, 50)}... - ${e.message}`);
    }
  }
  
  console.log(`  ✅ ${summarized}/${rows.length} haber özetlendi`);
  return summarized;
}

// --- Ana işlem ---
async function main() {
  console.log(`=== Avrasya Bülteni - Cron (${new Date().toISOString()}) ===`);
  console.log(`DB: ${DB_PATH}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`HATA: DB dosyası bulunamadı: ${DB_PATH}`);
    process.exit(1);
  }

  // 1. RSS taraması
  await runScanner();

  // 2. Özet çıkarma
  await summarizeUnsummarized();

  console.log(`\n${'='.repeat(50)}`);
  console.log('✅ Cron job tamamlandı');
}

main().catch(e => {
  console.error('Kritik hata:', e);
  process.exit(1);
});
