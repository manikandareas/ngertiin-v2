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

# Rotate initial setup credentials before storing project secrets. Subsequent starts
# preserve the key protecting existing credentials.
config = Path('/etc/semaphore/config.json')
if config.exists() and not Path('/var/lib/semaphore/provisioned.json').exists():
    import json
    value = json.loads(config.read_text())
    value['access_key_encryption'] = os.environ['SEMAPHORE_ACCESS_KEY_ENCRYPTION']
    config.write_text(json.dumps(value))
    config.chmod(0o600)
    subprocess.run(['semaphore', 'user', 'change-by-login', '--login', 'admin',
                    '--password', os.environ['SEMAPHORE_ADMIN_PASSWORD'], '--config', str(config)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
