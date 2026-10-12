-- 🗃️ App content and personal data live in separate tables.
CREATE TABLE IF NOT EXISTS user_state (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS content_package (id INTEGER PRIMARY KEY CHECK(id IN (1,2)), version TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS hero (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source(id), payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ability (id TEXT NOT NULL, hero_id TEXT NOT NULL REFERENCES hero(id) ON DELETE CASCADE, payload TEXT NOT NULL, PRIMARY KEY(hero_id,id));
CREATE TABLE IF NOT EXISTS game_map (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES source(id), payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS matchup (hero_id TEXT NOT NULL REFERENCES hero(id), enemy_id TEXT NOT NULL REFERENCES hero(id), payload TEXT NOT NULL, PRIMARY KEY(hero_id,enemy_id));
PRAGMA user_version = 1;
