const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('./db/data/avrasya.db');
const hashUrl = u => crypto.createHash('sha256').update(u).digest('hex');
const existing = new Set(db.prepare('SELECT source_url FROM contents WHERE source_url IS NOT NULL').all().map(r => r.source_url));

function categoryFor(t) {
  if (/一带一路|belt.road|silk.road/i.test(t)) return 2;
  if (/能源|石油|天然气|航运|供应链/i.test(t)) return 3;
  if (/安全|军事|国防|危机|战争/i.test(t)) return 6;
  if (/经济|贸易|市场|投资|金融|走廊|发展/i.test(t)) return 2;
  if (/文化/i.test(t)) return 4;
  if (/科技|数字/i.test(t)) return 8;
  return 1;
}

const articles = [
{t:"亚欧集装箱航运趋紧 抵消了地缘政治乐观情绪",s:"新浪财经"},
{t:"南高加索小国亚美尼亚牵动多方目光",s:"环球时报"},
{t:"加快推进跨里海国际运输走廊建设",s:"zgjtb.com"},
{t:"伊朗战火逼近中亚，中国为何加速打通陆上能源命脉",s:"观察者"},
{t:"从欧亚到亚欧，变的是什么",s:"央视网"},
{t:"地缘政治挑战为一带一路牵手中间走廊创造新机遇",s:"中国日报网"},
{t:"跨年特稿：亚欧在变乱交织中谋求和平与发展",s:"新华网"},
{t:"从地缘政治的视角审视大棋局",s:"北京大学"},
{t:"华盛顿中亚美国峰会：重塑欧亚大陆地缘格局",s:"哈通社"},
{t:"地缘政治趋势对亚洲下一阶段增长的影响",s:"Macquarie"},
{t:"美国试水走廊战略 重塑亚洲地缘政治",s:"观察者"},
{t:"中俄应共同定义新欧亚",s:"观察者网"},
{t:"一带一路唯一中欧直通走廊：连接繁荣",s:"新华社"},
{t:"特朗普中亚战略的重塑与局限",s:"新华社"},
{t:"霍尔木兹海峡危机下中欧班列重构亚欧供应链",s:"澎湃新闻"},
{t:"欧亚过渡地带的地缘政治实验：纳卡地区",s:"清华大学"},
{t:"欧盟非常需要这条中间走廊",s:"观察者网"},
{t:"印欧经济走廊暴露美国全球地缘战略意图",s:"国际合作中心"},
{t:"以三大思维深耕欧亚研究 为大國战略提供学理支撑",s:"中国社会科学网"},
{t:"维文：地缘政治环境复杂 亚欧须加强联系保障和平",s:"联合早报"},
];

const stmt=db.prepare("INSERT INTO contents (title, slug, type, summary, source_name, source_url, category_id, created_at, updated_at, ai_summarized, lang) VALUES (?,?, 'haber',?,?,?,?,?,?,0,'zh')");
let ins=0,sk=0;
for(const a of articles){
  const u='gn-zh-'+hashUrl(a.t+a.s).substring(0,16);
  if(existing.has(u)){sk++;continue;}
  const c=categoryFor(a.t);
  const slug='zh-'+c+'-'+hashUrl(a.t+a.s).substring(0,10);
  const n=new Date().toISOString();
  stmt.run(a.t,slug,'',a.s,u,c,n,n);
  existing.add(u);
  ins++;
}
console.log('ZH: '+ins+' yeni, '+sk+' tekrar');
const total=db.prepare('SELECT COUNT(*) as c FROM contents').get().c;
console.log('DB toplam: '+total);
db.close();
