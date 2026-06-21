#!/usr/bin/env node
/**
 * Avrasya Bülteni - Railway Cron Job
 * Günde 2 kez (08:00, 20:00 UTC) 5 dilde haber üretir.
 * Railway'in cron trigger'ı ile tetiklenir.
 * 
 * Çalıştırma: node scripts/railway-news.js
 * Env: DEEPSEEK_API_KEY, DB_PATH (opsiyonel, varsayılan: ./avrasya.db)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// --- Yapılandırma ---
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'avrasya.db');
const API_KEY = process.env.DEEPSEEK_API_KEY;

if (!API_KEY) {
  console.error('HATA: DEEPSEEK_API_KEY env değişkeni bulunamadı');
  process.exit(1);
}

const LANGUAGES = [
  { code: 'ru', name: 'Rusça', source: 'Rusya Haber Ajansları', topic: 'Rusya, Kafkasya, Orta Asya, Ukrayna' },
  { code: 'fa', name: 'Farsça', source: 'İran Haber Ajansları', topic: 'İran, Afganistan, Tacikistan, Orta Doğu' },
  { code: 'zh', name: 'Çince', source: 'Çin Haber Ajansları', topic: 'Çin, Tayvan, Şanghay İşbirliği Örgütü, Orta Asya, Kuşak ve Yol' },
  { code: 'tr', name: 'Türkçe', source: 'Türk Haber Ajansları', topic: 'Türkiye, Kafkaslar, Orta Asya, Balkanlar, Türk Devletleri Teşkilatı' },
  { code: 'en', name: 'İngilizce', source: 'Uluslararası Haber Ajansları', topic: 'Eurasia, Russia, China, Central Asia, Caucasus, SCO, BRICS' },
];

// --- Slugify ---
function slugify(text) {
  const map = { 'ş': 's', 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ü': 'u',
                'Ş': 's', 'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'Ö': 'o', 'Ü': 'u' };
  let s = text.toLowerCase().trim();
  for (const [k, v] of Object.entries(map)) s = s.replaceAll(k, v);
  s = s.replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '');
  return s.substring(0, 200);
}

// --- DeepSeek API ---
async function callDeepSeek(prompt) {
  const url = 'https://api.deepseek.com/v1/chat/completions';
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: 'Sen bir Avrasya haber editörüsün. Güncel, gerçekçi ve doğru haber metinleri üretiyorsun. ' +
                 'Tüm çıktın TAMAMEN TÜRKÇE olmalıdır. Her haberin başlığı ve özeti Türkçedir. ' +
                 'Her haber için JSON formatında şu alanları döndür:\n' +
                 '{\n  "haberler": [\n    { ' +
                 '"title": "Türkçe başlık (kısa, en fazla 12 kelime)", ' +
                 '"summary": "200-300 kelimelik Türkçe özet" }\n  ]\n}\n' +
                 'Her zaman 3 adet haber üret. Başlıklarda gereksiz boşluk veya satır sonu olmamalı.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 4000,
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
  return data.choices[0].message.content;
}

// --- JSON çıkarıcı ---
function extractJson(text) {
  let m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) text = m[1].trim();

  m = text.match(/\{\s*"haberler"\s*:/);
  if (m) {
    let jsonStart = m.index;
    let depth = 0;
    for (let i = jsonStart; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          text = text.substring(jsonStart, i + 1);
          break;
        }
      }
    }
  }

  return JSON.parse(text);
}

// --- Temizlik fonksiyonu ---
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

// --- Ana işlem ---
async function generateForLanguage(lang) {
  console.log(`\n--- ${lang.name} (${lang.code}) ---`);

  const today = new Date().toISOString().split('T')[0];
  const prompt = 
    `${lang.name} dilindeki kaynakları kullanarak Avrasya bölgesiyle ilgili ` +
    `3 adet GÜNCEL haber veya analiz üret. Odaklanılacak konular: ${lang.topic}.\n\n` +
    `BUGÜNÜN TARİHİ: ${today}. Bu tarihe yakın, güncel konular seç. ` +
    `Daha önce üretilmiş haberleri TEKRAR ÜRETME.\n\n` +
    `Haberler gerçekçi, güncel konulara dayalı ve Avrasya coğrafyasıyla ilgili olmalı. ` +
    `Kaynak olarak ${lang.name} haber ajanslarını referans al.\n\n` +
    `ÖNEMLİ: Başlıklar ve özetler TAMAMEN TÜRKÇE olmalıdır. ` +
    `Her haber için kısa Türkçe başlık (maksimum 12 kelime) ve 200-300 kelimelik Türkçe özet yaz. ` +
    `Başlıkta ve özette gereksiz boşluk veya satır sonu olmamalı.`;

  console.log(`  DeepSeek API çağrılıyor...`);
  const response = await callDeepSeek(prompt);
  const data = extractJson(response);
  const articles = data.haberler || [];

  if (articles.length === 0) {
    console.log(`  ⚠️ Hiç haber üretilemedi`);
    return { lang: lang.name, ok: false, count: 0 };
  }

  console.log(`  ${articles.length} haber alındı, DB'ye kaydediliyor...`);

  const db = new Database(DB_PATH);
  let added = 0;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  for (const article of articles) {
    const title = cleanText(article.title || '');
    const summary = cleanText(article.summary || '');
    if (!title || !summary) continue;

    const slug = slugify(title);
    const sourceUrl = `https://avrasya-bulteni-production.up.railway.app/haber/${slug}`;

    try {
      const stmt = db.prepare(`INSERT INTO contents 
        (title, slug, type, summary, full_text, source_name, source_url, lang, ai_summarized, published_at, created_at) 
        VALUES (?, ?, 'haber', ?, '', ?, ?, ?, 1, ?, ?)`);
      stmt.run(title, slug, summary, lang.source, sourceUrl, lang.code, today, now);
      added++;
      console.log(`  + ${title.substring(0, 60)}...`);
    } catch (e) {
      console.error(`  HATA: ${e.message}`);
    }
  }

  db.close();
  console.log(`  ✅ ${lang.name}: ${added}/${articles.length} haber eklendi`);
  return { lang: lang.name, ok: added > 0, count: added };
}

async function main() {
  console.log(`=== Avrasya Bülteni - Railway Cron (${new Date().toISOString()}) ===`);
  console.log(`DB: ${DB_PATH}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`HATA: DB dosyası bulunamadı: ${DB_PATH}`);
    process.exit(1);
  }

  const results = [];
  for (const lang of LANGUAGES) {
    try {
      const r = await generateForLanguage(lang);
      results.push(r);
    } catch (e) {
      console.error(`❌ ${lang.name}: ${e.message}`);
      results.push({ lang: lang.name, ok: false, count: 0 });
    }
  }

  const success = results.filter(r => r.ok).length;
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Toplam: ${success}/${results.length} dil başarılı`);
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.lang} (${r.count} haber)`);
  }

  if (success === 0) process.exit(1);
}

main().catch(e => {
  console.error('Kritik hata:', e);
  process.exit(1);
});
