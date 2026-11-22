PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  placement TEXT NOT NULL CHECK (placement IN ('shop', 'training')),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'CYBERSÉCURITÉ',
  description TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  old_price REAL,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'FCFA')),
  external_url TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  external_url TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS visitors (
  visitor_id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 1,
  last_page TEXT NOT NULL,
  referrer_domain TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_client_time ON admin_login_attempts(client_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_visitors_last_seen ON visitors(last_seen DESC);

INSERT OR IGNORE INTO products
  (id, placement, name, category, description, price, old_price, currency, external_url, featured, active, updated_at)
VALUES
  ('guide-djaiii', 'shop', 'Le guide du djaiii', 'GUIDE PRATIQUE', 'Les 5 options utilisées par LeZachh, expliquées avec des captures réelles : 21 pages claires, un registre de suivi et une checklist.', 20.5, 34.28, 'USD', 'https://for-the-business.mychariow.shop/prd_g7x91eth', 1, 1, unixepoch()),
  ('guide-mobile', 'shop', 'Ne te fais plus pirater ni arnaquer', 'SÉCURITÉ MOBILE', 'Le guide pratique pour protéger ton téléphone et tes comptes contre le piratage et les arnaques.', 6.19, 10.17, 'USD', 'https://for-the-business.mychariow.shop/prd_7m4s1c1d', 0, 1, unixepoch()),
  ('guide-wifi', 'shop', 'Piratage & Sécurité Wi-Fi', 'SÉCURITÉ WI-FI', 'Guide complet pour débutant et professionnel : comprendre les failles des réseaux Wi-Fi et mieux les protéger.', 10.17, 27.39, 'USD', 'https://for-the-business.mychariow.shop/prd_hypry7', 0, 1, unixepoch()),
  ('guide-anonymat', 'shop', 'Dark Web & Anonymat', 'VIE PRIVÉE', 'Comprendre le Dark Web, y accéder en sécurité et protéger sa vie privée en ligne.', 10.17, 20.5, 'USD', 'https://for-the-business.mychariow.shop/dw-et-anon', 0, 1, unixepoch()),
  ('formation-cyber', 'training', 'Formation cybersécurité & hacking éthique', 'FORMATION PROFESSIONNELLE', 'Apprentissage accompagné, en ligne ou en présentiel, dans un cadre éthique et pédagogique.', 50000, NULL, 'FCFA', 'https://linktr.ee/LeZachh01', 0, 1, unixepoch());

INSERT OR IGNORE INTO site_settings (key, value, updated_at)
VALUES ('background_url', '/assets/lezachh-cyber-portrait.jpg', unixepoch());
