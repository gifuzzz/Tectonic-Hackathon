"""SQLite connection and schema for the Drive dashboard storage layer.

One file, no external dependencies: `shlok/data/tree.db`.
"""
from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
DB_PATH = DATA_DIR / "tree.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS nodes (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL DEFAULT '',
    type          TEXT NOT NULL DEFAULT 'file',
    mime_type     TEXT,
    parent_id     TEXT,
    size          INTEGER,
    modified_time TEXT,
    trashed       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edges (
    parent_id TEXT NOT NULL,
    child_id  TEXT NOT NULL,
    PRIMARY KEY (parent_id, child_id)
);

CREATE TABLE IF NOT EXISTS meta (
    node_id    TEXT PRIMARY KEY,
    notes      TEXT NOT NULL DEFAULT '',
    tags       TEXT NOT NULL DEFAULT '[]',
    category   TEXT,
    marks      TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT,
    updated_by TEXT
);

CREATE TABLE IF NOT EXISTS meta_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id    TEXT NOT NULL,
    field      TEXT NOT NULL,
    old_value  TEXT,
    new_value  TEXT,
    changed_at TEXT NOT NULL,
    changed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_edges_parent ON edges(parent_id);
CREATE INDEX IF NOT EXISTS idx_edges_child  ON edges(child_id);
CREATE INDEX IF NOT EXISTS idx_history_node ON meta_history(node_id);
"""

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def connect(db_path: str | Path = DB_PATH) -> sqlite3.Connection:
    """Open a connection (creating the file/dirs) and apply the schema."""
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def get_conn() -> sqlite3.Connection:
    """Process-wide connection.

    FastAPI runs sync handlers in a threadpool, so the connection is created
    with ``check_same_thread=False`` and all writes go through ``write_lock``.
    """
    global _conn
    if _conn is None:
        _conn = connect()
    return _conn


def write_lock() -> threading.Lock:
    """Serialise writes; SQLite allows a single writer at a time."""
    return _lock
