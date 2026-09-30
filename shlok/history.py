"""Append-only metadata history and point-in-time reconstruction."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from . import db
from .models import HistoryEntry, dumps

TRACKED_FIELDS = ("notes", "tags", "category", "marks")


def now_iso() -> str:
    """UTC timestamp in the ISO-8601 'Z' form used across the API."""
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def record(
    conn,
    node_id: str,
    field: str,
    old_value: Any,
    new_value: Any,
    changed_by: str | None = None,
    changed_at: str | None = None,
) -> None:
    """Append one history row. Caller is responsible for committing."""
    conn.execute(
        "INSERT INTO meta_history"
        " (node_id, field, old_value, new_value, changed_at, changed_by)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (node_id, field, dumps(old_value), dumps(new_value), changed_at or now_iso(), changed_by),
    )


def get_history(node_id: str, field: str | None = None) -> list[dict]:
    """History for a node, newest first, optionally filtered to one field."""
    conn = db.get_conn()
    if field:
        rows = conn.execute(
            "SELECT * FROM meta_history WHERE node_id = ? AND field = ? ORDER BY id DESC",
            (node_id, field),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM meta_history WHERE node_id = ? ORDER BY id DESC",
            (node_id,),
        ).fetchall()
    return [HistoryEntry.from_row(r).to_dict() for r in rows]


def meta_at(node_id: str, timestamp: str) -> dict:
    """Reconstruct the metadata as it was at (or before) ``timestamp``."""
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT * FROM meta_history WHERE node_id = ? AND changed_at <= ? ORDER BY id ASC",
        (node_id, timestamp),
    ).fetchall()
    state: dict[str, Any] = {"notes": "", "tags": [], "category": None, "marks": {}}
    for row in rows:
        try:
            state[row["field"]] = json.loads(row["new_value"])
        except (TypeError, ValueError):
            state[row["field"]] = row["new_value"]
    return state
