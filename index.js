const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const cron = require('node-cron');

let db;
try {
  db = require('./db');
} catch (err) {
  console.error('[STARTUP] DB hatası:', err.message);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Explicit static routes for common assets (bypass catch-all)
app.get('/ihu-logo.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ihu-logo.jpg'));
});

// ----------------------------------------------------------------
// Public API Rotaları
// ----------------------------------------------------------------

// Ana sayfa içeriği - son eklenenler (sayfalı)
app.get('/api/contents', (req, res) => {
  const { type, category, limit = 20, offset = 0 } = req.query;
  const l = parseInt(limit), o = parseInt(offset);

  let where = ' WHERE 1=1';
  const params = [];
  if (type) { where += ' AND c.type = ?'; params.push(type); }
  if (category) { where += ' AND cat.slug = ?'; params.push(category); }

  const countSql = `SELECT COUNT(*) as total FROM contents c LEFT JOIN categories cat ON c.category_id = cat.id${where}`;
  const { total } = db.prepare(countSql).get(...params);

  const dataSql = `
    SELECT c.*, cat.name as category_name, cat.slug as category_slug
    FROM contents c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${where}
    ORDER BY c.id DESC LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(dataSql).all(...params, l, o);

  const getTags = db.prepare(`
    SELECT t.name, t.slug FROM tags t
    JOIN content_tags ct ON t.id = ct.tag_id
    WHERE ct.content_id = ?
  `);

  const result = rows.map(row => ({
    ...row,
    tags: getTags.all(row.id)
  }));

  res.json({ rows: result, total, limit: l, offset: o });
});

// Tek içerik detayı
app.get('/api/contents/:slug', (req, res) => {
  const row = db.prepare(`
    SELECT c.*, cat.name as category_name, cat.slug as category_slug
    FROM contents c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.slug = ?
  `).get(req.params.slug);

  if (!row) return res.status(404).json({ error: 'İçerik bulunamadı' });

  const tags = db.prepare(`
    SELECT t.name, t.slug FROM tags t
    JOIN content_tags ct ON t.id = ct.tag_id
    WHERE ct.content_id = ?
  `).all(row.id);

  res.json({ ...row, tags });
});

// Kategoriler
app.get('/api/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM contents WHERE category_id = c.id) as content_count
    FROM categories c
    ORDER BY c.name
  `).all();
  res.json(rows);
});

// ----------------------------------------------------------------
// Admin API Rotaları
// ----------------------------------------------------------------

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'avrasya2024';

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth) {
    const b64 = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [u, p] = b64.split(':');
    if (u === ADMIN_USER && p === ADMIN_PASS) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Avrasya Bülteni Admin"');
  res.status(401).json({ error: 'Yetkisiz erişim' });
}

// Tüm içerikler (admin)
app.get('/api/admin/contents', adminAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const langFilter = req.query.lang || '';
  const typeFilter = req.query.type || '';
  const categoryFilter = req.query.category_id || '';
  const dateFrom = req.query.date_from || '';
  const dateTo = req.query.date_to || '';
  const dateField = req.query.date_field || 'published'; // 'published' veya 'created'

  // WHERE koşullarını dinamik oluştur
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('c.title LIKE ?');
    params.push(`%${search}%`);
  }
  if (langFilter) {
    conditions.push('c.lang = ?');
    params.push(langFilter);
  }
  if (typeFilter) {
    conditions.push('c.type = ?');
    params.push(typeFilter);
  }
  if (categoryFilter) {
    conditions.push('c.category_id = ?');
    params.push(parseInt(categoryFilter));
  }
  if (dateFrom) {
    conditions.push(dateField === 'created' ? 'c.created_at >= ?' : 'c.published_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(dateField === 'created' ? 'c.created_at <= ?' : 'c.published_at <= ?');
    params.push(dateTo);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const sql = `SELECT c.*, cat.name as category_name
    FROM contents c LEFT JOIN categories cat ON c.category_id = cat.id
    ${where} ORDER BY c.id DESC LIMIT ? OFFSET ?`;
  const rows = db.prepare(sql).all(...params, limit, offset);

  const totalSql = `SELECT COUNT(*) as c FROM contents c ${where}`;
  const total = db.prepare(totalSql).get(...params).c;

  res.json({ rows, total, page, totalPages: Math.ceil(total / limit) });
});

// Tek içerik getir (admin)
app.get('/api/admin/contents/:id', adminAuth, (req, res) => {
  const row = db.prepare(`SELECT c.*, cat.name as category_name, cat.slug as category_slug
    FROM contents c LEFT JOIN categories cat ON c.category_id = cat.id WHERE c.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Bulunamadı' });
  const tags = db.prepare(`SELECT t.name, t.slug FROM tags t
    JOIN content_tags ct ON t.id = ct.tag_id WHERE ct.content_id = ?`).all(row.id);
  res.json({ ...row, tags });
});

// İçerik güncelle (admin)
app.put('/api/admin/contents/:id', adminAuth, (req, res) => {
  const { title, summary, type, category_id, source_name, source_url, published_at, full_text, ai_summarized, lang } = req.body;
  const existing = db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bulunamadı' });

  db.prepare(`UPDATE contents SET
    title = COALESCE(?, title),
    summary = COALESCE(?, summary),
    type = COALESCE(?, type),
    category_id = COALESCE(?, category_id),
    source_name = COALESCE(?, source_name),
    source_url = COALESCE(?, source_url),
    published_at = COALESCE(?, published_at),
    full_text = COALESCE(?, full_text),
    ai_summarized = COALESCE(?, ai_summarized),
    lang = COALESCE(?, lang),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`).run(title, summary, type, category_id, source_name, source_url, published_at, full_text, ai_summarized, lang, req.params.id);

  res.json({ ok: true });
});

// İçerik sil (admin)
app.delete('/api/admin/contents/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM contents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Manuel içerik ekle (admin)
app.post('/api/admin/contents', adminAuth, (req, res) => {
  const { title, summary, type, category_id, source_name, source_url, published_at, full_text, lang } = req.body;
  if (!title) return res.status(400).json({ error: 'Başlık gerekli' });
  const slug = title.toLowerCase().replace(/[^a-z0-9çğıöşüa]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  const info = db.prepare(`INSERT INTO contents (title, slug, type, category_id, summary, full_text, source_name, source_url, published_at, lang, ai_summarized)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`).run(
    title, slug, type || 'haber', category_id || null, summary || '', full_text || '', source_name || '', source_url || '', published_at || null, lang || 'tr'
  );
  res.json({ ok: true, id: info.lastInsertRowid });
});

// Tarama kaynakları (admin)
app.get('/api/admin/sources', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM scanned_sources ORDER BY name').all();
  res.json(rows);
});

app.post('/api/admin/sources', adminAuth, (req, res) => {
  const { url, name, type } = req.body;
  if (!url || !name) return res.status(400).json({ error: 'url ve name gerekli' });
  try {
    db.prepare('INSERT INTO scanned_sources (url, name, type) VALUES (?, ?, ?)').run(url, name, type || 'rss');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/admin/sources/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM scanned_sources WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Tarama başlat (admin)
app.post('/api/admin/scan', adminAuth, async (req, res) => {
  res.json({ ok: true, message: 'Tarama başlatıldı' });
  try {
    const scanner = require('./scripts/scanner');
    await scanner.runScan();
    console.log('📡 Tarama tamamlandı');
  } catch (e) {
    console.error('📡 Tarama hatası:', e.message);
  }
});

// ----------------------------------------------------------------
// İstatistikler
// ----------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const stats = db.prepare(`SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN type = 'haber' THEN 1 ELSE 0 END) as haber,
    SUM(CASE WHEN type = 'makale' THEN 1 ELSE 0 END) as makale,
    SUM(CASE WHEN type = 'bildiri' THEN 1 ELSE 0 END) as bildiri,
    SUM(CASE WHEN type = 'kitap' THEN 1 ELSE 0 END) as kitap,
    SUM(CASE WHEN type = 'sempozyum' THEN 1 ELSE 0 END) as sempozyum,
    SUM(CASE WHEN type = 'panel' THEN 1 ELSE 0 END) as panel,
    SUM(CASE WHEN type = 'rapor' THEN 1 ELSE 0 END) as rapor
  FROM contents`).get();

  const lastScan = db.prepare(`SELECT scanned_at FROM scan_log ORDER BY scanned_at DESC LIMIT 1`).get();

  res.json({ ...stats, lastScan: lastScan?.scanned_at || null });
});

// ----------------------------------------------------------------
// Seed endpoint (veritabanını sıfırla ve doldur)
app.post('/api/seed', express.raw({ type: 'application/sql', limit: '10mb' }), (req, res) => {
  try {
    const sql = req.body.toString('utf-8');
    const dbPath = process.env.DB_PATH || path.join(__dirname, 'db', 'data', 'avrasya.db');
    // Close existing connection, wipe DB file, reopen
    db.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    // Reuse the module's db — it will recreate on next require
    // Instead, reopen manually:
    const Database = require('better-sqlite3');
    const freshDb = new Database(dbPath);
    freshDb.pragma('journal_mode=WAL');
    freshDb.pragma('foreign_keys=OFF');
    // Register unistr() function for seed compatibility
    freshDb.function('unistr', (s) => {
      if (!s) return s;
      return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
    });
    freshDb.exec(sql);
    res.json({ ok: true, message: 'Seed completed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Cron endpoint (cron-job.org tarafından tetiklenir)
// ----------------------------------------------------------------
app.get('/api/cron', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.CRON_SECRET && secret !== 'avrasya2024') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GitHub JSON'dan haber çek + çevir + DB'ye ekle
    const scanCmd = spawn('node', [path.join(__dirname, 'scripts', 'scanner.js')], {
      env: { ...process.env, SCAN_MAX_ITEMS: req.query.limit || '5' },
      cwd: __dirname,
      stdio: 'pipe'
    });

    let output = '';
    scanCmd.stdout.on('data', d => output += d.toString());
    scanCmd.stderr.on('data', d => output += d.toString());

    const exitCode = await new Promise((resolve, reject) => {
      scanCmd.on('close', resolve);
      scanCmd.on('error', reject);
    });

    if (exitCode !== 0) {
      console.error(`[CRON] Scanner hatası (exit=${exitCode}):\n${output}`);
      return res.status(500).json({ status: 'error', error: `Scanner hatası (exit=${exitCode})`, output });
    }

    console.log(`[CRON] Scanner tamamlandı:\n${output}`);
    res.json({ status: 'ok', message: 'Tarama tamamlandı', output });
  } catch (e) {
    console.error(`[CRON] Hata:`, e);
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// ----------------------------------------------------------------
// Admin sayfası (catch-all'dan ÖNCE olmalı, auth yok — JS fetch'leri auth'lu)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Anasayfa (catch-all)
// ----------------------------------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------------------------------------------------------
// Cron Schedule — her gün 07:00 UTC = 10:00 TSİ
// ----------------------------------------------------------------
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 7 * * *';
cron.schedule(CRON_SCHEDULE, async () => {
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[CRON:${ts}] Zamanlı tarama başlıyor...`);

  try {
    const scanCmd = spawn('node', [path.join(__dirname, 'scripts', 'scanner.js')], {
      env: { ...process.env, SCAN_MAX_ITEMS: process.env.SCAN_MAX_ITEMS || '5' },
      cwd: __dirname,
      stdio: 'pipe'
    });

    let output = '';
    scanCmd.stdout.on('data', d => output += d.toString());
    scanCmd.stderr.on('data', d => output += d.toString());

    const exitCode = await new Promise((resolve, reject) => {
      scanCmd.on('close', resolve);
      scanCmd.on('error', reject);
    });

    if (exitCode !== 0) {
      console.error(`[CRON:${ts}] Scanner hatası (exit=${exitCode}):\n${output}`);
    } else {
      console.log(`[CRON:${ts}] Scanner tamamlandı:\n${output}`);
    }
  } catch (e) {
    console.error(`[CRON:${ts}] Hata:`, e.message);
  }
});

// ----------------------------------------------------------------
// Başlat
// ----------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌍 Avrasya Bülteni http://localhost:${PORT}`);
  console.log(`⏰ Cron schedule: ${CRON_SCHEDULE} (${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })} TSİ)`);
});
console.log('TEST');
