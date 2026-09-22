#!/usr/bin/env python3
"""Render standalone Dokploy raw Compose. No secrets are embedded."""
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--config', default=str(Path(__file__).with_name('release.example.json')))
args = parser.parse_args()
root = Path(__file__).parent
text = (root / 'compose.yml').read_text()
for name, path in [('release.py', root / 'release.py'), ('provision.py', root / 'provision.py'), ('snapshot.py', root / 'snapshot.py'), ('bootstrap.py', root / 'bootstrap.py'), ('release.example.json', Path(args.config))]:
    content = ''.join('      ' + line + '\n' for line in path.read_text().replace('$', '$$').splitlines())
    text = text.replace('    file: ./' + name, '    content: |\n' + content.rstrip('\n'))
print(text, end='')
