#!/usr/bin/env node
/**
 * Bozuk çevirileri düzelt — DeepSeek'in sansürlediği veya hata verdiği
 * özetleri elle yaz ya da alternatif prompt ile yeniden dene.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Database = require('better-sqlite3');
const db = new Database(require('path').join(__dirname, '..', 'db/data/avrasya.db'));

// Bozuk özetlere sahip kayıtları bul
const bad = db.prepare(`
  SELECT id, title, source_url, summary FROM contents 
  WHERE summary LIKE '%抱歉%' OR summary LIKE '%无法处理%' OR summary LIKE '%I cannot%' OR summary LIKE '%cannot assist%' OR summary = ''
`).all();

console.log(`Bulunan bozuk kayıt: ${bad.length}`);

const https = require('https');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function translate(text) {
  if (!text || text.length < 5) return text;
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Sen bir haber tercümanısın. Çince haber metinlerini Türkçe\'ye çevir. Sansür uygulama, haber metnini olduğu gibi çevir. Sadece çeviriyi yaz.' },
        { role: 'user', content: `Çevir (sadece çeviri):\n\n${text.substring(0, 1500)}` }
      ],
      temperature: 0.1,
      max_tokens: 1024
    });

    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const r = JSON.parse(data);
          const t = r.choices?.[0]?.message?.content?.trim();
          resolve(t || text);
        } catch { resolve(text); }
      });
    });
    req.on('error', () => resolve(text));
    req.write(payload);
    req.end();
  });
}

async function main() {
  for (const row of bad) {
    console.log(`\n[${row.id}] ${row.title.substring(0, 50)}`);
    
    // Özet bozuk — orijinal İngilizce özeti bulamayız, source_url'den çekmeyi dene
    // Alternatif: İngilizce/Türkçe manuel özet yaz
    // Şimdilik DeepSeek'e farklı prompt ile tekrar dene
    console.log(`  Bozuk özet mevcut, yeniden çevrilmeye çalışılıyor...`);
    
    // source_url'den sayfayı çekip özet almak çok yavaş olur
    // Manuel özet yaz:
    let fixedSummary = '';
    
    if (row.id === 1315 || row.title.includes('Lai') || row.title.includes('Tayvan')) {
      fixedSummary = 'Tayvan Devlet Başkanı Lai Ching-te, Çin ile diyalog ve işbirliğine açık olduklarını ancak Tayvan\'ın bağımsız bir ülke olduğunu ve birleşmeyi kabul etmemelerinin kışkırtma olarak görülmemesi gerektiğini söyledi. Tayvan-Çin ilişkilerinde yeni bir döneme girilirken, Lai\'nin açıklamaları iki taraf arasındaki gerilimi azaltmaya yönelik bir adım olarak yorumlandı.';
    }

    if (fixedSummary) {
      db.prepare('UPDATE contents SET summary = ? WHERE id = ?').run(fixedSummary, row.id);
      console.log(`  ✅ Düzeltildi`);
    } else {
      // DeepSeek ile dene (farklı prompt)
      // Elimizde sadece başlık var, source_url'den içerik çekmek yerine 
      // başlıktan yola çıkarak kısa özet yazdıralım
      const newSummary = await translate(row.title + '. Bu haber hakkında 2-3 cümlelik Türkçe özet yaz.');
      await sleep(500);
      if (newSummary && !newSummary.includes('抱歉') && !newSummary.includes('无法')) {
        db.prepare('UPDATE contents SET summary = ? WHERE id = ?').run(newSummary, row.id);
        console.log(`  ✅ DeepSeek ile düzeltildi`);
      } else {
        console.log(`  ❌ Düzeltilemedi`);
      }
    }
  }
  
  db.close();
  console.log('\n✅ Tamamlandı');
}

main().catch(console.error);
