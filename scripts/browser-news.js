#!/usr/bin/env node
/**
 * Avrasya Bülteni — Browser News Collector v1
 * 
 * Google News'te 5 dilde Avrasya jeopolitiği taraması yapar,
 * bulduğu haberleri Express DB'sine (./db/data/avrasya.db) ekler.
 * 
 * Kullanım: node scripts/browser-news.js
 * Env: BROWSER_MAX_ITEMS=10 (default: 5'er dil = 25 haber)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MAX_ITEMS_PER_LANG = parseInt(process.env.BROWSER_MAX_ITEMS, 10) || 5;
const AVRASYA_DIR = process.env.AVRASYA_DIR || path.resolve(__dirname, '..');
const DB_PATH = path.join(AVRASYA_DIR, 'db', 'data', 'avrasya.db');

// ─── Dil yapılandırması ──────────────────────────────────────────────────────

const LANGUAGES = [
  {
    code: 'tr',
    name: 'Türkçe',
    query: 'Avrasya jeopolitik',
    gl: 'TR',
    hl: 'tr'
  },
  {
    code: 'en',
    name: 'English',
    query: 'Eurasia geopolitics Central Asia South Caucasus',
    gl: 'US',
    hl: 'en'
  },
  {
    code: 'ru',
    name: 'Русский',
    query: 'Евразия геополитика Центральная Азия',
    gl: 'RU',
    hl: 'ru'
  },
  {
    code: 'fa',
    name: 'فارسی',
    query: 'اوراسیا آسیای مرکزی ژئوپلیتیک',
    gl: 'IR',
    hl: 'fa'
  },
  {
    code: 'zh',
    name: '中文',
    query: '欧亚大陆 中亚 地缘政治',
    gl: 'CN',
    hl: 'zh-CN'
  }
];

const LANG_NAMES = {
  tr: 'Türkçe', en: 'English', ru: 'Русский',
  fa: 'فارسی', zh: '中文'
};

// ─── Tarama terimleri (her dilde birden çok sorgu) ──────────────────────────

const SEARCH_QUERIES = {
  tr: [
    'Avrasya jeopolitik',
    'Orta Asya haberleri',
    'Güney Kafkasya gelişmeleri',
    'Türk Devletleri Teşkilatı',
    'İpek Yolu ticaret koridoru',
    'Rusya Çin ilişkileri',
    'Şanghay İşbirliği Örgütü',
    'Hazar Denizi enerji',
    'Kafkasya barış süreci',
    'BRICS yeni üyeler'
  ],
  en: [
    'Eurasia geopolitics',
    'Central Asia news',
    'South Caucasus developments',
    'Organization of Turkic States',
    'Middle Corridor trade route',
    'Russia China relations',
    'Shanghai Cooperation Organization',
    'Caspian Sea energy',
    'Belt and Road Initiative',
    'BRICS new members'
  ],
  ru: [
    'Евразия геополитика',
    'Центральная Азия новости',
    'Южный Кавказ',
    'Шанхайская организация сотрудничества',
    'Россия Китай отношения',
    'Каспийское море энергетика',
    'Евразийский экономический союз',
    'Транскаспийский маршрут',
    'БРИКС новые члены',
    'Тюркский совет'
  ],
  fa: [
    'اوراسیا ژئوپلیتیک',
    'آسیای مرکزی',
    'قفقاز جنوبی',
    'راه ابریشم',
    'سازمان همکاری شانگهای',
    'روسیه چین',
    'اتحادیه اقتصادی اوراسیا',
    'دریای خزر انرژی',
    'بریکس اعضای جدید',
    'ترکستان'
  ],
  zh: [
    '欧亚大陆 地缘政治',
    '中亚 新闻',
    '南高加索',
    '一带一路',
    '上海合作组织',
    '俄中关系',
    '欧亚经济联盟',
    '里海 能源',
    '金砖国家 新成员',
    '突厥国家组织'
  ]
};

const CATEGORY_MAP = [
  { keywords: ['siyaset', 'siyasi', 'politika', 'political', 'политик', 'سیاسی', 'حکومت', '政治', '外交', 'jeopolitik', 'geopolitik', 'geopolitics', 'стратегия'], id: 1 },
  { keywords: ['ekonomi', 'ticaret', 'ekonomik', 'trade', 'economy', 'economic', 'экономик', 'торгов', 'بازرگانی', 'اقتصاد', '经济', '贸易'], id: 2 },
  { keywords: ['enerji', 'petrol', 'doğalgaz', 'energy', 'pipeline', 'oil', 'gas', 'энерг', 'нефть', 'газ', 'انرژی', 'نفت', '能源', '石油', '天然气', 'boru hattı'], id: 3 },
  { keywords: ['kültür', 'sanat', 'culture', 'art', 'культур', 'فرهنگ', 'هنر', '文化'], id: 4 },
  { keywords: ['tarih', 'tarihi', 'history', 'historical', 'истори', 'تاریخ', '历史'], id: 5 },
  { keywords: ['güvenlik', 'askeri', 'savunma', 'security', 'military', 'defense', 'безопасн', 'воен', 'امنیت', 'نظامی', 'دفاع', '安全', '军事'], id: 6 },
  { keywords: ['türk', 'turkic', 'тюрк', 'ترک', '突厥'], id: 7 },
  { keywords: ['bilim', 'teknoloji', 'science', 'technology', 'наук', 'технолог', 'علم', 'فناوری', '科学', '技术'], id: 8 }
];

// ─── Yardımcılar ───────────────────────────────────────────────────────────────

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

function guessCategory(title, summary) {
  const text = ((title || '') + ' ' + (summary || '')).toLowerCase();
  for (const cat of CATEGORY_MAP) {
    for (const kw of cat.keywords) {
      if (text.includes(kw)) return cat.id;
    }
  }
  return null; // varsayılan kategorisiz
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Ana İşlem ─────────────────────────────────────────────────────────────────

async function main() {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${ts}] Browser News Collector v1 başladı\n`);

  // Browser'ı başlat
  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allNews = [];

  for (const lang of LANGUAGES) {
    console.log(`\n🌍 ${lang.name} (${lang.code}) — "${lang.query}"`);
    
    const context = await browser.newContext({ locale: lang.hl });
    const page = await context.newPage();

    try {
      const url = `https://news.google.com/search?q=${encodeURIComponent(lang.query)}&hl=${lang.hl}&gl=${lang.gl}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('article, a[href*="./articles/"]', { timeout: 10000 }).catch(() => {});
      
      // Sayfanın kaynağını al
      const articles = await page.evaluate(() => {
        const items = [];
        const links = document.querySelectorAll('a[href*="./articles/"]');
        const seen = new Set();
        
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href || seen.has(href)) continue;
          seen.add(href);
          
          // Google News URL'sini absolute yap
          let sourceUrl = href;
          if (sourceUrl.startsWith('./')) {
            sourceUrl = 'https://news.google.com' + sourceUrl.substring(1);
          }
          
          const title = link.textContent?.trim() || '';
          if (!title || title.length < 15) continue;
          
          // Ana kartı bul
          const card = link.closest('article') || link.parentElement;
          let summary = '';
          let source = '';
          let time = '';
          
          if (card) {
            const textParts = card.querySelectorAll('span, div, time');
            for (const el of textParts) {
              const t = el.textContent?.trim() || '';
              if (t.length > 50 && t !== title) {
                summary = t;
              }
            }
            const timeEl = card.querySelector('time');
            if (timeEl) time = timeEl.getAttribute('datetime') || '';
            const sourceEl = card.querySelector('[data-n-tag]');
            if (sourceEl) source = sourceEl.textContent?.trim() || '';
          }
          
          items.push({ title, summary, sourceUrl, source, time });
        }
        return items;
      });

      console.log(`  → ${articles.length} haber bulundu (ilk ${Math.min(articles.length, MAX_ITEMS_PER_LANG)} kaydedilecek)`);
      
      for (let i = 0; i < Math.min(articles.length, MAX_ITEMS_PER_LANG); i++) {
        const a = articles[i];
        allNews.push({
          title: a.title,
          summary: a.summary || '',
          source_url: a.sourceUrl || '',
          source_name: a.source || '',
          image_url: '',
          published_at: a.time ? a.time.substring(0, 10) : '',
          lang: lang.code,
          type: 'haber'
        });
      }
      
      await page.close();
      await context.close();
      
    } catch (err) {
      console.error(`  ❌ ${lang.code} hatası: ${err.message}`);
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }
    
    await sleep(1000); // rate limiting
  }

  await browser.close();

  console.log(`\n📊 Toplam ${allNews.length} haber toplandı`);

  if (allNews.length === 0) {
    console.log('❌ Hiç haber bulunamadı, çıkılıyor');
    process.exit(0);
  }

  // ─── DB'ye yaz ──────────────────────────────────────────────────────────

  console.log('\n--- DB yazma aşaması ---');
  
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

  // Mevcut source_url'leri al
  const existingUrls = new Set();
  try {
    const rows = db.prepare("SELECT source_url FROM contents WHERE source_url IS NOT NULL AND source_url != ?").all('');
    for (const r of rows) {
      if (r.source_url) existingUrls.add(r.source_url);
    }
  } catch (_) {}

  const existingSlugs = new Set();
  try {
    const rows = db.prepare('SELECT slug FROM contents').all();
    for (const r of rows) existingSlugs.add(r.slug);
  } catch (_) {}

  console.log(`  DB'de ${existingUrls.size} mevcut kayıt`);

  const stmt = db.prepare(`
    INSERT INTO contents (title, slug, type, summary, source_name, source_url, image_url, published_at, lang, category_id)
    VALUES (@title, @slug, @type, @summary, @sourceName, @sourceUrl, @imageUrl, @publishedAt, @lang, @categoryId)
  `);

  let inserted = 0;
  let skipped = 0;

  for (const news of allNews) {
    const sourceUrl = (news.source_url || '').trim();
    
    if (sourceUrl && existingUrls.has(sourceUrl)) {
      skipped++;
      continue;
    }
    if (!sourceUrl) {
      skipped++;
      continue;
    }

    let slug = slugify(news.title || sourceUrl);
    if (existingSlugs.has(slug)) {
      slug = slug + '-' + Date.now();
    }

    const categoryId = guessCategory(news.title, news.summary);

    try {
      stmt.run({
        title: news.title || 'Başlıksız',
        slug: slug,
        type: 'haber',
        summary: (news.summary || '').substring(0, 500) || '—',
        sourceName: news.source_name || '',
        sourceUrl: sourceUrl,
        imageUrl: news.image_url || '',
        publishedAt: news.published_at || null,
        lang: news.lang || 'tr',
        categoryId: categoryId
      });
      existingUrls.add(sourceUrl);
      existingSlugs.add(slug);
      inserted++;
    } catch (err) {
      console.warn(`  Insert hatası: ${err.message} — "${(news.title || '').substring(0, 40)}"`);
      skipped++;
    }
  }

  db.close();
  console.log(`\n✅ ${inserted} yeni haber eklendi, ${skipped} atlandı (tekrar)`);
}

main().catch(err => {
  console.error(`\n❌ KRİTİK HATA: ${err.message}`);
  process.exit(1);
});
