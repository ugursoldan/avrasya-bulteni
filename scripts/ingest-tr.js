const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('./db/data/avrasya.db');

function hashUrl(url) {
  return crypto.createHash('sha256').update(url).digest('hex');
}

function categoryFor(title) {
  const t = title.toLowerCase();
  if (/türk dünyası|turkic|türk devlet/.test(t)) return 7;
  if (/enerji|petrol|doğalgaz/.test(t)) return 3;
  if (/güvenlik|askeri|savunma|nato|savaş/.test(t)) return 6;
  if (/ekonomi|ticaret|borsa|gyo|finans/.test(t)) return 2;
  if (/kültür/.test(t)) return 4;
  if (/tarih/.test(t)) return 5;
  return 1;
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\- ]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 200);
}

const existing = db.prepare("SELECT source_url FROM contents WHERE source_url IS NOT NULL").all();
const existingUrls = new Set(existing.map(r => r.source_url));

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
  {t:"2025'te Rusya-Azerbaycan İlişkileri: Avrasya Jeopolitiğinde Fay Hattı",s:"ANKASAM"},
  {t:"Orta Koridor Türkiye'yi Avrasya ticaretinin merkezine taşıyor",s:"TRT Haber"},
  {t:"Büyük Avrasya ittifakı",s:"Star"},
  {t:"Küresel jeopolitik geçiş dönemi ve Türkiye",s:"AA Analiz"},
  {t:"Ağaoğlu Avrasya GYO halka arz sonuçları",s:"Bloomberg HT"},
  {t:"Orta Asya: Avrasya'daki fay hatlarının birleştiği nokta",s:"Independent Türkçe"},
  {t:"Bülent Erandaç - Avrasya'da Türkiye-Çin Tahkimatı",s:"Habertürk"},
  {t:"Güney Kafkasya'da esen barış rüzgarları",s:"AA"},
  {t:"Global Geopolitics dergisi yayın hayatına başladı",s:"AA"},
  {t:"Fidan'ın Rusya Ziyareti: Jeopolitik ve Ekonomik Önemi",s:"AA"},
  {t:"Küresel güç mücadelesinde Türk Devletleri Örgütü'nün etkisi artıyor",s:"Independent Türkçe"},
  {t:"ABD TDT'yi artık görmezden gelemez",s:"Yeni Şafak"},
  {t:"Rusya-Ukrayna Savaşı: Dünya Adasında Türklerin Jeopolitik Uyanışı",s:"Stratejik Düşünce Enstitüsü"},
  {t:"Zengezur Koridoru: Türkiye'nin Avrasya'ya açılan kapısı",s:"AA"},
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
  {t:"Türkmenbaşı limanı 2021'de 11 milyon ton kargo elleçledi",s:"Turkmenportal"},
  {t:"Orta Asya'da doğru projelerle doğru hedeflere",s:"Star"},
  {t:"Paşinyan: Ermenistan'daki seçimlerin jeopolitik bağlamı yok",s:"Sputnik Türkiye"},
  {t:"DÜNYA-MER'den tarihi etkinlik: Dünyada Güvenlik ve NATO Konferansı",s:"Yeni Şafak"},
  {t:"SPK'dan Ağaoğlu Avrasya GYO halka arzına onay",s:"Bloomberg HT"},
];

let ins = 0, skip = 0;
const insertStmt = db.prepare("INSERT INTO contents (title, slug, type, summary, source_name, source_url, category_id, created_at, updated_at, ai_summarized, lang) VALUES (?, ?, 'haber', ?, ?, ?, ?, ?, ?, 0, 'tr')");

for (const a of articles) {
  const fakeUrl = 'gn-tr-' + hashUrl(a.t + a.s).substring(0, 16);
  if (existingUrls.has(fakeUrl)) { skip++; continue; }
  const catId = categoryFor(a.t);
  const slug = slugify(a.t);
  const now = new Date().toISOString();
  insertStmt.run(a.t, slug, '', a.s, fakeUrl, catId, now, now);
  existingUrls.add(fakeUrl);
  ins++;
}

console.log('TR: ' + ins + ' yeni eklendi, ' + skip + ' tekrar');
console.log('DB toplam: ' + db.prepare('SELECT COUNT(*) as c FROM contents').get().c);
db.close();
