// Tarama motoru - açık kaynaklardan Avrasya içeriği toplar
const db = require('../db');
const fetch = require('node-fetch');
const RssParser = require('rss-parser');
const cheerio = require('cheerio');

const parser = new RssParser();

// Anahtar kelimeler
const KEYWORDS = [
  'Avrasya', 'Eurasia', 'Avrasyacılık', 'Eurasianism',
  'Türk Dünyası', 'Turkic World', 'Turkish World',
  'Orta Asya', 'Central Asia', 'Kafkasya', 'Caucasus',
  'İpek Yolu', 'Silk Road', 'BRI',
  'Türk Devletleri Teşkilatı', 'Organization of Turkic States',
  'Avrasya Ekonomik Birliği', 'EAEU', 'Eurasian Economic Union',
  'Şanghay İşbirliği Örgütü', 'SCO', 'Shanghai Cooperation',
  'Hazar Denizi', 'Caspian Sea', 'Caspian',
  'TANAP', 'Türk Akımı', 'TurkStream',
  'Azerbaycan', 'Kazakistan', 'Özbekistan', 'Türkmenistan', 'Kırgızistan',
  'Russia', 'Rusya',
  'Avrasya güvenlik', 'Eurasian security',
  'Yeni İpek Yolu', 'Belt and Road'
];

// RSS kaynakları
const RSS_SOURCES = [
  // Akademik
  { url: 'https://rss.app/feeds/1N1DkQkn8tpCO9YD.xml', name: 'Google Akademik (Eurasia)', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=Eurasia&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Eurasia)', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=Avrasya&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Avrasya)', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=%22T%C3%BCrk+D%C3%BCnyas%C4%B1%22&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Türk Dünyası)', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=%22Orta+Asya%22&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Orta Asya)', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=%22Kafkasya%22&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Kafkasya)', type: 'rss' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml', name: 'NYT Asia Pacific', type: 'rss' },
];

// İçerik türünü başlık ve özete göre belirle
function detectType(title, snippet) {
  const text = (title + ' ' + snippet).toLowerCase();

  if (/kitap|book|yeni kitap|yayınlandı|published/i.test(text)) return 'kitap';
  if (/sempozyum|symposium|kongre|congress/i.test(text)) return 'sempozyum';
  if (/panel|panel discussion|açık oturum/i.test(text)) return 'panel';
  if (/bildiri|paper|conference paper|proceedings/i.test(text)) return 'bildiri';
  if (/rapor|report|analiz raporu/i.test(text)) return 'rapor';
  if (/makale|article|research|araştırma|çalışma|inceleme/i.test(text)) return 'makale';

  return 'haber';
}

// Slug oluştur
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 120);
}

// Keyword match
function keywordMatch(text) {
  const lower = text.toLowerCase();
  const matched = [];
  for (const kw of KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      matched.push(kw);
    }
  }
  return matched;
}

// RSS tarama
async function scanRss(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = feed.items || [];

    let newCount = 0;

    for (const item of items.slice(0, 30)) {
      const title = item.title?.trim();
      const link = item.link?.trim();
      const snippet = item.contentSnippet || item.content || item.description || '';
      const pubDate = item.pubDate || item.isoDate || null;

      if (!title || !link) continue;

      // Keyword kontrolü
      const matched = keywordMatch(title + ' ' + snippet);
      if (matched.length === 0) continue;

      const slug = slugify(title);
      if (!slug) continue;

      // Daha önce kaydedilmiş mi?
      const exists = db.prepare('SELECT id FROM contents WHERE slug = ?').get(slug);
      if (exists) continue;

      // Tür belirle
      const type = detectType(title, snippet);

      // Kategori bul
      const categoryId = guessCategory(matched, snippet);

      // Kısa özet oluştur (ilk 300 karakter)
      const summary = snippet.substring(0, 400) + (snippet.length > 400 ? '...' : '');

      db.prepare(`
        INSERT OR IGNORE INTO contents (title, slug, type, category_id, summary, full_text, source_name, source_url, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(title, slug, type, categoryId, summary, snippet, source.name, link, pubDate ? new Date(pubDate).toISOString().split('T')[0] : null);

      // Tag ekle
      for (const kw of matched.slice(0, 5)) {
        const tagSlug = slugify(kw);
        db.prepare('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)').run(kw, tagSlug);
        const tag = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug);
        const content = db.prepare('SELECT id FROM contents WHERE slug = ?').get(slug);
        if (tag && content) {
          db.prepare('INSERT OR IGNORE INTO content_tags (content_id, tag_id) VALUES (?, ?)').run(content.id, tag.id);
        }
      }

      newCount++;
    }

    return { success: true, newItems: newCount };
  } catch (err) {
    return { success: false, newItems: 0, error: err.message };
  }
}

// Kategori tahmini
function guessCategory(matchedKeywords, text) {
  const lower = text.toLowerCase();
  const catMap = [
    { keywords: ['güvenlik', 'security', 'nato', 'askeri', 'military', 'savunma', 'defence', 'savaş', 'war', 'çatışma', 'conflict'], catSlug: 'guvenlik' },
    { keywords: ['ekonomi', 'economy', 'ticaret', 'trade', 'finans', 'finance', 'yatırım', 'investment', 'GSYİH', 'GDP'], catSlug: 'ekonomi' },
    { keywords: ['enerji', 'energy', 'petrol', 'oil', 'doğalgaz', 'gas', 'boru hattı', 'pipeline', 'TANAP', 'TürkAkım'], catSlug: 'enerji' },
    { keywords: ['kültür', 'culture', 'sanat', 'art', 'dil', 'language', 'eğitim', 'education', 'üniversite', 'university'], catSlug: 'kultur' },
    { keywords: ['tarih', 'history', 'antik', 'ancient', 'arkeoloji', 'archaeology', 'Osmanlı', 'Ottoman', 'Sovyet'], catSlug: 'tarih' },
    { keywords: ['Türk Dünyası', 'Turkic World', 'Türk Devletleri', 'TDT', 'OTS', 'Azerbaycan', 'Kazakistan', 'Özbekistan'], catSlug: 'turk-dunyasi' },
    { keywords: ['bilim', 'science', 'teknoloji', 'technology', 'uzay', 'space', 'inovasyon', 'innovation'], catSlug: 'bilim-teknoloji' },
  ];

  for (const cat of catMap) {
    if (cat.keywords.some(kw => lower.includes(kw) || matchedKeywords.some(m => lower.includes(m.toLowerCase())))) {
      const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(cat.catSlug);
      if (row) return row.id;
    }
  }
  return null; // Genel / Siyaset kategorisi
}

// Ana tarama fonksiyonu
async function runScan() {
  console.log('🔍 Avrasya Bülteni taraması başlıyor...');
  const startTime = Date.now();

  // RSS kaynaklarındaki URL'leri DB'ye ekle
  const insertSource = db.prepare('INSERT OR IGNORE INTO scanned_sources (url, name, type) VALUES (?, ?, ?)');
  for (const s of RSS_SOURCES) {
    insertSource.run(s.url, s.name, s.type);
  }

  // Aktif kaynakları getir
  const sources = db.prepare('SELECT * FROM scanned_sources WHERE is_active = 1').all();

  let totalNew = 0;
  let totalErrors = 0;

  for (const source of sources) {
    console.log(`  → ${source.name}...`);
    const result = await scanRss(source);

    if (result.success) {
      totalNew += result.newItems;
      db.prepare('UPDATE scanned_sources SET last_scanned = CURRENT_TIMESTAMP WHERE id = ?').run(source.id);
    } else {
      totalErrors++;
      console.error(`  ✗ ${source.name}: ${result.error}`);
    }

    // Kaynaklar arasında bekle (rate limit)
    await new Promise(r => setTimeout(r, 2000));

    // Tarama logu
    db.prepare('INSERT INTO scan_log (source_id, new_items, status, error_msg) VALUES (?, ?, ?, ?)').run(
      source.id, result.newItems, result.success ? 'success' : 'error', result.error || null
    );
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Tarama tamamlandı: ${totalNew} yeni içerik, ${totalErrors} hata (${duration}s)`);
}

module.exports = { runScan };

// Doğrudan çalıştırıldığında
if (require.main === module) {
  runScan().catch(err => {
    console.error('❌ Tarama hatası:', err);
    process.exit(1);
  });
}
