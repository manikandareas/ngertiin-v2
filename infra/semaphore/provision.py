#!/usr/bin/env python3
"""Idempotent Semaphore project setup using its local API; never log credentials."""
import http.cookiejar
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request


def provision():
    marker = Path(os.getenv('PROVISION_MARKER', '/var/lib/semaphore/provisioned.json'))
    if marker.exists():
        return
    cookies = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))

    def call(path, data=None, method=None):
        body = None if data is None else json.dumps(data).encode()
        req = urllib.request.Request(os.getenv('SEMAPHORE_URL', 'http://127.0.0.1:3000') + '/api' + path, body,
                                     {'Content-Type': 'application/json', 'User-Agent': 'NgertiinRelease/1.0'}, method=method)
        try:
            with opener.open(req, timeout=15) as r:
                raw = r.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            print('Semaphore API: ' + path + ' HTTP ' + str(error.code), flush=True)
            raise

    for _ in range(60):
        try:
            call('/auth/login', {'auth': 'admin', 'password': os.environ['SEMAPHORE_ADMIN_PASSWORD']})
            # WEB_ROOT is HTTPS, so the session cookie is Secure. Only this
            # in-container loopback client may send it over local HTTP.
            if os.getenv('SEMAPHORE_URL', 'http://127.0.0.1:3000') == 'http://127.0.0.1:3000':
                for cookie in cookies:
                    cookie.secure = False
            break
        except urllib.error.URLError:
            time.sleep(2)
    else:
        raise RuntimeError('Semaphore login unavailable')
    projects = call('/projects')
    project = next((p for p in projects if p['name'] == 'Ngerti.in Production'), None)
    if not project:
        project = call('/projects', {'name': 'Ngerti.in Production', 'max_parallel_tasks': 1, 'alert': False})
    pid = project['id']
    prefix = f'/project/{pid}'

    def ensure(collection, name, payload):
        entries = call(prefix + '/' + collection + '?sort=name&order=asc')
        existing = next((e for e in entries if e['name'] == name), None)
        return existing or call(prefix + '/' + collection, {'name': name, 'project_id': pid, **payload})

    key = ensure('keys', 'None', {'type': 'none'})
    repository = ensure('repositories', 'Reviewed coordinator', {
        'git_url': '/var/lib/semaphore/repository', 'git_branch': 'main', 'ssh_key_id': key['id']})
    environment = ensure('environment', 'Production', {
        'json': '{}', 'env': json.dumps({'release_ref': 'main', 'RELEASE_CONFIG': '/opt/ngertiin/release.json'}),
        'secrets': [{'name': name, 'secret': os.environ['BOOTSTRAP_' + name], 'type': 'env', 'operation': 'create'}
                    for name in ['GITHUB_TOKEN', 'DOKPLOY_TOKEN']]})
    templates = []
    for title, app in [('Backend', 'backend'), ('Web', 'web'), ('WWW', 'www'), ('All', 'all')]:
        t = ensure('templates', 'Deploy ' + title, {
            'app': 'python', 'playbook': 'release.py', 'type': '',
            'repository_id': repository['id'], 'environment_id': environment['id'],
            'arguments': json.dumps([app]), 'allow_override_args_in_task': False,
            'autorun': False, 'description': 'Manual production release; activation requires verified acceptance.',
            'survey_vars': [{'name': 'release_ref', 'title': 'Release ref (default: main)', 'type': '', 'required': False, 'target': 'env', 'default_value': 'main'}]})
        templates.append(t['id'])
    marker.write_text(json.dumps({'project_id': pid, 'templates': templates}))
    marker.chmod(0o600)
    print('Semaphore project and four deployment templates provisioned', flush=True)


if __name__ == '__main__':
    try:
        provision()
    except Exception as error:
        print('Semaphore provisioning failed: ' + type(error).__name__, flush=True)
        raise SystemExit(1)
