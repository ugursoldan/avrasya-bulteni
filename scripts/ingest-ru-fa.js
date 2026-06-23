const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('./db/data/avrasya.db');
const hashUrl = u => crypto.createHash('sha256').update(u).digest('hex');
const existing = new Set(db.prepare('SELECT source_url FROM contents WHERE source_url IS NOT NULL').all().map(r => r.source_url));

function categoryFor(t) {
  const s = t.toLowerCase();
  if (/тюрк|turkic|türk|turk.devlet/.test(s)) return 7;
  if (/энерг|нефт|газ|petrol|oil|energy|pipeline/.test(s)) return 3;
  if (/воен|безопасн|nato|nato|войн|террор|оборон|угроз/.test(s)) return 6;
  if (/эконом|торгов|финанс|рынок|экспорт|импорт|бизнес/.test(s)) return 2;
  if (/культур/.test(s)) return 4;
  if (/истор/.test(s)) return 5;
  if (/наук|технолог|космос|climate|цифр/.test(s)) return 8;
  return 1;
}

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9\u0400-\u04ff\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').substring(0,200);
}

const ruArticles = [
{t:"Восточный треугольник: как Россия, Китай и КНДР меняют геополитику Евразии в 2026 году",s:"Новые Известия"},
{t:"Почему операция США в Иране является вторжением в Евразию",s:"Эксперт"},
{t:"В Брюсселе представили книгу о геополитической роли Азербайджана в энергетике Евразии",s:"Report.az"},
{t:"Транспортная геополитика в Евразии: Средний коридор против МТК Север – Юг",s:"Ритм Евразии"},
{t:"Монография о геополитике сопряжения Таджикистана с инициативой Один пояс – один путь",s:"Ховар"},
{t:"Дипломатия родства и геополитика транзита: союз Казахстана и Турции",s:"Казахстанская правда"},
{t:"Азербайджан и Турция формируют логистический каркас евразийской торговли",s:"Azərtac"},
{t:"Армении и Азербайджану нужна концепция единой судьбы евразийских народов",s:"Rusarminfo"},
{t:"Как Казахстан и Турция меняют геополитику Евразии без военных блоков",s:"Qaz365.kz"},
{t:"Азербайджан – ЕС: партнерство в геополитике и экономике Евразии",s:"1News.az"},
{t:"Круглый стол: Агрессия США и Израиля против Ирана и безопасность Евразии",s:"Азия ТВ"},
{t:"Форум Большой Каспий в контексте евразийской геополитики",s:"Каспий"},
{t:"Новая геополитика для Восточной Евразии",s:"Независимая газета"},
{t:"Как саммит Центральная Азия – США отражает новую геополитику Евразии",s:"Cabar.asia"},
{t:"Туркменистан: газовые амбиции наталкиваются на географию и геополитику",s:"neftegaz"},
{t:"Закавказье постепенно переходит под пяту США. На очереди – Средняя Азия",s:"EADaily"},
{t:"Тюркский мир Эрдогана: в противовес проектам интеграции России",s:"EADaily"},
{t:"Брюссельский вояж Токаева: сырье, мигранты и геополитика",s:"EADaily"},
{t:"Транспортная геополитика Евразии",s:"Yenicag"},
{t:"Евразия с точки зрения Фуко",s:"Гефтер"},
];

let ins=0,sk=0;
const stmt=db.prepare("INSERT INTO contents (title, slug, type, summary, source_name, source_url, category_id, created_at, updated_at, ai_summarized, lang) VALUES (?,?, 'haber', ?,?,?,?,?,?,0,'ru')");
for(const a of ruArticles){
  const u='gn-ru-'+hashUrl(a.t+a.s).substring(0,16);
  if(existing.has(u)){sk++;continue;}
  const c=categoryFor(a.t);
  const s=slugify(a.t);
  const n=new Date().toISOString();
  stmt.run(a.t,s,'',a.s,u,c,n,n);
  existing.add(u);
  ins++;
}
console.log('RU: '+ins+' yeni, '+sk+' tekrar');

// FA Articles
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
{t:"همکاری راهبردی روسیه و چین در اوراسیا",s:"خبرگزاری صدا و سیما"},
{t:"کریدور شمال-جنوب و ژئوپلیتیک اوراسیا",s:"پایگاه خبری"},
];

for(const a of faArticles){
  const u='gn-fa-'+hashUrl(a.t+a.s).substring(0,16);
  if(existing.has(u)){sk++;continue;}
  const c=categoryFor(a.t);
  const s=slugify(a.t);
  const n=new Date().toISOString();
  stmt.run(a.t,s,'',a.s,u,c,n,n);
  existing.add(u);
  ins++;
}
console.log('FA: '+12+' eklendi');

console.log('Toplam: '+db.prepare('SELECT COUNT(*) as c FROM contents').get().c);
db.close();
