#!/usr/bin/env python3
"""Consistent local snapshot; copy the resulting private archive off the VPS."""
import argparse
import fcntl
import os
from pathlib import Path
import shutil
import sqlite3
import tarfile
import tempfile


def snapshot(data, config, output):
    os.umask(0o077)
    data, config, output = Path(data), Path(config), Path(output)
    (data / 'releases').mkdir(exist_ok=True)
    with (data / 'releases/production.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'data').mkdir()
            with sqlite3.connect('file:' + str(data / 'database.sqlite') + '?mode=ro', uri=True) as source:
                with sqlite3.connect(root / 'data/database.sqlite') as dest:
                    source.backup(dest)
                    assert dest.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            shutil.copytree(config, root / 'config')
            shutil.copytree(data / 'releases', root / 'data/releases', ignore=shutil.ignore_patterns('production.lock'))
            for name in ['provisioned.json', 'repository']:
                p = data / name
                if p.is_dir(): shutil.copytree(p, root / 'data' / name)
                elif p.exists(): shutil.copy2(p, root / 'data' / name)
            with output.open('xb') as out:
                with tarfile.open(fileobj=out, mode='w:gz') as archive:
                    archive.add(root / 'data', arcname='data')
                    archive.add(root / 'config', arcname='config')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output')
    parser.add_argument('--data', default='/var/lib/semaphore')
    parser.add_argument('--config', default='/etc/semaphore')
    args = parser.parse_args()
    snapshot(args.data, args.config, args.output)
    print('Consistent Semaphore snapshot written')
