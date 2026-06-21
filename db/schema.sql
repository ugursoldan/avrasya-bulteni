-- Avrasya Bülteni Veritabanı Şeması

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('haber','makale','bildiri','kitap','sempozyum','panel','rapor')),
  category_id INTEGER REFERENCES categories(id),
  summary TEXT NOT NULL,
  full_text TEXT,
  source_name TEXT,
  source_url TEXT,
  image_url TEXT,
  published_at DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS content_tags (
  content_id INTEGER REFERENCES contents(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, tag_id)
);

CREATE TABLE IF NOT EXISTS scanned_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss',
  last_scanned DATETIME,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS scan_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER REFERENCES scanned_sources(id),
  new_items INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_msg TEXT,
  scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contents_published ON contents(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_contents_type ON contents(type);
CREATE INDEX IF NOT EXISTS idx_contents_category ON contents(category_id);

-- Varsayılan kategoriler
INSERT OR IGNORE INTO categories (name, slug, description) VALUES
  ('Siyaset', 'siyaset', 'Avrasya coğrafyasında siyasi gelişmeler ve analizler'),
  ('Ekonomi', 'ekonomi', 'Avrasya ekonomisi, ticaret ve kalkınma'),
  ('Enerji', 'enerji', 'Enerji politikaları, boru hatları ve güvenlik'),
  ('Kültür', 'kultur', 'Avrasya kültürü, sanat ve toplum'),
  ('Tarih', 'tarih', 'Avrasya tarihi ve tarihsel analizler'),
  ('Güvenlik', 'guvenlik', 'Bölgesel güvenlik, jeopolitik ve strateji'),
  ('Türk Dünyası', 'turk-dunyasi', 'Türk Devletleri Teşkilatı ve Türk dünyası'),
  ('Bilim & Teknoloji', 'bilim-teknoloji', 'Avrasyada bilimsel gelişmeler');

-- Varsayılan tarama kaynakları
INSERT OR IGNORE INTO scanned_sources (url, name, type) VALUES
  ('https://news.google.com/rss/search?q=Eurasia&hl=tr&gl=TR&ceid=TR:tr', 'Google News (Eurasia)', 'rss'),
  ('https://news.google.com/rss/search?q=Avrasya&hl=tr&gl=TR&ceid=TR:tr', 'Google News (Avrasya)', 'rss');
