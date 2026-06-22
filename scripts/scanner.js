#!/usr/bin/env node
/**
 * Avrasya Bülteni — Scanner v3
 * 
 * Kaynak: https://raw.githubusercontent.com/ugursoldan/avrasya-bulteni/main/data/haberler.json
 * 
 * GitHub JSON'daki haberleri alır, Türkçe olmayanları DeepSeek ile
 * Türkçe'ye çevirir, Express sunucunun DB'sine (./db/data/avrasya.db)
 * insert eder.
 * 
 * Kullanım: SCAN_MAX_ITEMS=5 node scripts/scanner.js
 * 
 * Env:
 *   SCAN_MAX_ITEMS    — Eklenecek maks haber sayısı (default: sınırsız)
 *   AVRASYA_DIR       — Proje kök dizini (default: scriptin 2 üstü)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ─── Konfigürasyon ────────────────────────────────────────────────────────────

const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/ugursoldan/avrasya-bulteni/main/data/haberler.json';
const MAX_ITEMS = parseInt(process.env.SCAN_MAX_ITEMS, 10) || Infinity;
const AVRASYA_DIR = process.env.AVRASYA_DIR || path.resolve(__dirname, '..');
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

const DB_PATH = path.join(AVRASYA_DIR, 'db', 'data', 'avrasya.db');

// Çeviri yapılacak diller (Türkçe dışındakiler)
const TRANSLATE_LANGS = new Set(['en', 'ru', 'zh']);

// Dil adları
const LANG_NAMES = { en: 'İngilizce', ru: 'Rusça', zh: 'Çince', fa: 'Farsça', tr: 'Türkçe' };

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

/** 
* RFC1123 tarih formatını YYYY-MM-DD'ye çevir
* Örn: "Mon, 22 Jun 2026 11:00:00 +0400" → "2026-06-22"
*/
function normalizeDate(dateStr) {
if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
// Zaten YYYY-MM-DD formatındaysa olduğu gibi döndür
if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.substring(0, 10);
// RFC1123 / benzeri formatları dene
try {
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().substring(0, 10);
  }
} catch (_) {}
return dateStr;
}

function fetchJSON(urlStr) {
  return new Promise((resolve, reject) => {
    const http = urlStr.startsWith('https') ? require('https') : require('http');
    http.get(urlStr, { headers: { 'User-Agent': 'AvrasyaScanner/3.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 200) || 'baslik-' + Date.now();
}

/**
 * DeepSeek API ile metni Türkçe'ye çevir
 */
async function translateToTurkish(text, langCode) {
  if (!text || text.length < 10) return text;
  if (langCode === 'tr') return text;
  if (!DEEPSEEK_API_KEY) {
    console.warn(`  UYARI: DEEPSEEK_API_KEY yok, ${LANG_NAMES[langCode] || langCode} metin çevrilemedi`);
    return text;
  }

  const langName = LANG_NAMES[langCode] || langCode;
  
  try {
    const https = require('https');
    const payload = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: `Sen bir tercümansın. ${langName} metinleri Türkçe'ye çeviriyorsun. Sadece çeviriyi yaz, açıklama ekleme.` },
        { role: 'user', content: `Aşağıdaki ${langName} metni Türkçe'ye çevir. Sadece çeviriyi yaz:\n\n${text.substring(0, 2000)}` }
      ],
      temperature: 0.3,
      max_tokens: 1024
    });

    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.deepseek.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`Parse: ${e.message}`)); }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    if (result.error) {
      console.warn(`  UYARI: DeepSeek hatası (${langName}): ${result.error.message}`);
      return text;
    }

    const translated = result.choices?.[0]?.message?.content?.trim();
    return translated || text;
  } catch (err) {
    console.warn(`  UYARI: DeepSeek istek hatası (${langName}): ${err.message}`);
    return text;
  }
}

/**
 * Bekleme — rate limit için
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Ana İşlem ─────────────────────────────────────────────────────────────────

async function main() {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] Scanner v3 başladı`);
  console.log(`  Kaynak: ${GITHUB_JSON_URL}`);
  console.log(`  DB: ${DB_PATH}`);
  console.log(`  MAX_ITEMS: ${MAX_ITEMS === Infinity ? 'sınırsız' : MAX_ITEMS}`);
  console.log(`  DeepSeek: ${DEEPSEEK_API_KEY ? '✅ var' : '❌ yok'}`);

  // 1. GitHub'dan JSON'ı çek
  let rawData;
  try {
    rawData = await fetchJSON(GITHUB_JSON_URL);
  } catch (err) {
    console.error(`HATA: GitHub JSON çekilemedi: ${err.message}`);
    process.exit(1);
  }

  if (!rawData || typeof rawData !== 'object') {
    console.log('Uyarı: JSON boş veya geçersiz');
    process.exit(0);
  }

  // JSON'daki tüm haberleri düzleştir
  let flatList = [];
  let langCount = 0;
  if (rawData.diller) {
    for (const [langCode, langData] of Object.entries(rawData.diller)) {
      if (langData && Array.isArray(langData.haberler)) {
        for (const h of langData.haberler) {
          flatList.push({
            title: h.baslik || h.title || '',
            summary: h.ozet || h.summary || h.description || '',
            source_url: h.url || h.source_url || '',
            image_url: h.image || h.image_url || '',
            published_at: normalizeDate(h.yayin_tarihi || h.published_at || h.publishedAt || h.date || ''),
            slug: h.slug || '',
            type: 'haber',
            lang: langCode
          });
        }
        langCount++;
      }
    }
  } else if (Array.isArray(rawData)) {
    flatList = rawData;
  }

  if (flatList.length === 0) {
    console.log('Uyarı: Hiç haber bulunamadı');
    process.exit(0);
  }
  console.log(`  GitHub'dan ${flatList.length} haber alındı (${langCount} dil)`);
  
  // Dil bazlı istatistik
  const langStats = {};
  for (const h of flatList) {
    langStats[h.lang] = (langStats[h.lang] || 0) + 1;
  }
  for (const [l, c] of Object.entries(langStats)) {
    console.log(`    ${LANG_NAMES[l] || l}: ${c} haber`);
  }

  // 2. DB'ye bağlan
  let db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
  } catch (err) {
    console.error(`HATA: DB açılamadı (${DB_PATH}): ${err.message}`);
    process.exit(1);
  }

  // 3. Mevcut source_url'leri al (tekrar önleme)
  const existingUrls = new Set();
  try {
    const rows = db.prepare("SELECT source_url FROM contents WHERE source_url IS NOT NULL AND source_url != ?").all('');
    for (const r of rows) {
      if (r.source_url) existingUrls.add(r.source_url);
    }
  } catch (err) {
    console.error(`HATA: Mevcut URL'ler alınamadı: ${err.message}`);
    db.close();
    process.exit(1);
  }
  console.log(`  DB'de ${existingUrls.size} mevcut kayıt`);

  // 4. Slug kontrolü
  const existingSlugs = new Set();
  try {
    const rows = db.prepare('SELECT slug FROM contents').all();
    for (const r of rows) existingSlugs.add(r.slug);
  } catch (_) { }

  // 5. Çeviri ile insert
  console.log('\n--- Çeviri aşaması ---');
  let inserted = 0;
  let skipped = 0;
  let translated = 0;

  const stmt = db.prepare(`
    INSERT INTO contents (title, slug, type, summary, source_url, image_url, published_at)
    VALUES (@title, @slug, @type, @summary, @sourceUrl, @imageUrl, @publishedAt)
  `);

  for (let i = 0; i < flatList.length; i++) {
    if (inserted >= MAX_ITEMS) {
      console.log(`  SCAN_MAX_ITEMS (${MAX_ITEMS}) sınırına ulaşıldı, durduruluyor`);
      break;
    }

    const h = flatList[i];
    const sourceUrl = (h.source_url || '').trim();

    // source_url varsa ve DB'de varsa atla
    if (sourceUrl && existingUrls.has(sourceUrl)) {
      skipped++;
      continue;
    }

    if (!sourceUrl) {
      skipped++;
      continue;
    }

    // Çeviri yapılacak mı?
    let title = (h.title || '').trim();
    let summary = (h.summary || h.description || '').trim();

    if (TRANSLATE_LANGS.has(h.lang) && DEEPSEEK_API_KEY) {
      process.stdout.write(`  [${i+1}/${flatList.length}] ${LANG_NAMES[h.lang] || h.lang}: "${title.substring(0, 40)}..." → çeviriliyor...`);
      const tTitle = await translateToTurkish(title, h.lang);
      await sleep(300);
      const tSummary = await translateToTurkish(summary, h.lang);
      await sleep(300);

      if (tTitle !== title || tSummary !== summary) {
        translated++;
        title = tTitle;
        summary = tSummary;
        process.stdout.write(' ✅\n');
      } else {
        process.stdout.write(' (değişmedi)\n');
      }
    }

    const imageUrl = (h.image_url || '').trim();
    const publishedAt = (h.published_at || '').trim();
    const type = 'haber';

    // Slug oluştur
    let slug = slugify(title || sourceUrl || `haber-${Date.now()}-${i}`);
    if (existingSlugs.has(slug)) {
      slug = slug + '-' + Date.now();
    }

    try {
      stmt.run({
        title: title || 'Başlıksız',
        slug: slug,
        type: type,
        summary: summary || '',
        sourceUrl: sourceUrl,
        imageUrl: imageUrl || '',
        publishedAt: publishedAt || null
      });
      existingUrls.add(sourceUrl);
      existingSlugs.add(slug);
      inserted++;
    } catch (err) {
      console.warn(`\n  [${i}] Insert hatası: ${err.message} — "${title.substring(0, 40)}"`);
      skipped++;
    }
  }

  db.close();
  console.log(`\n✅ ${inserted} eklendi (${translated} çevrildi), ${skipped} atlandı`);
}

main().catch(err => {
  console.error(`HATA: ${err.message}`);
  process.exit(1);
});
