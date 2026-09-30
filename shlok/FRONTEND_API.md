# Frontend Integration Contract

Storage + API for the Drive dashboard demo. The backend owns a local SQLite
database (`shlok/data/tree.db`) that holds:

- the Drive **graph** (nodes + edges) produced by archit's Drive source class,
- app-owned **metadata** on every file and folder (notes, tags, category, marks),
- an append-only **history** of every metadata change.

This repo provides the **storage layer and JSON API only**. The dashboard UI is
built by the frontend team; they only ever talk to the API below and need no
knowledge of the database. CORS is open, so a separate dev server works.

---

## 1. Running the backend

```bash
uv run python -m shlok.app        # starts on http://127.0.0.1:8000
```

- `GET /` returns a JSON index of the endpoints (no UI is served from here).
- Everything the UI needs is under `/api`.
- Interactive docs are available at `/docs`.
- CORS is enabled for all origins, so the frontend can also live on a separate
  dev server if desired.

---

## 2. Core data shapes

### Node

```json
{
  "id": "1AbCdEfGhIjKlMnOp",
  "name": "Contract.pdf",
  "type": "file",
  "mime_type": "application/pdf",
  "parent_id": "1BcDeFgHiJkLmNoPq",
  "size": 123456,
  "modified_time": "2026-09-30T12:00:00Z",
  "trashed": false,
  "meta": {
    "notes": "Signed by legal on 2026-09-28",
    "tags": ["contract", "legal"],
    "category": "Legal",
    "marks": { "reviewed": true },
    "updated_at": "2026-09-30T18:00:00Z",
    "updated_by": "shlok"
  }
}
```

Field notes:

- `type` is `"file"` or `"folder"`.
- `parent_id` is the primary parent. The graph may contain additional parents
  (shared folders/shortcuts); use `/api/graph` edges for the full picture.
- `meta` is always present. `notes`, `tags`, `category` may be empty
  (`""`, `[]`, `null`). `marks` is a free-form object.
- `size` is `null` for folders.

### Edge

```json
{ "parent_id": "1BcDeFgHiJkLmNoPq", "child_id": "1AbCdEfGhIjKlMnOp" }
```

### HistoryEntry

```json
{
  "id": 42,
  "node_id": "1AbCdEfGhIjKlMnOp",
  "field": "tags",
  "old_value": ["contract"],
  "new_value": ["contract", "legal"],
  "changed_at": "2026-09-30T18:00:00Z",
  "changed_by": "shlok"
}
```

`field` is one of `notes`, `tags`, `category`, `marks`. One entry is written
per changed field, so a single save that edits both notes and tags produces two
entries.

---

## 3. Endpoints

Base URL: `/api`

### GET `/api/health`

```json
{ "status": "ok", "nodes": 128, "edges": 127 }
```

### GET `/api/graph`

Returns the whole graph in one call. Best for initial page load / rendering.

```json
{
  "nodes": [ /* Node objects, each WITH its meta */ ],
  "edges": [ /* Edge objects */ ],
  "root_ids": ["1RootIdAbCdEf"]
}
```

`root_ids` are nodes with no parent (Drive root / "My Drive" entries).

### GET `/api/nodes/{node_id}`

Single node with meta, its direct children, and its direct parents.

```json
{
  "node": { /* Node */ },
  "children": [ /* Node objects (with meta) */ ],
  "parents": [ /* Node objects (with meta) */ ]
}
```

`404` if the id is unknown.

### PATCH `/api/nodes/{node_id}/meta`

The single write path for editing. Send only the fields you changed.

Request:

```json
{
  "notes": "Awaiting countersignature",
  "tags": ["contract", "legal", "pending"],
  "category": "Legal",
  "marks": { "reviewed": false, "priority": "high" },
  "changed_by": "shlok"
}
```

- Any of `notes`, `tags`, `category`, `marks` may be omitted; omitted fields are
  left untouched.
- `tags` is a **full replacement** (send the whole array), not an append.
- Only fields whose value actually changed get a history entry.
- Response: the updated `Node` (with fresh `meta.updated_at` / `updated_by`).

### GET `/api/nodes/{node_id}/history`

```json
{ "node_id": "1AbCdEfGhIjKlMnOp", "history": [ /* HistoryEntry, newest first */ ] }
```

Optional query param `?field=tags` filters to one field.

### GET `/api/search`

Optional query params; all are ANDed. Empty params are ignored.

- `q` — substring match on node name
- `tag` — node has this tag
- `category` — node has this category
- `type` — `file` or `folder`

```json
{ "count": 3, "nodes": [ /* Node objects, with meta */ ] }
```

### POST `/api/ingest`

Backend-to-backend endpoint. archit's Drive class (or any producer) POSTs a
graph here and it is upserted into storage. Existing metadata is preserved:
ingesting the same node again only refreshes its Drive fields (name, parent,
size, modified), never the notes/tags/category.

Request:

```json
{
  "nodes": [
    { "id": "1AbC", "name": "Reports", "type": "folder", "parent_id": null },
    { "id": "1DeF", "name": "Q3.pdf", "type": "file",
      "mime_type": "application/pdf", "parent_id": "1AbC", "size": 42 }
  ],
  "edges": [ { "parent_id": "1AbC", "child_id": "1DeF" } ],
  "source": "archive"
}
```

`edges` is optional; if omitted, edges are derived from each node's `parent_id`.

Response:

```json
{ "nodes_upserted": 2, "edges_upserted": 1, "source": "archive" }
```

### POST `/api/sync`

Convenience for the demo. Calls the locally configured Drive source (archit's
class or the bundled sample graph when Drive creds are not configured) and
upserts the result. Same response shape as `/api/ingest`. Metadata already
saved is preserved.

```json
{ "nodes_upserted": 128, "edges_upserted": 127, "source": "sample" }
```

---

## 4. Errors

All non-2xx responses share one shape:

```json
{ "error": { "code": "not_found", "message": "Unknown node id" } }
```

Common codes: `not_found` (404), `bad_request` (400), `server_error` (500).

---

## 5. Minimal JavaScript usage

```js
const api = {
  graph:    () => fetch("/api/graph").then(r => r.json()),
  node:     (id) => fetch(`/api/nodes/${id}`).then(r => r.json()),
  patch:    (id, body) => fetch(`/api/nodes/${id}/meta`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(r => r.json()),
  history:  (id) => fetch(`/api/nodes/${id}/history`).then(r => r.json()),
  search:   (params) => fetch("/api/search?" + new URLSearchParams(params)).then(r => r.json()),
  sync:     () => fetch("/api/sync", { method: "POST" }).then(r => r.json()),
};

// Load and render
const { nodes, edges, root_ids } = await api.graph();

// Edit a node's notes + tags (full tag array)
await api.patch("1AbCdEfGhIjKlMnOp", {
  notes: "Reviewed",
  tags: ["contract", "legal"],
  changed_by: "web",
});

// See its history
const { history } = await api.history("1AbCdEfGhIjKlMnOp");
```

---

## 6. UI expectations (guidance for the frontend team)

1. On load, call `GET /api/graph` and render the folder tree/graph.
2. Clicking any file **or folder** opens a detail panel.
3. The panel shows and lets the user edit: `notes` (textarea), `tags`
   (chips / comma input), `category` (text or select), `marks` (optional).
4. Saving calls `PATCH /api/nodes/{id}/meta` with only changed fields and
   refreshes the panel from the response.
5. The panel has a History section calling `GET /api/nodes/{id}/history`,
   rendering each entry as `field: old -> new` with timestamp and author.
6. A search/filter bar calls `GET /api/search` with `q`, `tag`, `category`.
7. A "Sync from Drive" button calls `POST /api/sync` then re-fetches the graph.

Folders are first-class: they carry the same notes/tags/category/history as files.

---

## 7. Backend module map (for reference)

| File | Responsibility |
| --- | --- |
| `shlok/db.py` | SQLite connection + schema (`nodes`, `edges`, `meta`, `meta_history`) |
| `shlok/models.py` | Node / Edge / Meta / HistoryEntry dataclasses + JSON conversion |
| `shlok/store.py` | `upsert_graph`, `get_graph`, `get_node`, `patch_meta`, `search` |
| `shlok/history.py` | history queries, optional point-in-time reconstruction |
| `shlok/ingest.py` | accept a graph (archit's Drive class or a POST payload) and upsert it |
| `shlok/sample_graph.py` | bundled sample graph so the demo runs without Drive creds |
| `shlok/app.py` | FastAPI app + REST endpoints (no UI served from here) |
| `shlok/drive_source.py` | adapter over archit's `GoogleDrive`: `list_files()` -> graph |
| `shlok/test_db.py` | runnable PASS/FAIL checks for the whole storage layer |

---

## 8. Getting the graph out of archit's Drive class

[`archit/drive.py`](../archit/drive.py) exposes:

```python
from archit.drive import GoogleDrive

drive = GoogleDrive()          # optional: credentials_file=, token_file=
drive.authenticate()           # opens a browser the first time only
files = drive.list_files(limit=50, search="report", folders_only=False)
```

`list_files()` returns a **flat** list of dicts:

```python
{"id", "name", "mimeType", "size", "modifiedTime", "parents", "webViewLink"}
```

- `size` is an int for real files and `None` for folders / Google Docs.
- `parents` is a list of parent folder ids (a file can have more than one).

[`shlok/drive_source.py`](../shlok/drive_source.py) converts that into our graph
shape via `to_graph(files)`: `type` is `"folder"` when
`mimeType == "application/vnd.google-apps.folder"`, and every entry in `parents`
becomes an edge. Storage entry points:

- `shlok.ingest.import_from_drive(limit=..., search=..., folders_only=...)` —
  authenticate, list, map, and upsert in one call.
- `shlok.ingest.sync_from_source()` (what `POST /api/sync` calls) — tries Drive,
  falls back to the bundled sample graph when Drive is not configured, and never
  raises.
- `shlok.ingest.ingest_graph(payload)` / `POST /api/ingest` — push an
  already-built graph dict.

Rules the storage layer assumes:

- `id` is the Drive file id and is the only identity used; `parent_id` links the
  graph.
- Any node the UI should be able to annotate must appear in `nodes`, folders
  included.
- Extra/unknown keys are ignored; missing optional keys default sensibly
  (`trashed=false`, `size=null`, `edges` derived from `parent_id`).
- Ingestion is idempotent: re-sending the same graph refreshes Drive fields but
  never touches `notes`, `tags`, `category`, or `marks`.

> `parents` was added to the `fields` string in archit's `list_files()` so the
> hierarchy can be rebuilt; without it every node would look like a root.
