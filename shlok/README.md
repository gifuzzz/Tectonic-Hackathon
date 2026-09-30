# shlok — Drive graph storage

Stores the Google Drive graph plus app-owned metadata (notes, tags, category,
marks) on every file and folder, with a full history of every change. There is
**no UI here** — the dashboard is built by the frontend team against the JSON
API described in [`FRONTEND_API.md`](FRONTEND_API.md).

## What it stores

SQLite database at `shlok/data/tree.db` (created automatically, git-ignored):

| Table | Holds |
| --- | --- |
| `nodes` | Drive files/folders: id, name, type, mime, parent, size, modified |
| `edges` | parent -> child links (a graph, so shared files can have many parents) |
| `meta` | current notes, tags, category, marks per node |
| `meta_history` | append-only log: which field changed, old -> new, when, by whom |

Drive data and user data are separate: re-syncing Drive never touches notes,
tags, category, or marks.

## Requirements

Nothing to install by hand. Dependencies are declared in `pyproject.toml`
(`fastapi`, `uvicorn`, and archit's Google libs) and pinned in `uv.lock`:

```bash
uv sync
```

That single command creates `.venv` and installs everything, including the
Google Drive libraries archit's class needs.

## Run the API

```bash
uv run python -m shlok.app
```

- API root: <http://127.0.0.1:8000> (JSON index of endpoints)
- Interactive docs: <http://127.0.0.1:8000/docs>
- On first start the database is seeded from a bundled sample graph so the
  endpoints return data immediately.

## Test it

Everything is runnable without Drive credentials.

```bash
# Full storage test suite: 27 checks, prints PASS/FAIL, exits non-zero on failure
uv run python -m shlok.test_db

# Storage smoke test (throwaway db): ingest, patch, history
uv run python -m shlok.smoke_test

# Live HTTP test: starts the API, exercises it, stops it, creates the real db
uv run python -m shlok.verify_http
```

`test_db.py` uses a throwaway database in the temp dir, so it never disturbs
`shlok/data/tree.db`.

## Connecting archit's real Drive

One command (put `archit/credentials.json` in place, then `uv sync` once):

```bash
uv run python -m shlok.sync_drive           # pull up to 1000 files
uv run python -m shlok.sync_drive -n 5000   # more files
```

From Python: `shlok.ingest.import_from_drive(limit=1000)`. From the running
server: `POST /api/sync` (falls back to the sample graph if Drive is not
configured).

## Module map

| File | Responsibility |
| --- | --- |
| `db.py` | SQLite connection + schema |
| `models.py` | Node / Edge / Meta / HistoryEntry dataclasses |
| `store.py` | `upsert_graph`, `get_graph`, `get_node`, `patch_meta`, `search` |
| `history.py` | history queries + point-in-time reconstruction |
| `drive_source.py` | archit's `list_files()` -> graph shape |
| `ingest.py` | Drive / payload -> store |
| `app.py` | FastAPI REST API (no UI) |
| `sample_graph.py` | demo data so nothing needs Drive creds |
| `test_db.py`, `smoke_test.py`, `verify_http.py` | tests |
