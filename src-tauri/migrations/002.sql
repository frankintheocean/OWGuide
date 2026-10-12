-- 🌿 Add team and map evidence with database-level reference checks.
CREATE TABLE IF NOT EXISTS synergy (hero_id TEXT NOT NULL REFERENCES hero(id), ally_id TEXT NOT NULL REFERENCES hero(id), payload TEXT NOT NULL, PRIMARY KEY(hero_id,ally_id));
CREATE TABLE IF NOT EXISTS map_fit (hero_id TEXT NOT NULL REFERENCES hero(id), map_id TEXT NOT NULL REFERENCES game_map(id), payload TEXT NOT NULL, PRIMARY KEY(hero_id,map_id));
PRAGMA user_version = 2;
