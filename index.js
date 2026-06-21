const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');

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

// Ana sayfa içeriği - son eklenenler
app.get('/api/contents', (req, res) => {
  const { type, category, limit = 20, offset = 0 } = req.query;
  let sql = `
    SELECT c.*, cat.name as category_name, cat.slug as category_slug
    FROM contents c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE 1=1
  `;
  const params = [];

  if (type) {
    sql += ' AND c.type = ?';
    params.push(type);
  }
  if (category) {
    sql += ' AND cat.slug = ?';
    params.push(category);
  }

  sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const rows = db.prepare(sql).all(...params);

  const getTags = db.prepare(`
    SELECT t.name, t.slug FROM tags t
    JOIN content_tags ct ON t.id = ct.tag_id
    WHERE ct.content_id = ?
  `);

  const result = rows.map(row => ({
    ...row,
    tags: getTags.all(row.id)
  }));

  res.json(result);
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

  let sql, params;
  const langFilter = req.query.lang || '';
  if (search) {
    sql = `SELECT c.*, cat.name as category_name
      FROM contents c LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.title LIKE ?${langFilter ? ' AND c.lang = ?' : ''} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
    params = [`%${search}%`];
    if (langFilter) params.push(langFilter);
    params.push(limit, offset);
  } else {
    sql = `SELECT c.*, cat.name as category_name
      FROM contents c LEFT JOIN categories cat ON c.category_id = cat.id
      ${langFilter ? 'WHERE c.lang = ?' : ''} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
    params = langFilter ? [langFilter, limit, offset] : [limit, offset];
  }
  const rows = db.prepare(sql).all(...params);
  let totalSql, totalParams;
  if (search && langFilter) {
    totalSql = `SELECT COUNT(*) as c FROM contents WHERE title LIKE ? AND lang = ?`;
    totalParams = [`%${search}%`, langFilter];
  } else if (search) {
    totalSql = `SELECT COUNT(*) as c FROM contents WHERE title LIKE ?`;
    totalParams = [`%${search}%`];
  } else if (langFilter) {
    totalSql = `SELECT COUNT(*) as c FROM contents WHERE lang = ?`;
    totalParams = [langFilter];
  } else {
    totalSql = `SELECT COUNT(*) as c FROM contents`;
    totalParams = [];
  }
  const total = db.prepare(totalSql).get(...totalParams).c;

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
    const scanner = require('./scripts/scanner');
    await scanner.runScan();
    
    // Özet çıkarma
    const summarizePath = path.join(__dirname, 'scripts', 'railway-news.js');
    const child = spawn('node', [summarizePath], {
      env: { ...process.env, DB_PATH: process.env.DB_PATH || path.join(__dirname, 'db', 'data', 'avrasya.db') }
    });
    
    let output = '';
    child.stdout.on('data', d => output += d.toString());
    child.stderr.on('data', d => output += d.toString());
    
    await new Promise((resolve, reject) => {
      child.on('close', code => {
        if (code !== 0) reject(new Error(`Özet çıkarma hatası (exit=${code}): ${output}`));
        else resolve(output);
      });
      child.on('error', reject);
    });
    
    console.log(`[CRON] Tamamlandı:\n${output}`);
    res.json({ status: 'ok', message: 'Tarama + özet çıkarma tamamlandı', output });
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
// Başlat
// ----------------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌍 Avrasya Bülteni http://localhost:${PORT}`);
});
