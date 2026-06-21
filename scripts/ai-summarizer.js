// DeepSeek AI ile içerik özetleme ve değerlendirme
const fetch = require('node-fetch');
const db = require('../db');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = 'https://api.deepseek.com/v1/chat/completions';

// Bir içeriği AI ile özetle
async function summarizeContent(content) {
  if (!API_KEY) {
    console.warn('⚠️ DEEPSEEK_API_KEY bulunamadı, özetleme atlanıyor.');
    return null;
  }

  const prompt = `Sen bir akademik içerik editörüsün. Aşağıdaki Avrasya konulu içeriği özetle ve kategorize et.

**İçerik:**
${content.summary || content.full_text || content.title}

**Görevin:**
1. 2-3 cümlelik net bir özet yaz (Türkçe, akademik üslup KULLANMA, anlaşılır ol)
2. Uygun kategorileri seç: Siyaset, Ekonomi, Enerji, Kültür, Tarih, Güvenlik, Türk Dünyası, Bilim & Teknoloji
3. 3-5 anahtar etiket belirle
4. Eğer içerik türü "kitap" ise kısa bir değerlendirme/değer analizi ekle

**Yanıt formatı (sadece JSON, başka hiçbir şey yazma):**
{
  "summary": "özet metin",
  "category": "kategori_slug",
  "tags": ["etiket1", "etiket2", "etiket3"],
  "review": "kitap değerlendirmesi (sadece kitap türünde)"
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
          { role: 'system', content: 'Sen bir akademik içerik editörüsün. JSON formatında yanıt ver.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`AI API hatası (${res.status}): ${errText}`);
      return null;
    }

    const data = await res.json();
    const result = JSON.parse(data.choices[0].message.content);

    return result;
  } catch (err) {
    console.error('AI çağrı hatası:', err.message);
    return null;
  }
}

// Taranmış ama özetlenmemiş içerikleri işle
async function processUnsummarized() {
  const items = db.prepare(`
    SELECT id, title, slug, type, summary, full_text
    FROM contents
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  let processed = 0;
  for (const item of items) {
    if (!item.full_text || item.summary === item.full_text) continue;

    console.log(`  ✏️ ${item.type}: ${item.title.substring(0, 60)}...`);
    const aiResult = await summarizeContent(item);

    if (aiResult) {
      const updates = [];
      const params = [];

      if (aiResult.summary && aiResult.summary !== item.summary) {
        updates.push('summary = ?');
        params.push(aiResult.summary);
      }

      if (aiResult.category) {
        const cat = db.prepare('SELECT id FROM categories WHERE slug = ?').get(aiResult.category);
        if (cat) {
          updates.push('category_id = ?');
          params.push(cat.id);
        }
      }

      if (updates.length > 0) {
        params.push(item.id);
        db.prepare(`UPDATE contents SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      // Tag ekle
      if (aiResult.tags) {
        for (const tagName of aiResult.tags.slice(0, 5)) {
          const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, '-').replace(/^-+|-+$/g, '');
          db.prepare('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)').run(tagName, tagSlug);
          const tag = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug);
          if (tag) {
            db.prepare('INSERT OR IGNORE INTO content_tags (content_id, tag_id) VALUES (?, ?)').run(item.id, tag.id);
          }
        }
      }

      // Kitap değerlendirmesi ekle
      if (aiResult.review) {
        const updatedSummary = item.summary + '\n\n📖 **Kitap Değerlendirmesi:**\n' + aiResult.review;
        db.prepare('UPDATE contents SET summary = ? WHERE id = ?').run(updatedSummary, item.id);
      }

      processed++;
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`✅ ${processed} içerik AI ile özetlendi.`);
  return processed;
}

module.exports = { summarizeContent, processUnsummarized };

if (require.main === module) {
  processUnsummarized().catch(err => {
    console.error('❌ Hata:', err);
    process.exit(1);
  });
}
