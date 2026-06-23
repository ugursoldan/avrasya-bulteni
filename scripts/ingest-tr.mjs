import Database from 'better-sqlite3';
import crypto from 'crypto';

const db = new Database('./db/data/avrasya.db');

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function categoryFor(title) {
  const text = title.toLowerCase();
  if (/türk dünyası|turkic|türk devlet|türk dünya|türklerin/i.test(text)) return 7;
  if (/enerji|petrol|doğalgaz/i.test(text)) return 3;
  if (/güvenlik|askeri|savunma|nato|savaş/i.test(text)) return 6;
  if (/ekonomi|ticaret|ekonomik|borsa|gyo|finans/i.test(text)) return 2;
  if (/kültür/i.test(text)) return 4;
  if (/tarih/i.test(text)) return 5;
  return 1;
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\- ]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 200);
}

const existingUrls = new Set(
  db.prepare('SELECT source_url FROM contents WHERE source_url IS NOT NULL AND source_url != ""').all().map(r => r.source_url)
);

const articles = [
  {t:"İnçe Borun'un Jeopolitik Avantajı İran'ın Sınır Ticareti İçin; Avrasya'ya Bağlantı",s:"تسنیم"},
  {t:"Mesele İran değil... Yeni dünyada Türkiye'nin yeri",s:"Odatv"},
  {t:"Moskova'nın Taliban açmazı: Düşmandan komşuya, komşudan müttefike",s:"Habertürk"},
  {t:"Türkiye süper güçleri baypas etti, Orta Koridor'da oyunu kuruyor",s:"Yeni Şafak"},
  {t:"Olaylar Ve Görüşler yazdı : Jeopolitik armağan - Nejat Eslen",s:"Cumhuriyet"},
  {t:"Özgür Çelik | Yeni jeopolitik denklem",s:"Independent Türkçe"},
  {t:"Türk dünyası ekonomik, kültürel ve jeopolitik bir medeniyet ağına dönüşebilir mi?",s:"Forbes Türkiye"},
  {t:"Yunan Profesör Grivas: Türkiye Avrasya'nın En Hırslı Gücü Oldu",s:"Stratejik Düşünce Enstitüsü"},
  {t:"Pekin'de Yeni Küresel Düzen'in ilk adımları",s:"Sabah"},
  {t:"Orta Avrasya: Jeopolitik mi, Ekonomipolitik mi?",s:"Birikim Dergisi"},
  {t:"Avrasya'da yeni eksen: Çin-Rusya ortaklığı",s:"Anadolu Ajansı"},
  {t:"ABD-Çin Soğuk Barışı ve Türkiye",s:"AA Analiz"},
  {t:"Cumhurbaşkanı Erdoğan'dan Avrasya'da Barışın Anahtarı: Türk Dünyası",s:"TRT Haber"},
  {t:"2025'te Rusya-Azerbaycan İlişkileri: Avrasya Jeopolitiğinde Yeni Bir Stratejik Fay Hattı",s:"ANKASAM"},
  {t:"Orta Koridor Türkiye'yi Avrasya ticaretinin merkezine taşıyor",s:"TRT Haber"},
  {t:"Büyük Avrasya ittifakı",s:"Star"},
  {t:"Küresel jeopolitik geçiş dönemi ve Türkiye",s:"AA Analiz"},
  {t:"Ağaoğlu Avrasya GYO halka arz sonuçları açıklandı",s:"Bloomberg HT"},
  {t:"Orta Asya: Avrasya'daki fay hatlarının birleştiği nokta",s:"Independent Türkçe"},
  {t:"Bülent Erandaç - Avrasya'da Türkiye-Çin Tahkimatı",s:"Habertürk"},
  {t:"Güney Kafkasya'da esen barış rüzgarları",s:"AA"},
  {t:"Global Geopolitics dergisi yayın hayatına başladı",s:"AA"},
  {t:"Fidan'ın Rusya Ziyareti: Jeopolitik ve Ekonomik Önemi",s:"AA"},
  {t:"Küresel güç mücadelesinde Türk Devletleri Örgütü'nün etkisi artıyor",s:"Independent Türkçe"},
  {t:"ABD TDT'yi artık görmezden gelemez",s:"Yeni Şafak"},
  {t:"Rusya-Ukrayna Savaşı: Dünya Adasında Türklerin Jeopolitik Uyanışı",s:"Stratejik Düşünce Enstitüsü"},
  {t:"Zengezur Koridoru: Türkiye'nin Avrasya'ya açılan kapısının anahtarı",s:"AA"},
  {t:"Batı ve Rusya arasında jeopolitik mücadele: Özbekistan",s:"IQTISADI"},
  {t:"Putin'den Astana'ya kritik ziyaret",s:"Euronews"},
  {t:"Lavrov: Avrupadaki güvenlik sistemi yok edildi",s:"Sputnik Türkiye"},
  {t:"Ermenistan yol ayrımında: Avrupa vaatleri mi, Avrasya gerçekleri mi?",s:"AA"},
  {t:"Avrasya'nın geleceği ve ABD",s:"BD"},
  {t:"Türkiye'nin Avrasya stratejisi dünya basınında",s:"Yeni Şafak"},
  {t:"Azerbaycan-Ermenistan çatışmasında Türkiye, İran ve Rusya",s:"AA"},
  {t:"Kafkasya'nın enerji jeopolitiği: Rekabet ve iş birliği",s:"AA"},
  {t:"Hidro-Jeopolitik Diplomasi: Türkiye-Suriye-Irak Üçgeni",s:"ORSAM"},
  {t:"Aleksandr Dugin ve Rus Avrasyacılığı",s:"AA"},
  {t:"Avrasya'nın Balkanlar'ı",s:"BD"},
  {t:"Türkiye'nin gücü Atina'nın hesabını bozdu",s:"Yeni Şafak"},
  {t:"ATLANTİK BLOĞU, CENEVRE'DE ÇÖKTÜ",s:"Aydınlık"},
];

let ins = 0, skip = 0;
const stmt = db.prepare(`INSERT INTO contents (title, slug, type, summary, source_name, source_url, category_id, created_at, updated_at, ai_summarized, lang) VALUES (?, ?, 'haber', '', ?, ?, ?, ?, ?, 0, 'tr')`);

for (const a of articles) {
  const fakeUrl = 'gn-tr-' + hashUrl(a.t + a.s).substring(0, 16);
  if (existingUrls.has(fakeUrl)) { skip++; continue; }
  const cat = categoryFor(a.t);
  const slug = slugify(a.t);
  const now = new Date().toISOString();
  stmt.run(a.t, slug, a.s, fakeUrl, cat, now, now);
  existingUrls.add(fakeUrl);
  ins++;
}

console.log('TR: ' + ins + ' yeni, ' + skip + ' tekrar');
console.log('Toplam: ' + db.prepare('SELECT COUNT(*) as c FROM contents').get().c);
const rows = db.prepare('SELECT id, title, category_id, source_name FROM contents ORDER BY id DESC LIMIT 5').all();
const catNames = {1:'Siyaset',2:'Ekonomi',3:'Enerji',4:'Kültür',5:'Tarih',6:'Güvenlik',7:'Türk Dünyası',8:'Bilim&Tek'};
for (const r of rows) console.log('  #' + r.id + ' [' + (catNames[r.category_id]||'?') + '] ' + r.title + ' (' + r.source_name + ')');
db.close();
