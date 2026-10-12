"""🔬 Check actual desktop SQLite content and personal-data preservation on a runner."""
import json, pathlib, sqlite3, sys
path=pathlib.Path(sys.argv[1]); root=pathlib.Path(__file__).resolve().parents[1]
if not path.is_file():raise SystemExit('Desktop database is missing')
fixture=json.loads((root/'tests/user-fixture.json').read_text())
seed=json.loads((root/'src/data/content.json').read_text())
with sqlite3.connect(path) as db:
 if db.execute('PRAGMA user_version').fetchone()[0]!=2:raise SystemExit('Unexpected migration version')
 if db.execute('SELECT count(*) FROM hero').fetchone()[0]!=len(seed['heroes']):raise SystemExit('Desktop seed roster is incomplete')
 if db.execute('PRAGMA foreign_key_check').fetchall():raise SystemExit('Foreign-key check failed')
 if '--seed-personal' in sys.argv:
  db.execute('INSERT INTO user_state VALUES(1,1,?) ON CONFLICT(id) DO UPDATE SET revision=1,payload=excluded.payload',(json.dumps(fixture),))
 if '--check-personal' in sys.argv:
  row=db.execute('SELECT payload FROM user_state WHERE id=1').fetchone()
  if not row or json.loads(row[0])!=fixture:raise SystemExit('Favorites, notes, settings or progress changed during maintenance')
 db.commit();db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
print('Desktop database content and requested personal-data checks passed.')
