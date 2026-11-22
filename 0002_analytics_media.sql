CREATE TABLE IF NOT EXISTS visit_days (day TEXT NOT NULL, visitor_id TEXT NOT NULL, PRIMARY KEY (day, visitor_id));
CREATE TABLE IF NOT EXISTS daily_views (day TEXT NOT NULL, path TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, path));
CREATE TABLE IF NOT EXISTS daily_referrers (day TEXT NOT NULL, domain TEXT NOT NULL, visits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, domain));
CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, mime TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')), data TEXT NOT NULL, created_at INTEGER NOT NULL);
