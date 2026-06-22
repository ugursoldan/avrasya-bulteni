// DeepSeek API ile içerik özetleme ve değerlendirme
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fetch = require('node-fetch');
const db = require('../db');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Metnin yabancı dilde olup olmadığını kontrol et
function isForeignText(text) {
  if (!text) return false;
  const hasTurkishChars = /[çğıöşüÇĞİÖŞÜ]/u.test(text);
  const hasCyrillic = /[а-яА-ЯёЁ]/u.test(text);
  const hasArabic = /[آ-ی]/u.test(text);
  const hasChinese = /[\u4e00-\u9fff]/u.test(text);
  return (hasCyrillic || hasArabic || hasChinese || (!hasTurkishChars && /[a-zA-Z]/.test(text) && text.length > 20));
}

// Başlığı Türkçe'ye çevir
async function translateTitle(title) {
  if (!API_KEY || !title || title.length < 5) return title;
  if (!isForeignText(title)) return title;

  const hasCyrillic = /[а-яА-ЯёЁ]/u.test(title);
  const hasArabic = /[آ-ی]/u.test(title);
  const hasChinese = /[\u4e00-\u9fff]/u.test(title);
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
          { role: 'system', content: `Sen bir tercümansın. ${langHint} haber başlıklarını kısa ve doğru şekilde Türkçe'ye çeviriyorsun. Sadece çeviriyi yaz, açıklama ekleme.` },
          { role: 'user', content: `Aşağıdaki ${langHint} haber başlığını Türkçe'ye çevir. Sadece çeviriyi yaz:\n\n${title}` }
        ],
        temperature: 0.1,
        max_tokens: 200
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) return title;
    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    return translated || title;
  } catch (err) {
    return title;
  }
}

// Bir içeriği AI ile özetle (50-100 kelime zorlamalı)
async function summarizeContent(content, attempt = 1) {
  if (!API_KEY) {
    console.warn('⚠️ DEEPSEEK_API_KEY bulunamadı, özetleme atlanıyor.');
    return null;
  }

  const wordTarget = '50-100';

  // Her denemede daha sert uyar
  const severity = attempt === 1 ? '' : attempt === 2 ? ' UYARI: Önceki denemede çok kısa özet ürettin.' : ' SERT UYARI: İki kez kısa özet ürettin. Şimdi 50-100 kelime arasında yazmak ZORUNDASIN.';

  const systemMsg = `Sen bir haber analistisin. SADECE TÜRKÇE haber özeti yazarsın.

KURAL: Her özet ${wordTarget} kelime arasında olmalıdır.${severity}

Önce haberi 2 cümleyle tanıt, sonra 3-4 cümle detaylandır, son olarak 2 cümle önemini belirt. Bilgilendirici ton kullan, yorum katma, sadece gerçekleri aktar.

Yanıt SADECE JSON: {"summary": "özet metni", "tags": ["etiket1", "etiket2", "etiket3"]}`;

  const prompt = `Aşağıdaki Avrasya konulu içeriği özetle:

**İçerik:**
Başlık: ${content.title}
Kaynak: ${content.source_name || ''}${content.source_url ? '\nURL: ' + content.source_url : ''}
${content.full_text ? 'Detay: ' + content.full_text.substring(0, 3000) : ''}

Yanıt olarak JSON döndür:
{
  "summary": "${wordTarget} kelime arasında, bilgilendirici Türkçe haber özeti. ${wordTarget} kelimenin altı GEÇERSİZ.",
  "tags": ["etiket1", "etiket2", "etiket3"]
}`;

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
          { role: 'system', content: systemMsg },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`AI API hatası (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    const result = JSON.parse(data.choices[0].message.content);

    // Kelime sayısını kontrol et - 50'den azsa yeniden dene (en fazla 1 kez)
    if (result.summary) {
      const wordCount = result.summary.trim().split(/\s+/).length;
      if (wordCount < 30 && attempt < 2) {
        console.log(`    ⚠️ Çok kısa özet (${wordCount} kelime), yeniden deneniyor...`);
        await new Promise(r => setTimeout(r, 1000));
        return summarizeContent(content, attempt + 1);
      }
      console.log(`    ✓ ${wordCount} kelime`);
    }

    return {
      summary: result.summary || '',
      tags: result.tags || [],
      category: result.category || 'genel',
      review: result.review || ''
    };
  } catch (err) {
    console.error(`AI API çağrı hatası (deneme ${attempt}):`, err.message);
    if (attempt < 2) {
      console.log(`    Retry: ${err.message.substring(0, 60)}...`);
      await new Promise(r => setTimeout(r, 2000));
      return summarizeContent(content, attempt + 1);
    }
    return null;
  }
}

// İşlenmemiş içerikleri özetle
async function processUnsummarized() {
  const rows = db.prepare(`SELECT id, title, summary, full_text, source_name, source_url, type FROM contents WHERE ai_summarized = 0 ORDER BY id`).all();

  if (!rows.length) {
    console.log('✅ Özetlenecek içerik bulunamadı.');
    return;
  }

  console.log(`\n🔍 ${rows.length} içerik özetlenecek...\n`);

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    console.log(`[${processed + 1}/${rows.length}] ${row.title.substring(0, 60)}...`);

    // Başlık yabancı dildeyse Türkçe'ye çevir
    const translatedTitle = await translateTitle(row.title);
    if (translatedTitle !== row.title) {
      // Slug'ı da güncelle
      const newSlug = row.title.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 120);
      const translatedSlug = translatedTitle.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 120);
      db.prepare(`UPDATE contents SET title = ?, slug = ? WHERE id = ?`).run(translatedTitle, translatedSlug, row.id);
      row.title = translatedTitle;
      console.log(`    🔄 Başlık Türkçe'ye çevrildi`);
    }

    const result = await summarizeContent(row);

    if (result && result.summary) {
      db.prepare(`UPDATE contents SET summary = ?, ai_summarized = 1 WHERE id = ?`).run(result.summary, row.id);

      // Etiketleri kaydet
      if (result.tags && result.tags.length) {
        for (const tagName of result.tags) {
          const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9çğıöşüa]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          const existing = db.prepare(`SELECT id FROM tags WHERE slug = ?`).get(tagSlug);
          let tagId;
          if (existing) {
            tagId = existing.id;
          } else {
            const ins = db.prepare(`INSERT INTO tags (name, slug) VALUES (?, ?)`).run(tagName, tagSlug);
            tagId = ins.lastInsertRowid;
          }
          // content_tags bağlantısı
          db.prepare(`INSERT OR IGNORE INTO content_tags (content_id, tag_id) VALUES (?, ?)`).run(row.id, tagId);
        }
      }

      processed++;
      console.log(`    ✅ ID:${row.id}`);
    } else {
      console.log(`    ❌ ID:${row.id} başarısız`);
      db.prepare(`UPDATE contents SET ai_summarized = 1 WHERE id = ?`).run(row.id);
      failed++;
    }

    // Rate limit - batch arası bekle
    if (processed + failed < rows.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n📊 Özetleme tamamlandı: ${processed} başarılı, ${failed} başarısız`);
}

module.exports = { processUnsummarized };

// Ana akış
processUnsummarized().catch(err => {
  console.error('Kritik hata:', err);
  process.exit(1);
});
