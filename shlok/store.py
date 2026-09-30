"""Graph storage plus metadata read/write with automatic history.

Design rule: ``nodes``/``edges`` are owned by the Drive sync and only ever get
overwritten by ingest; ``meta``/``meta_history`` are app-owned and are never
touched by ingest.
"""
from __future__ import annotations

from typing import Any, Iterable

from . import db, history
from .models import Edge, Node, dumps

NODE_COLUMNS = (
    "n.id, n.name, n.type, n.mime_type, n.parent_id, n.size, n.modified_time, n.trashed"
)
META_COLUMNS = "m.notes, m.tags, m.category, m.marks, m.updated_at, m.updated_by"
SELECT_NODE = (
    f"SELECT {NODE_COLUMNS}, {META_COLUMNS} FROM nodes n LEFT JOIN meta m ON m.node_id = n.id"
)


# --------------------------------------------------------------------------- #
# Graph ingest
# --------------------------------------------------------------------------- #
def upsert_graph(
    nodes: Iterable[dict],
    edges: Iterable[dict] | None = None,
    source: str | None = None,
) -> dict:
    """Insert/update nodes and edges. Existing metadata is preserved."""
    conn = db.get_conn()
    node_list = [n for n in (nodes or []) if isinstance(n, dict) and n.get("id")]
    edges_derived = edges is None
    if edges_derived:
        edges = [
            {"parent_id": n.get("parent_id"), "child_id": n["id"]}
            for n in node_list
            if n.get("parent_id")
        ]
    edge_list = [
        e
        for e in (edges or [])
        if isinstance(e, dict) and e.get("parent_id") and e.get("child_id")
    ]

    with db.write_lock():
        for n in node_list:
            conn.execute(
                """
                INSERT INTO nodes
                    (id, name, type, mime_type, parent_id, size, modified_time, trashed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name          = excluded.name,
                    type          = excluded.type,
                    mime_type     = excluded.mime_type,
                    parent_id     = excluded.parent_id,
                    size          = excluded.size,
                    modified_time = excluded.modified_time,
                    trashed       = excluded.trashed
                """,
                (
                    n["id"],
                    n.get("name") or "",
                    n.get("type") or "file",
                    n.get("mime_type"),
                    n.get("parent_id"),
                    n.get("size"),
                    n.get("modified_time"),
                    1 if n.get("trashed") else 0,
                ),
            )
            # Create a blank meta row if missing; never overwrite existing data.
            conn.execute(
                "INSERT OR IGNORE INTO meta (node_id, notes, tags, marks)"
                " VALUES (?, '', '[]', '{}')",
                (n["id"],),
            )

        # Re-derive edges for the children we just saw, so moves are reflected.
        if node_list:
            ids = [n["id"] for n in node_list]
            placeholders = ",".join("?" * len(ids))
            conn.execute(f"DELETE FROM edges WHERE child_id IN ({placeholders})", ids)
        for e in edge_list:
            conn.execute(
                "INSERT OR IGNORE INTO edges (parent_id, child_id) VALUES (?, ?)",
                (e["parent_id"], e["child_id"]),
            )
        conn.commit()

    return {
        "nodes_upserted": len(node_list),
        "edges_upserted": len(edge_list),
        "source": source or ("derived" if edges_derived else "payload"),
    }


# --------------------------------------------------------------------------- #
# Reads
# --------------------------------------------------------------------------- #
def _row_to_node(row) -> dict:
    return Node.from_row(row).to_dict()


def get_graph() -> dict:
    """Whole graph in one call, for the initial dashboard render."""
    conn = db.get_conn()
    nodes = [_row_to_node(r) for r in conn.execute(SELECT_NODE).fetchall()]
    edges = [
        Edge.from_row(r).to_dict()
        for r in conn.execute("SELECT parent_id, child_id FROM edges").fetchall()
    ]
    known = {n["id"] for n in nodes}
    root_ids = [
        n["id"]
        for n in nodes
        if not n["parent_id"] or n["parent_id"] not in known
    ]
    return {"nodes": nodes, "edges": edges, "root_ids": root_ids}


def get_node(node_id: str) -> dict | None:
    """Node plus its direct children and direct parents."""
    conn = db.get_conn()
    row = conn.execute(SELECT_NODE + " WHERE n.id = ?", (node_id,)).fetchone()
    if row is None:
        return None
    node = _row_to_node(row)
    children = [
        _row_to_node(r)
        for r in conn.execute(
            SELECT_NODE + " WHERE n.parent_id = ? ORDER BY n.type DESC, n.name COLLATE NOCASE",
            (node_id,),
        ).fetchall()
    ]
    parent_ids = [
        r["parent_id"]
        for r in conn.execute(
            "SELECT parent_id FROM edges WHERE child_id = ?", (node_id,)
        ).fetchall()
    ]
    parents = []
    for pid in parent_ids:
        prow = conn.execute(SELECT_NODE + " WHERE n.id = ?", (pid,)).fetchone()
        if prow is not None:
            parents.append(_row_to_node(prow))
    return {"node": node, "children": children, "parents": parents}


def search(
    q: str | None = None,
    tag: str | None = None,
    category: str | None = None,
    type: str | None = None,
) -> list[dict]:
    """Filter nodes by name substring, tag, category and/or type."""
    conn = db.get_conn()
    results = []
    for row in conn.execute(SELECT_NODE).fetchall():
        node = _row_to_node(row)
        meta = node["meta"]
        if q and q.lower() not in (node["name"] or "").lower():
            continue
        if tag and tag not in meta["tags"]:
            continue
        if category and meta["category"] != category:
            continue
        if type and node["type"] != type:
            continue
        results.append(node)
    results.sort(key=lambda n: (n["type"] != "folder", (n["name"] or "").lower()))
    return results


def count() -> tuple[int, int]:
    conn = db.get_conn()
    nodes = conn.execute("SELECT COUNT(*) AS c FROM nodes").fetchone()["c"]
    edges = conn.execute("SELECT COUNT(*) AS c FROM edges").fetchone()["c"]
    return nodes, edges


# --------------------------------------------------------------------------- #
# Metadata writes (with history)
# --------------------------------------------------------------------------- #
def _normalize(field_name: str, value: Any) -> Any:
    if field_name == "tags":
        return [str(t) for t in (value or [])]
    if field_name == "notes":
        return value or ""
    if field_name == "marks":
        return value or {}
    return value


def patch_meta(node_id: str, changes: dict, changed_by: str | None = None) -> dict | None:
    """Apply a partial metadata update and record only the fields that changed."""
    conn = db.get_conn()
    row = conn.execute(SELECT_NODE + " WHERE n.id = ?", (node_id,)).fetchone()
    if row is None:
        return None
    current = _row_to_node(row)["meta"]

    updates: dict[str, Any] = {}
    for field_name in history.TRACKED_FIELDS:
        if field_name not in changes:
            continue
        new_value = _normalize(field_name, changes[field_name])
        if current.get(field_name) == new_value:
            continue
        updates[field_name] = new_value

    if not updates:
        return current_node(conn, node_id)

    timestamp = history.now_iso()
    # tags/marks are stored as JSON text; notes/category as plain text.
    encoded = {
        f: (dumps(v) if f in ("tags", "marks") else v) for f, v in updates.items()
    }
    assignments = ", ".join(f"{f} = ?" for f in encoded)
    with db.write_lock():
        conn.execute(
            f"UPDATE meta SET {assignments}, updated_at = ?, updated_by = ? WHERE node_id = ?",
            (*encoded.values(), timestamp, changed_by, node_id),
        )
        for field_name, new_value in updates.items():
            history.record(
                conn,
                node_id,
                field_name,
                current.get(field_name),
                new_value,
                changed_by=changed_by,
                changed_at=timestamp,
            )
        conn.commit()
    return current_node(conn, node_id)


def current_node(conn, node_id: str) -> dict | None:
    row = conn.execute(SELECT_NODE + " WHERE n.id = ?", (node_id,)).fetchone()
    return _row_to_node(row) if row is not None else None
