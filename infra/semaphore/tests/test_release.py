import contextlib
import io
import json
import multiprocessing
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from release import Coordinator, GitHub, Journal, ReleaseError, healthy, migration_done, replace_tag, wait

SHA = 'a' * 40


def contender(path, queue):
    try:
        with Journal(path).lock():
            queue.put('acquired')
    except ReleaseError:
        queue.put('locked')


class ReleaseTests(unittest.TestCase):
    def test_env_preserves_other_values_and_comments(self):
        env = '# hello\nDATABASE_URL=secret\nRELEASE_TAG=old\nOTHER=x=y\n'
        self.assertEqual(replace_tag(env, SHA), env.replace('RELEASE_TAG=old', 'RELEASE_TAG=' + SHA))
        for bad in ['', 'RELEASE_TAG=one\nRELEASE_TAG=two']:
            with self.assertRaises(ReleaseError):
                replace_tag(bad, SHA)

    def test_cross_process_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            with Journal(directory).lock():
                ctx = multiprocessing.get_context('spawn')
                q = ctx.Queue()
                p = ctx.Process(target=contender, args=(directory, q))
                p.start()
                self.assertEqual(q.get(timeout=5), 'locked')
                p.join(5)
                self.assertEqual(p.exitcode, 0)

    def test_crash_blocks_new_releases_without_remote_calls(self):
        with tempfile.TemporaryDirectory() as directory:
            j = Journal(directory)
            j.begin('backend', SHA)
            j.intent('migration-dispatch')
            fresh = Journal(directory)
            c = Coordinator({'activation_verified': True}, None, None, fresh)
            with self.assertRaisesRegex(ReleaseError, 'Unreconciled'):
                c.run('web', 'main')
            self.assertTrue(j.path.exists())

    def test_missing_controller_ref_does_not_block_future_releases(self):
        with tempfile.TemporaryDirectory() as directory:
            gh = Mock()
            gh.resolve.side_effect = ReleaseError('Controller ref unavailable')
            j = Journal(directory)
            c = Coordinator({'activation_verified': True, 'workflow_ref': 'ops/semaphore-ui'}, gh, None, j)
            with self.assertRaisesRegex(ReleaseError, 'Controller ref unavailable'):
                c.run('all', 'main')
            gh.resolve.assert_called_once_with('ops/semaphore-ui')
            self.assertFalse(j.path.exists())

    def test_old_container_does_not_prove_migration(self):
        row = {'id': 'old', 'image': 'candidate', 'restarts': 0, 'status': 'exited', 'exit_code': 0}
        self.assertFalse(migration_done([row], 'candidate', ['old']))
        row['id'] = 'new'
        self.assertEqual(migration_done([row], 'candidate', ['old']), row)
        row['exit_code'] = 1
        with self.assertRaises(ReleaseError):
            migration_done([row], 'candidate', ['old'])

    def test_migration_running_not_success(self):
        row = {'id': 'new', 'image': 'candidate', 'restarts': 0, 'status': 'running', 'exit_code': 0}
        self.assertFalse(migration_done([row], 'candidate', []))

    def test_health_requires_both_candidate_images_and_ready(self):
        rows = [{'service': role, 'id': role, 'status': 'running', 'image': f'image-{role}:{SHA}', 'restarts': 0, 'health': 'healthy', 'worker_ready': True} for role in ['api', 'worker']]
        self.assertTrue(healthy(rows, 'image', SHA))
        for key, value in [('image', 'old'), ('restarts', 1), ('worker_ready', False)]:
            bad = [dict(r) for r in rows]
            bad[1][key] = value
            self.assertFalse(healthy(bad, 'image', SHA))

    def test_timeout(self):
        with self.assertRaisesRegex(ReleaseError, 'timed out'):
            wait(lambda: False, 0, 0)

    def test_all_uses_one_resolved_sha_despite_main_moving(self):
        with tempfile.TemporaryDirectory() as directory:
            class GH:
                count = 0
                def resolve(self, ref):
                    self.count += 1
                    return SHA if self.count == 1 else 'b' * 40
                def run(self, workflow, app, journal):
                    self.calls.append((app, journal.state['sha']))
                calls = []
            gh = GH()
            c = Coordinator({'activation_verified': True, 'web_url': 'web', 'www_url': 'www'}, gh, None, Journal(directory))
            with patch.object(c, 'backend', lambda: gh.calls.append(('backend', c.journal.state['sha']))), patch('release.url_ready', return_value=True):
                c.run('all', 'main')
            self.assertEqual(gh.count, 1)
            self.assertEqual(gh.calls, [('backend', SHA), ('web', SHA), ('www', SHA)])

    def test_backend_failure_never_runs_frontend_and_blocks_retry(self):
        for stage in ['build', 'backup', 'migration', 'health']:
            with self.subTest(stage=stage), tempfile.TemporaryDirectory() as directory:
                class GH:
                    def resolve(self, ref): return SHA
                    def run(self, *args): raise AssertionError('Frontend must not run')
                c = Coordinator({'activation_verified': True}, GH(), None, Journal(directory))
                with patch.object(c, 'backend', side_effect=ReleaseError(stage)):
                    with self.assertRaises(ReleaseError): c.run('all', 'main')
                self.assertEqual(json.loads(c.journal.path.read_text())['status'], 'needs-reconciliation')

    def test_github_ignores_newest_unrelated_run(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict('os.environ', {'GITHUB_TOKEN': 'secret'}):
            j = Journal(directory)
            j.begin('www', SHA)
            gh = GitHub({'repository': 'owner/repo', 'workflow_ref': 'main'})
            title = f"frontend www release={j.state['release_id']} sha={SHA}"
            def call(path, data=None):
                if path.endswith('/dispatches'):
                    self.assertEqual(data['inputs']['release_sha'], SHA)
                    return None
                if '/jobs?' in path:
                    return {'total_count': 1, 'jobs': [{'name': 'deploy', 'conclusion': 'success'}]}
                return {'workflow_runs': [
                    {'id': 99, 'display_title': 'unrelated', 'status': 'completed', 'conclusion': 'success'},
                    {'id': 12, 'display_title': title, 'status': 'completed', 'conclusion': 'success', 'html_url': 'https://github.com/owner/repo/actions/runs/12'}]}
            with patch.object(gh, 'call', call), contextlib.redirect_stdout(io.StringIO()) as logs:
                gh.run('frontend-deploy.yml', 'www', j)
            self.assertEqual(j.state['operations'][0]['run_id'], 12)
            self.assertNotIn('secret', logs.getvalue())

    def test_github_completed_failure_and_failed_job_are_rejected(self):
        for conclusion, job_conclusion in [('failure', 'success'), ('success', 'skipped')]:
            with self.subTest(conclusion=conclusion, job=job_conclusion), tempfile.TemporaryDirectory() as directory, patch.dict('os.environ', {'GITHUB_TOKEN': 'secret'}):
                j = Journal(directory)
                j.begin('web', SHA)
                gh = GitHub({'repository': 'owner/repo', 'workflow_ref': 'main'})
                title = f"frontend web release={j.state['release_id']} sha={SHA}"
                def call(path, data=None):
                    if path.endswith('/dispatches'): return None
                    if '/jobs?' in path:
                        return {'total_count': 1, 'jobs': [{'name': 'deploy', 'conclusion': job_conclusion}]}
                    return {'workflow_runs': [{'id': 1, 'display_title': title, 'status': 'completed',
                                              'conclusion': conclusion, 'html_url': 'https://github.com/run/1'}]}
                with patch.object(gh, 'call', call), contextlib.redirect_stdout(io.StringIO()):
                    with self.assertRaises(ReleaseError): gh.run('frontend-deploy.yml', 'web', j)

    def test_real_backend_order_stops_before_backend_mutation(self):
        for failure in ['build', 'backup', 'migration']:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                cfg = {'backend_id': 'backend', 'migration_id': 'migration', 'image_prefix': 'image',
                       'migration_project': 'migration-project', 'network': 'network'}
                j = Journal(directory)
                j.begin('backend', SHA)
                gh, dk = Mock(), Mock()
                gh.file.return_value = 'services: {}'
                dk.preflight.return_value = ({'env': 'RELEASE_TAG=' + 'b' * 40,
                                              'composeFile': 'old compose', 'sourceType': 'raw'}, {})
                if failure == 'build':
                    gh.run.side_effect = ReleaseError('build failed')
                if failure == 'backup':
                    dk.backup.side_effect = ReleaseError('backup failed')
                rows = [[], [{'id': 'candidate', 'image': 'image-migrate:' + SHA,
                              'restarts': 0, 'status': 'exited', 'exit_code': 1}]]
                with patch('release.inspect', side_effect=rows), contextlib.redirect_stdout(io.StringIO()):
                    with self.assertRaises(ReleaseError):
                        Coordinator(cfg, gh, dk, j).backend()
                backend_writes = [call for call in dk.call.call_args_list
                                  if len(call.args) > 1 and call.args[1].get('composeId') == 'backend']
                self.assertEqual(backend_writes, [])
                if failure == 'build':
                    dk.backup.assert_not_called()
                if failure in ['build', 'backup']:
                    dk.deploy.assert_not_called()

    def test_disabled_activation_has_no_remote_calls(self):
        with tempfile.TemporaryDirectory() as directory:
            c = Coordinator({'activation_verified': False}, None, None, Journal(directory))
            with self.assertRaises(ReleaseError): c.run('backend', 'main')


if __name__ == '__main__':
    unittest.main()
