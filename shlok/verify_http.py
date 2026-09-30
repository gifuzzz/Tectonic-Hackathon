"""Start the API, exercise it over real HTTP, then stop.

Also creates/seeds the real database at shlok/data/tree.db on first run.

    uv run python -m shlok.verify_http
"""
from __future__ import annotations

import json
import threading
import time
import urllib.request

import uvicorn

from shlok.app import app

HOST = "127.0.0.1"
PORT = 8123
BASE = f"http://{HOST}:{PORT}"


def _request(method: str, path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    server = uvicorn.Server(uvicorn.Config(app, host=HOST, port=PORT, log_level="warning"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(100):
        if server.started:
            break
        time.sleep(0.1)

    health = _request("GET", "/api/health")
    assert health["status"] == "ok" and health["nodes"] >= 11, health

    graph = _request("GET", "/api/graph")
    assert any(n["id"] == "file-contract" for n in graph["nodes"])
    assert "root" in graph["root_ids"]

    updated = _request(
        "PATCH",
        "/api/nodes/file-contract/meta",
        {"notes": "edited over http", "tags": ["http", "contract"], "changed_by": "verify_http"},
    )
    assert updated["meta"]["notes"] == "edited over http", updated
    assert updated["meta"]["tags"] == ["http", "contract"], updated

    history = _request("GET", "/api/nodes/file-contract/history")
    assert {"notes", "tags"} <= {e["field"] for e in history["history"]}, history

    found = _request("GET", "/api/search?tag=http")
    assert [n["id"] for n in found["nodes"]] == ["file-contract"], found

    synced = _request("POST", "/api/sync")
    assert synced["nodes_upserted"] >= 11, synced

    server.should_exit = True
    thread.join(timeout=5)
    print("http verification OK")


if __name__ == "__main__":
    main()
