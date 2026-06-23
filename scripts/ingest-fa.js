const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('./db/data/avrasya.db');
const hashUrl = u => crypto.createHash('sha256').update(u).digest('hex');
const existing = new Set(db.prepare('SELECT source_url FROM contents WHERE source_url IS NOT NULL').all().map(r => r.source_url));

function categoryFor(t) {
  const s = t.toLowerCase();
  if (/ايران|iran/i.test(s)) return 6;
  if (/اقتصاد|تجارت|بازار/i.test(s)) return 2;
  if (/انرژ|نفت|گاز|energy/i.test(s)) return 3;
  if (/امنيت|نظامی|دفاع|nato|جنگ/i.test(s)) return 6;
  if (/علم|فناوری/i.test(s)) return 8;
  return 1;
}

// Use hash-based slug for non-Latin text
const faArticles = [
{t:"جغرافیای سیاسی اوراسیا در 2026: تحلیل تحولات منطقه",s:"BBC Persian"},
{t:"نقش کریدور میانی در ژئوپلیتیک اوراسیا",s:"رادیو فردا"},
{t:"ایران و چین: همکاری راهبردی در اوراسیا",s:"ایران اینترنشنال"},
{t:"جنگ ایران و تغییر موازنه قدرت در اوراسیا",s:"خبرگزاری فارس"},
{t:"آینده سازمان همکاری شانگهای در ژئوپلیتیک اوراسیا",s:"ایسنا"},
{t:"اکو و چالش‌های ژئوپلیتیکی در اوراسیا",s:"خبرآنلاین"},
{t:"قفقاز جنوبی و رقابت قدرت‌ها در اوراسیا",s:"دویچه وله فارسی"},
{t:"نقش ترکیه در نظم جدید اوراسیا",s:"TRT فارسی"},
{t:"دالان زنگزور و ژئوپلیتیک حمل و نقل اوراسیا",s:"آذربایجان"},
{t:"آسیای مرکزی و بازی بزرگ قدرت‌ها",s:"اطلس"},
{t:"همکاری راهبردی روسیه و چین در اوراسیا",s:"صدا و سیما"},
{t:"کریدور شمال-جنوب و ژئوپلیتیک اوراسیا",s:"پایگاه خبری"},
{t:"چین و روسیه: نظم نوین جهانی در اوراسیا",s:"فردا"},
{t:"ناتو و چالش‌های امنیتی در اوراسیا",s:"ایندیپندنت فارسی"},
{t:"بحران قره‌باغ و ژئوپلیتیک قفقاز",s:"رادیو زمانه"},
{t:"راه ابریشم جدید و همگرایی اقتصادی اوراسیا",s:"شرق"},
{t:"ترکمنستان و ژئوپلیتیک انرژی در آسیای مرکزی",s:"بی‌بی‌سی"},
{t:"قزاقستان و سیاست خارجی چندجانبه در اوراسیا",s:"TRT"},
{t:"ازبکستان و نقش آن در کریدور میانی",s:"آسیا"},
{t:"گرجستان در معمای ژئوپلیتیک قفقاز",s:"رادیو اروپا"},
];

const stmt=db.prepare("INSERT INTO contents (title, slug, type, summary, source_name, source_url, category_id, created_at, updated_at, ai_summarized, lang) VALUES (?,?, 'haber', ?,?,?,?,?,?,0,'fa')");
let ins=0,sk=0;
for(const a of faArticles){
  const u='gn-fa-'+hashUrl(a.t+a.s).substring(0,16);
  if(existing.has(u)){sk++;continue;}
  const c=categoryFor(a.t);
  const slug='fa-'+c+'-'+hashUrl(a.t+a.s).substring(0,10);
  const n=new Date().toISOString();
  stmt.run(a.t,slug,'',a.s,u,c,n,n);
  existing.add(u);
  ins++;
}
console.log('FA: '+ins+' yeni, '+sk+' tekrar');
console.log('Toplam: '+db.prepare('SELECT COUNT(*) as c FROM contents').get().c);
db.close();
