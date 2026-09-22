#!/usr/bin/env python3
"""Initialize the local, reviewed coordinator repository before Semaphore starts."""
import os
from pathlib import Path
import shutil
import subprocess

os.umask(0o077)
root = Path('/var/lib/semaphore/repository')
root.mkdir(parents=True, exist_ok=True)
for name in ['release.py']:
    shutil.copyfile('/opt/ngertiin/' + name, root / name)
for command in [
    ['git', 'init', '-b', 'main'],
    ['git', 'add', 'release.py'],
    ['git', '-c', 'user.name=Release Operator', '-c', 'user.email=deploy@localhost',
     'commit', '--allow-empty', '-m', 'Install reviewed release coordinator'],
]:
    subprocess.run(command, cwd=root, check=True, stdout=subprocess.DEVNULL)
