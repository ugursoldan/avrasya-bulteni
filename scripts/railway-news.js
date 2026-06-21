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

// --- DeepSeek ile özet çıkarma ---
async function callDeepSeek(prompt) {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: 'Sen bir haber özetleyicisin. Verilen haberi 200-300 kelimeyle Türkçe özetle. ' +
                 'Özet bilgilendirici ve akıcı olmalı. Sadece özet metnini yaz, açıklama ekleme.'
      },
      { role: 'user', content: `Aşağıdaki haberi 200-300 kelimeyle Türkçe özetle:\n\n${prompt}` }
    ],
    temperature: 0.7,
    max_tokens: 1000,
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
      const summary = await callDeepSeek(text.substring(0, 3000));
      const db2 = new Database(DB_PATH);
      db2.prepare('UPDATE contents SET summary = ?, ai_summarized = 1 WHERE id = ?').run(summary, row.id);
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
