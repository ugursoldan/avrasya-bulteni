// Tarama motoru - açık kaynaklardan Avrasya içeriği toplar
const db = require('../db');
const fetch = require('node-fetch');
const RssParser = require('rss-parser');
const cheerio = require('cheerio');

const parser = new RssParser();

// DeepSeek API yapılandırması
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

// API çağrı limiti (rate limit)
const API_DELAY_MS = 500;

// Başlık ve snippet'i Türkçe'ye çevir
async function translateToTurkish(text, sourceName) {
  if (!API_KEY || !text || text.length < 5) return text;

  // Sadece yabancı dildeki metinleri çevir (Türkçe karakter yoksa veya Latin alfabesi dışındaysa)
  const hasTurkishChars = /[çğıöşüÇĞİÖŞÜ]/u.test(text);
  const hasCyrillic = /[а-яА-ЯёЁ]/u.test(text);
  const hasArabic = /[آ-ی]/u.test(text);
  const hasChinese = /[\u4e00-\u9fff]/u.test(text);

  if (hasTurkishChars && !hasCyrillic && !hasArabic && !hasChinese) {
    return text; // Zaten Türkçe
  }

  // Kısa başlıklar için çeviri gerekmez
  if (text.length < 10) return text;

  // Kaynak ismine göre dil ipucu
  const langHint = hasCyrillic ? 'Rusça' : hasArabic ? 'Farsça/Arapça' : hasChinese ? 'Çince' : 'İngilizce';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: `Sen bir tercümansın. ${langHint} metinleri Türkçe'ye çeviriyorsun. Sadece çeviriyi yaz, açıklama ekleme.` },
          { role: 'user', content: `Aşağıdaki ${langHint} metni Türkçe'ye çevir. Sadece çeviriyi yaz:\n\n${text}` }
        ],
        temperature: 0.1,
        max_tokens: 300
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) return text;
    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    return translated || text;
  } catch (err) {
    return text; // Hata durumunda orijinal metni koru
  }
}

// Bir haberin Avrasya ile ilgili olup olmadığını DeepSeek ile kontrol et
async function isEurasiaRelated(title, snippet) {
  if (!API_KEY) return true; // API yoksa her şeyi kabul et

  // Keyword match zaten yapıldıysa tekrar kontrol etme
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Sen bir haber filtresisin. Bir haberin Avrasya bölgesiyle (Türk Dünyası, Kafkasya, Orta Asya, Sibirya, İpek Yolu, Şanghay İşbirliği Örgütü, Avrasya Ekonomik Birliği) ilgili olup olmadığını belirliyorsun. Sadece "evet" veya "hayır" yaz.' },
          { role: 'user', content: `Bu haber Avrasya bölgesiyle ilgili mi?\nBaşlık: ${title}\nÖzet: ${snippet?.substring(0, 300)}` }
        ],
        temperature: 0.1,
        max_tokens: 10
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return true;
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() || 'evet';
    return answer.includes('evet');
  } catch (err) {
    return true; // Hata durumunda kabul et
  }
}

// Anahtar kelimeler
const KEYWORDS = [
  // Türkçe
  'Avrasya', 'Avrasyacılık',
  'Türk Dünyası', 'Orta Asya', 'Kafkasya',
  'İpek Yolu',
  'Türk Devletleri Teşkilatı',
  'Avrasya Ekonomik Birliği',
  'Şanghay İşbirliği Örgütü',
  'Hazar Denizi',
  'TANAP', 'Türk Akımı',
  'Azerbaycan', 'Kazakistan', 'Özbekistan', 'Türkmenistan', 'Kırgızistan',
  'Rusya',
  'Avrasya güvenlik',
  'Yeni İpek Yolu',
  // İngilizce
  'Eurasia', 'Eurasianism',
  'Turkic World', 'Turkish World',
  'Central Asia', 'Caucasus',
  'Silk Road', 'BRI',
  'Organization of Turkic States',
  'EAEU', 'Eurasian Economic Union',
  'SCO', 'Shanghai Cooperation',
  'Caspian Sea', 'Caspian',
  'TurkStream',
  'Eurasian security',
  'Belt and Road',
  // Rusça
  'Евразия', 'Евразийство',
  'Тюркский мир', 'Центральная Азия', 'Кавказ',
  'Шелковый путь',
  'Организация тюркских государств',
  'Евразийский экономический союз',
  'Шанхайская организация сотрудничества', 'ШОС',
  'Каспийское море',
  'Тюркские государства',
  // Farsça
  'اوراسیا',
  'آسیای مرکزی', 'قفقاز',
  'جهان ترک',
  'راه ابریشم',
  'سازمان همکاری شانگهای',
  'دریای خزر',
  'اتحادیه اقتصادی اوراسیا',
  'کشورهای ترک',
  // Çince
  '欧亚', '欧亚大陆',
  '中亚', '高加索',
  '突厥世界', '突厥国家',
  '丝绸之路',
  '上海合作组织',
  '欧亚经济联盟',
  '里海',
  '一带一路',
];

// RSS kaynakları
const RSS_SOURCES = [
  // Türkçe - Akademik & Haber
  { url: 'https://rss.app/feeds/1N1DkQkn8tpCO9YD.xml', name: 'Google Akademik (Eurasia)', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=Eurasia&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Eurasia) TR', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=Avrasya&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Avrasya) TR', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=%22T%C3%BCrk+D%C3%BCnyas%C4%B1%22&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Türk Dünyası) TR', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=%22Orta+Asya%22&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Orta Asya) TR', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=%22Kafkasya%22&hl=tr&gl=TR&ceid=TR:tr', name: 'Google News (Kafkasya) TR', type: 'rss' },
  // İngilizce
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/AsiaPacific.xml', name: 'NYT Asia Pacific', type: 'rss' },
  // Rusça - Google News
  { url: 'https://news.google.com/rss/search?q=Евразия&hl=ru&gl=RU&ceid=RU:ru', name: 'Google News (Евразия) RU', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=Центральная+Азия&hl=ru&gl=RU&ceid=RU:ru', name: 'Google News (Центральная Азия) RU', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=Кавказ&hl=ru&gl=RU&ceid=RU:ru', name: 'Google News (Кавказ) RU', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=Шелковый+путь&hl=ru&gl=RU&ceid=RU:ru', name: 'Google News (Шелковый путь) RU', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=ШОС&hl=ru&gl=RU&ceid=RU:ru', name: 'Google News (ШОС) RU', type: 'rss' },
  // Rusça - Haber Ajansları
  { url: 'https://tass.ru/rss/v2.xml', name: 'TASS Russia', type: 'rss' },
  { url: 'https://ria.ru/export/rss2/index.xml', name: 'RIA Novosti', type: 'rss' },
  { url: 'https://rg.ru/export/rss/index.xml', name: 'Rossiyskaya Gazeta', type: 'rss' },
  { url: 'https://eadaily.com/ru/rss', name: 'EADaily Eurasia', type: 'rss' },
  // Farsça - Google News
  { url: 'https://news.google.com/rss/search?q=اوراسیا&hl=fa&gl=IR&ceid=IR:fa', name: 'Google News (اوراسیا) FA', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=آسیای+مرکزی&hl=fa&gl=IR&ceid=IR:fa', name: 'Google News (آسیای مرکزی) FA', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=قفقاز&hl=fa&gl=IR&ceid=IR:fa', name: 'Google News (قفقاز) FA', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=راه+ابریشم&hl=fa&gl=IR&ceid=IR:fa', name: 'Google News (راه ابریشم) FA', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=جهان+ترک+اوراسیا&hl=fa&gl=IR&ceid=IR:fa', name: 'Google News (جهان ترک) FA', type: 'rss' },
  // Farsça - Haber Ajansları
  { url: 'https://www.tasnimnews.com/rss/feed/0/tasnim', name: 'Tasnim News Agency FA', type: 'rss' },
  // Çince - Google News
  { url: 'https://news.google.com/rss/search?q=欧亚&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', name: 'Google News (欧亚) ZH', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=中亚&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', name: 'Google News (中亚) ZH', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=高加索&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', name: 'Google News (高加索) ZH', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=丝绸之路&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', name: 'Google News (丝绸之路) ZH', type: 'rss' },
  { url: 'https://news.google.com/rss/search?q=上海合作组织&hl=zh-CN&gl=CN&ceid=CN:zh-Hans', name: 'Google News (上合组织) ZH', type: 'rss' },
  // Çince - Haber Ajansları
  { url: 'http://www.chinadaily.com.cn/rss/world_rss.xml', name: 'China Daily World ZH', type: 'rss' },
  { url: 'https://www.globaltimes.cn/rss/', name: 'Global Times ZH', type: 'rss' },
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
    // Unicode karakterler için URL encode
    const encodedUrl = source.url.replace(/[\u007f-\uffff]/g, function(ch) {
      return encodeURIComponent(ch);
    });
    const feed = await parser.parseURL(encodedUrl);
    const items = feed.items || [];

    let newCount = 0;

    for (const item of items.slice(0, 30)) {
      const title = item.title?.trim();
      const link = item.link?.trim();
      const snippet = item.contentSnippet || item.content || item.description || '';
      const pubDate = item.pubDate || item.isoDate || null;

      if (!title || !link) continue;

      // Yabancı dil filtreleme: Avrasya'yla ilgisiz içerikleri atla (API çağrısı gerektirir)
      // Not: Sadece yabancı kaynaklar için yapılır
      const isForeignSource = /ru|fa|zh/i.test(source.name) || /chinadaily|globaltimes|ria\.ru|tass/i.test(source.url);
      if (isForeignSource) {
        const isRelevant = await isEurasiaRelated(title, snippet);
        if (!isRelevant) continue;
      }

      // Keyword kontrolü
      const matched = keywordMatch(title + ' ' + snippet);
      if (matched.length === 0) continue;

      // Başlık ve snippet'i Türkçe'ye çevir
      const translatedTitle = await translateToTurkish(title, source.name);
      const translatedSnippet = await translateToTurkish(snippet, source.name);

      // Slug'ı çevrilmiş başlıktan oluştur
      const slug = slugify(translatedTitle);
      if (!slug) continue;

      // Daha önce kaydedilmiş mi? (çeviri sonrası slug ile kontrol)
      const exists = db.prepare('SELECT id FROM contents WHERE slug = ?').get(slug);
      if (exists) continue;

      // Tür belirle (çevrilmiş başlıkla)
      const type = detectType(translatedTitle, translatedSnippet);

      // Kategori bul
      const categoryId = guessCategory(matched, translatedSnippet);

      // Kısa özet oluştur (çevrilmiş snippet)
      const summary = translatedSnippet.substring(0, 400) + (translatedSnippet.length > 400 ? '...' : '');

      // Kaynağın dilini belirle
      const hasCyrillic = /[а-яА-ЯёЁ]/u.test(source.url);
      const hasChinese = /zh/i.test(source.name) || /chinadaily|xinhuas?e?t?/i.test(source.url);
      const lang = hasChinese ? 'zh' : hasCyrillic ? 'ru' : 'tr';

      db.prepare(`
        INSERT OR IGNORE INTO contents (title, slug, type, category_id, summary, full_text, source_name, source_url, published_at, lang)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(translatedTitle, slug, type, categoryId, summary, translatedSnippet, source.name, link, pubDate ? new Date(pubDate).toISOString().split('T')[0] : null, lang);

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
