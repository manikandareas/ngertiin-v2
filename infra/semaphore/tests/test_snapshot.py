import json
from pathlib import Path
import sqlite3
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from snapshot import snapshot


class SnapshotTests(unittest.TestCase):
    def test_restore_wal_database_keys_and_unresolved_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data, config = root / 'original', root / 'configuration'
            data.mkdir()
            config.mkdir()
            (config / 'config.json').write_text(json.dumps({'access_key_encryption': 'fixture-key'}))
            (data / 'releases').mkdir()
            (data / 'releases/active.json').write_text('{"stage":"migration-dispatch"}')
            with sqlite3.connect(data / 'database.sqlite') as conn:
                conn.execute('PRAGMA journal_mode=WAL')
                conn.execute('CREATE TABLE project (name text)')
                conn.execute("INSERT INTO project VALUES ('Ngerti.in Production')")
                conn.commit()
                path = snapshot(data, config, root / 'snapshot.tar.gz')
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
                restored = root / 'restored'
                with tarfile.open(path) as archive:
                    # Archive created by this test, with fixed paths only.
                    archive.extractall(restored)
                with sqlite3.connect(restored / 'data/database.sqlite') as recovered:
                    self.assertEqual(recovered.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
                    self.assertEqual(recovered.execute('SELECT name FROM project').fetchone()[0], 'Ngerti.in Production')
                self.assertEqual((restored / 'config/config.json').read_bytes(), (config / 'config.json').read_bytes())
                self.assertEqual((restored / 'data/releases/active.json').read_bytes(), (data / 'releases/active.json').read_bytes())


if __name__ == '__main__':
    unittest.main()
