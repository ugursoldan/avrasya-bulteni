const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------------------
// API Rotaları
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

  sql += ' ORDER BY c.published_at DESC, c.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const rows = db.prepare(sql).all(...params);

  // Her içerik için tagleri getir
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

// İstatistikler
app.get('/api/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN type = 'haber' THEN 1 ELSE 0 END) as haber,
      SUM(CASE WHEN type = 'makale' THEN 1 ELSE 0 END) as makale,
      SUM(CASE WHEN type = 'bildiri' THEN 1 ELSE 0 END) as bildiri,
      SUM(CASE WHEN type = 'kitap' THEN 1 ELSE 0 END) as kitap,
      SUM(CASE WHEN type = 'sempozyum' THEN 1 ELSE 0 END) as sempozyum,
      SUM(CASE WHEN type = 'panel' THEN 1 ELSE 0 END) as panel,
      SUM(CASE WHEN type = 'rapor' THEN 1 ELSE 0 END) as rapor
    FROM contents
  `).get();

  const lastScan = db.prepare(`
    SELECT scanned_at FROM scan_log ORDER BY scanned_at DESC LIMIT 1
  `).get();

  res.json({ ...stats, lastScan: lastScan?.scanned_at || null });
});

// ----------------------------------------------------------------
// Anasayfa rotası
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
