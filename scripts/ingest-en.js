const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('./db/data/avrasya.db');

const hashUrl = u => crypto.createHash('sha256').update(u).digest('hex');

function categoryFor(title) {
  const t = title.toLowerCase();
  if (/turkic|turk.world|turk.devlet/i.test(t)) return 7;
  if (/energy|oil|gas|petrol|pipeline/i.test(t)) return 3;
  if (/security|military|defense|nato|war|terrorism|nuclear|drill/i.test(t)) return 6;
  if (/economy|trade|market|finance|investment|gdp|sanction/i.test(t)) return 2;
  if (/culture|art/i.test(t)) return 4;
  if (/history|historical/i.test(t)) return 5;
  if (/science|tech|space|digital|climate|ai\b|artificial/i.test(t)) return 8;
  return 1;
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 200);
}

const existing = new Set(db.prepare('SELECT source_url FROM contents WHERE source_url IS NOT NULL').all().map(r => r.source_url));

const enArticles = [
  {t:"Fragmentation In The Global Energy Transition As Geopolitical Risks Surge",s:"Eurasia Review"},
  {t:"What Russia-Taliban Military Agreement Means for Eurasian Geopolitics",s:"Centre for Strategic and Contemporary Research"},
  {t:"China Wades Into The Geopolitics Of Iran – OpEd",s:"Eurasia Review"},
  {t:"Eurasia Maritime Geopolitical Risk 2026",s:"SpecialEurasia"},
  {t:"The Top Risks of 2026",s:"Eurasia Group"},
  {t:"Rewiring the South Caucasus: TRIPP and the New Geopolitics of Connectivity",s:"Carnegie Endowment"},
  {t:"Armenia as Russia's Last Stronghold in the South Caucasus",s:"Robert Lansing Institute"},
  {t:"Belarus Between Hormuz And Zangezur: Eurasian Security",s:"Eurasia Review"},
  {t:"How US Policy in the Middle East Targets Eurasian Integration",s:"SpecialEurasia"},
  {t:"RCEP Amidst Geopolitical Rivalry – OpEd",s:"Eurasia Review"},
  {t:"Terrorism in Eurasia: Geopolitical Risk Assessment 2026",s:"SpecialEurasia"},
  {t:"Liquid Institutionalism, Open-Source Geopolitics",s:"Eurasia Review"},
  {t:"Central Asia and US Strategy during the Middle East Crisis",s:"Modern Diplomacy"},
  {t:"Iran War Impact On ASEAN Economies And Geopolitics",s:"Eurasia Review"},
  {t:"The Fault Lines Of A New Middle East: The 2025-2026 US-Israel-Iran War",s:"Eurasia Review"},
  {t:"Russia's Nuclear Drills In The Arctic: New Geopolitics Of The Polar North",s:"Eurasia Review"},
  {t:"The Eurasian Pivot: Power, Connectivity, And Geopolitical Entropy In 2026",s:"Eurasia Review"},
  {t:"Hormuz And Bab Al-Mandeb: Geopolitics Of Twin Maritime Chokepoints",s:"Eurasia Review"},
  {t:"How Climate Change Is Reshaping Arctic Geopolitics",s:"Eurasia Review"},
  {t:"Tajikistan Geopolitical Risk Profile 2026",s:"SpecialEurasia"},
  {t:"Russia's river strategy is the next Eurasian power shift",s:"GIS Reports"},
  {t:"Geopolitical dreams and nightmares",s:"Australian Book Review"},
  {t:"The biggest geopolitical risks of 2026 revealed",s:"The Independent"},
  {t:"Greater Eurasia Podcast: w/ Chas Freeman – Trump Goes to Beijing",s:"Center for the National Interest"},
  {t:"US-Iran Tensions Expose New Faultlines In Mideast Geopolitics",s:"Eurasia Review"},
  {t:"Beyond Hormuz: The Eurasian implications of the Iran war",s:"Middle East Eye"},
  {t:"The Invisible Backbone: The Geopolitical Gravity Of Uranium",s:"Eurasia Review"},
  {t:"Red Sea Chokepoint: Geopolitics, Military Deterrence",s:"Eurasia Review"},
  {t:"Pakistan's High-Stakes GSP+ Test In Europe's Geopolitical Turn",s:"Eurasia Review"},
];

let ins = 0, skip = 0;
const insertStmt = db.prepare("INSERT INTO contents (title, slug, type, summary, source_name, source_url, category_id, created_at, updated_at, ai_summarized, lang) VALUES (?, ?, 'haber', ?, ?, ?, ?, ?, ?, 0, 'en')");

for (const a of enArticles) {
  const fakeUrl = 'gn-en-' + hashUrl(a.t + a.s).substring(0, 16);
  if (existing.has(fakeUrl)) { skip++; continue; }
  const cat = categoryFor(a.t);
  const slug = slugify(a.t);
  const now = new Date().toISOString();
  insertStmt.run(a.t, slug, '', a.s, fakeUrl, cat, now, now);
  existing.add(fakeUrl);
  ins++;
}

console.log('EN: ' + ins + ' yeni, ' + skip + ' tekrar');
console.log('Toplam: ' + db.prepare('SELECT COUNT(*) as c FROM contents').get().c);
db.close();
