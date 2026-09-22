#!/usr/bin/env python3
"""Production release coordinator. Python stdlib; remote writes are never retried."""
import argparse
import base64
import contextlib
import fcntl
import json
import os
from pathlib import Path
import re
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class ReleaseError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise ReleaseError(message)


def request(url, token=None, data=None, timeout=30, header="Authorization"):
    headers = {"Accept": "application/json", "User-Agent": "NgertiinRelease/1.0"}
    if token:
        headers[header] = "Bearer " + token if header == "Authorization" else token
    body = None if data is None else json.dumps(data).encode()
    if body is not None:
        headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, body, headers), timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        # Do not print response bodies, URL query strings, or provider exceptions (secrets).
        raise ReleaseError(f"Remote request failed ({type(e).__name__}); reconcile before retry") from None


def wait(check, seconds, interval=5):
    deadline = time.monotonic() + seconds
    while True:
        result = check()
        if result:
            return result
        require(time.monotonic() < deadline, "Operation timed out; remote operation may still be running")
        time.sleep(min(interval, max(0, deadline - time.monotonic())))


def replace_tag(env, sha):
    pattern = r"(?m)^[ \t]*(?:export[ \t]+)?RELEASE_TAG[ \t]*=.*$"
    require(len(re.findall(pattern, env)) == 1, "Expected exactly one RELEASE_TAG environment entry")
    return re.sub(pattern, "RELEASE_TAG=" + sha, env)


def get_tag(env):
    match = re.findall(r"(?m)^[ \t]*(?:export[ \t]+)?RELEASE_TAG[ \t]*=[\"']?([0-9a-f]{40})[\"']?[ \t]*$", env)
    require(len(match) == 1, "Previous RELEASE_TAG must be a full commit SHA")
    return match[0]


class Journal:
    def __init__(self, directory):
        self.root = Path(directory)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.path = self.root / "active.json"
        self.state = {}

    @contextlib.contextmanager
    def lock(self):
        with (self.root / "production.lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise ReleaseError("Another production task is running") from None
            yield

    def save(self, **values):
        self.state.update(values)
        temp = self.path.with_suffix(".tmp")
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            json.dump(self.state, f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, self.path)
        fd = os.open(self.root, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)

    def begin(self, app, sha):
        require(not self.path.exists(), "Unreconciled release exists; inspect active.json before any new deployment")
        self.save(release_id=uuid.uuid4().hex, sha=sha, app=app, status="running", operations=[], started=time.time())

    def intent(self, stage, **details):
        operation = {"stage": stage, "status": "intent", "started": time.time(), **details}
        self.state["operations"].append(operation)
        self.save(stage=stage)
        print(f"[{self.state['release_id']}] {stage}", flush=True)
        return operation

    def record(self, op, **values):
        op.update(values)
        self.save()

    def archive(self, status, **extra):
        self.save(status=status, **extra)
        os.replace(self.path, self.root / (self.state["release_id"] + ".json"))


class GitHub:
    def __init__(self, config):
        self.repo = config["repository"]
        self.branch = config["workflow_ref"]
        self.token = os.environ["GITHUB_TOKEN"]

    def call(self, path, data=None):
        return request("https://api.github.com/repos/" + self.repo + "/" + path, self.token, data)

    def resolve(self, ref):
        sha = self.call("commits/" + urllib.parse.quote(ref, safe=""))["sha"]
        require(re.fullmatch("[0-9a-f]{40}", sha), "GitHub did not return a full commit SHA")
        return sha

    def file(self, path, sha):
        result = self.call("contents/" + path + "?ref=" + sha)
        return base64.b64decode(result["content"]).decode()

    def run(self, workflow, app, journal):
        sha, rid = journal.state["sha"], journal.state["release_id"]
        title = f"{'backend' if app == 'backend' else 'frontend ' + app} release={rid} sha={sha}"
        op = journal.intent("github-" + app, workflow=workflow, title=title)
        inputs = {"release_sha": sha, "release_id": rid}
        if app != "backend":
            inputs["app"] = app
        self.call("actions/workflows/" + workflow + "/dispatches", {"ref": self.branch, "inputs": inputs})
        journal.record(op, status="dispatched")

        def complete():
            matches = []
            # Paginate, never select the newest run as a proxy for correlation.
            for page in range(1, 11):
                runs = self.call(f"actions/workflows/{workflow}/runs?event=workflow_dispatch&per_page=100&page={page}")["workflow_runs"]
                matches.extend(r for r in runs if r["display_title"] == title)
                if len(runs) < 100:
                    break
            require(len(matches) <= 1, "Ambiguous GitHub run correlation")
            if not matches:
                return False
            run = matches[0]
            if op.get("run_id") != run["id"]:
                journal.record(op, run_id=run["id"], url=run["html_url"])
                print(run["html_url"], flush=True)
            if run["status"] != "completed":
                return False
            require(run["conclusion"] == "success", "GitHub workflow failed")
            jobs = self.call(f"actions/runs/{run['id']}/jobs?per_page=100")
            expected = {"validate", "images (api)", "images (worker)", "images (migrate)"} if app == "backend" else {"deploy"}
            require(expected <= {j["name"] for j in jobs["jobs"]}, "Expected GitHub jobs missing")
            require(jobs["total_count"] == len(jobs["jobs"]) and all(j["conclusion"] == "success" for j in jobs["jobs"]), "A GitHub job did not succeed")
            journal.record(op, status="done")
            return True
        wait(complete, 3600)


class Dokploy:
    def __init__(self, config):
        self.config = config
        self.base = config["dokploy_url"].rstrip("/")
        require(self.base.startswith("https://"), "Dokploy requires HTTPS")
        self.token = os.environ["DOKPLOY_TOKEN"]

    def call(self, method, data=None, query=None, timeout=30):
        url = self.base + "/api/" + method
        if query:
            url += "?" + urllib.parse.urlencode(query)
        return request(url, self.token, data, timeout, "x-api-key")

    def compose(self, resource):
        return self.call("compose.one", query={"composeId": resource})

    def deployments(self, kind, resource):
        return self.call("deployment.allByType", query={"type": kind, "id": resource})

    def preflight(self):
        cfg = self.config
        require(self.call("settings.getDokployVersion") == cfg["dokploy_version"], "Dokploy version changed; revalidate API contract")
        backend = self.compose(cfg["backend_id"])
        migration = self.compose(cfg["migration_id"])
        backup = self.call("backup.one", query={"backupId": cfg["backup_id"]})
        pg = self.call("postgres.one", query={"postgresId": cfg["postgres_id"]})
        for resource in (backend, migration):
            require(resource["composeType"] == "docker-compose", "Only verified docker-compose resources supported")
            require(resource.get("autoDeploy") is False, "Disable auto-deploy before activation")
        require(backend["appName"] == cfg["backend_project"], "Backend Compose project mismatch")
        require(migration["appName"] == cfg["migration_project"], "Migration Compose project mismatch")
        require(backup["postgresId"] == cfg["postgres_id"] and backup["prefix"] == "postgres/releases" and backup["keepLatestCount"] == 10 and backup["enabled"] is False, "Dedicated release backup must be unscheduled, postgres/releases, retention 10")
        require(pg["dockerImage"] == cfg["postgres_image"], "PostgreSQL image differs from verified image")
        require(backend["environmentId"] == migration["environmentId"] == pg["environmentId"], "Resource environments differ")
        for kind, resource in [("compose", cfg["backend_id"]), ("compose", cfg["migration_id"]), ("backup", cfg["backup_id"])]:
            require(not any(d["status"] in ("running", "queued") for d in self.deployments(kind, resource)), "Remote deployment already running")
        return backend, migration

    def deploy(self, resource, title, journal):
        op = journal.intent(title, resource=resource)
        self.call("compose.deploy", {"composeId": resource, "title": title, "description": journal.state["sha"]})
        journal.record(op, status="dispatched")

        def complete():
            matches = [d for d in self.deployments("compose", resource) if d["title"] == title]
            require(len(matches) <= 1, "Ambiguous Dokploy deployment")
            if not matches:
                return False
            d = matches[0]
            journal.record(op, deployment_id=d["deploymentId"])
            require(d["status"] != "error", "Dokploy deployment failed")
            return d["status"] == "done"
        wait(complete, 1800)
        journal.record(op, status="done")
        return op

    def backup(self, journal):
        resource = self.config["backup_id"]
        before = [d["deploymentId"] for d in self.deployments("backup", resource)]
        op = journal.intent("backup", resource=resource, previous_ids=before)
        # This API waits for export/upload; a proxy timeout leaves an unresolved intent.
        self.call("backup.manualBackupPostgres", {"backupId": resource}, timeout=1800)

        def complete():
            matches = [d for d in self.deployments("backup", resource) if d["deploymentId"] not in before]
            require(len(matches) <= 1, "Ambiguous backup; inspect remote history")
            if not matches:
                return False
            d = matches[0]
            journal.record(op, deployment_id=d["deploymentId"])
            require(d["status"] != "error", "Database backup failed")
            return d["status"] == "done"
        wait(complete, 30)
        journal.record(op, status="done")


def inspect(config, role):
    # Dokploy 0.29.11 exposes read-only inspection and logs; no SSH/socket needed.
    dk = Dokploy(config)
    project = config[role + "_project"]
    rows = dk.call("docker.getContainersByAppNameMatch", query={"appName": project, "appType": "docker-compose"})
    result = []
    for row in rows:
        c = dk.call("docker.getConfig", query={"containerId": row["containerId"]})
        labels = c["Config"].get("Labels") or {}
        if labels.get("com.docker.compose.project") != project:
            continue
        service = labels.get("com.docker.compose.service")
        logs = ""
        if service == "worker":
            logs = dk.call("compose.readLogs", query={"composeId": config["backend_id"], "containerId": c["Id"]})
        result.append({"id": c["Id"], "image": c["Config"]["Image"], "service": service,
                       "status": c["State"]["Status"], "exit_code": c["State"]["ExitCode"],
                       "restarts": c["RestartCount"], "health": c["State"].get("Health", {}).get("Status"),
                       "worker_ready": isinstance(logs, str) and "worker.ready" in logs})
    return result


def migration_done(rows, image, previous_ids):
    candidates = [c for c in rows if c["image"] == image and c["id"] not in previous_ids]
    require(len(candidates) <= 1, "Multiple candidate migration containers")
    if not candidates:
        return False
    c = candidates[0]
    require(c["restarts"] == 0, "Migration restarted unexpectedly")
    if c["status"] == "exited":
        require(c["exit_code"] == 0, "Candidate migration exited nonzero")
        return c
    require(c["status"] not in ("dead", "removing"), "Candidate migration failed")
    return False


def healthy(rows, prefix, sha):
    result = {}
    for role in ("api", "worker"):
        active = [c for c in rows if c["service"] == role and c["status"] == "running"]
        if len(active) != 1:
            return False
        c = active[0]
        if c["image"] != f"{prefix}-{role}:{sha}" or c["restarts"] != 0:
            return False
        if role == "api" and c["health"] != "healthy":
            return False
        if role == "worker" and not c["worker_ready"]:
            return False
        result[role] = c["id"]
    return result


def url_ready(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "NgertiinRelease/1.0"}), timeout=10) as r:
            return r.status == 200
    except (urllib.error.URLError, TimeoutError):
        return False


class Coordinator:
    def __init__(self, config, github, dokploy, journal):
        self.cfg, self.gh, self.dk, self.journal = config, github, dokploy, journal

    def backend(self):
        j, cfg = self.journal, self.cfg
        backend, migration = self.dk.preflight()
        previous = get_tag(backend["env"])
        # Persist rollback source privately, never copy environment secrets into the journal.
        j.save(previous_sha=previous, previous_compose=backend["composeFile"] if backend["sourceType"] == "raw" else self.gh.file("compose.production.yml", previous), previous_source_type=backend["sourceType"])
        compose = self.gh.file("compose.production.yml", j.state["sha"])
        self.gh.run("backend-images.yml", "backend", j)
        self.dk.backup(j)
        old_ids = [c["id"] for c in inspect(cfg, "migration")]
        image = cfg["image_prefix"] + "-migrate:" + j.state["sha"]
        # Dedicated one-shot Compose; keep database env, resource identity and network.
        migration_compose = "services:\n  migrate:\n    image: " + image + "\n    restart: 'no'\n    environment:\n      NODE_ENV: production\n      DATABASE_URL: ${DATABASE_URL:?Set database URL}\n    networks: [backend]\nnetworks:\n  backend:\n    external: true\n    name: " + cfg["network"] + "\n"
        op = j.intent("migration-source", previous_ids=old_ids, image=image)
        self.dk.call("compose.update", {"composeId": cfg["migration_id"], "sourceType": "raw", "composeFile": migration_compose, "command": "--force-recreate"})
        j.record(op, status="done")
        self.dk.deploy(cfg["migration_id"], "migration-" + j.state["release_id"], j)
        result = wait(lambda: migration_done(inspect(cfg, "migration"), image, old_ids), 1800)
        j.save(migration_container=result["id"])
        op = j.intent("backend-source")
        current = self.dk.compose(cfg["backend_id"])
        require(get_tag(current["env"]) == previous, "Backend release changed during build")
        self.dk.call("compose.update", {"composeId": cfg["backend_id"], "sourceType": "raw", "composeFile": compose})
        self.dk.call("compose.saveEnvironment", {"composeId": cfg["backend_id"], "env": replace_tag(current["env"], j.state["sha"])})
        j.record(op, status="done")
        self.dk.deploy(cfg["backend_id"], "backend-" + j.state["release_id"], j)
        stable = {"ids": None, "since": 0}

        def check():
            ids = healthy(inspect(cfg, "backend"), cfg["image_prefix"], j.state["sha"])
            if not ids or not url_ready(cfg["api_url"] + "/health/ready"):
                stable.update(ids=None, since=0)
                return False
            if ids != stable["ids"]:
                stable.update(ids=ids, since=time.monotonic())
            return ids if time.monotonic() - stable["since"] >= 30 else False
        j.save(backend_containers=wait(check, 300))

    def run(self, app, ref):
        require(self.cfg.get("activation_verified") is True, "Live preflight and disposable acceptance required before activation")
        require(app in self.cfg.get("enabled_apps", ["backend", "web", "www", "all"]), "This deployment template is not activated yet")
        with self.journal.lock():
            require(not self.journal.path.exists(), "Unreconciled release blocks all templates")
            sha = self.gh.resolve(ref)
            self.journal.begin(app, sha)
            try:
                if app in ("backend", "all"):
                    self.backend()
                for frontend in (["web", "www"] if app == "all" else [app] if app in ("web", "www") else []):
                    self.gh.run("frontend-deploy.yml", frontend, self.journal)
                    wait(lambda: url_ready(self.cfg[frontend + "_url"]), 300)
                self.journal.archive("success")
            except BaseException:
                self.journal.save(status="needs-reconciliation")
                raise


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser()
    parser.add_argument("app", choices=["backend", "web", "www", "all", "preflight", "status"])
    parser.add_argument("--release-ref", default=os.getenv("release_ref") or "main")
    parser.add_argument("--config", default=os.getenv("RELEASE_CONFIG", "/etc/semaphore/release.json"))
    args = parser.parse_args()
    cfg = json.loads(Path(args.config).read_text())
    journal = Journal(cfg["state_dir"])
    if args.app == "status":
        # Includes no environment values; previous Compose is private and omitted here.
        state = json.loads(journal.path.read_text()) if journal.path.exists() else {}
        state.pop("previous_compose", None)
        print(json.dumps(state, indent=2))
        return
    gh, dk = GitHub(cfg), Dokploy(cfg)
    if args.app == "preflight":
        dk.preflight()
        inspect(cfg, "backend")
        inspect(cfg, "migration")
        print("Read-only connectivity passed; pgvector, version, capacity and disposable acceptance still require verification")
        return
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    Coordinator(cfg, gh, dk, journal).run(args.app, args.release_ref)


if __name__ == "__main__":
    try:
        main()
    except (ReleaseError, KeyError, OSError) as error:
        # Never print arbitrary provider payloads or environment values.
        print(str(error) if isinstance(error, ReleaseError) else "Configuration or storage unavailable", file=sys.stderr)
        sys.exit(1)
