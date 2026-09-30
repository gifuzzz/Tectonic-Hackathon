"""Turn an external graph into stored data.

Sources, in order of preference:

1. archit's ``GoogleDrive`` class (flat file list -> graph) via ``drive_source``.
2. A bundled sample graph, so the demo runs without any Drive credentials.

``sync_from_source`` never raises: if Drive is not configured the sample graph
is used instead, which keeps the web server alive (unlike archit's CLI, which
raises SystemExit when credentials.json is missing).
"""
from __future__ import annotations

from . import drive_source, store
from .sample_graph import sample_graph


def ingest_graph(payload: dict, source: str | None = None) -> dict:
    """Upsert a graph dict: ``{"nodes": [...], "edges": [...]}``."""
    if not isinstance(payload, dict) or "nodes" not in payload:
        raise ValueError("payload must be an object with a 'nodes' list")
    return store.upsert_graph(
        payload.get("nodes") or [],
        payload.get("edges"),
        source=source or payload.get("source") or "api",
    )


def import_from_drive(
    limit: int = 1000,
    search: str | None = None,
    folders_only: bool = False,
) -> dict:
    """Pull archit's Drive file list and store it as our graph.

    Raises if Drive is not set up (caller decides how to handle it).
    """
    graph = drive_source.load_from_drive(
        limit=limit, search=search, folders_only=folders_only
    )
    return ingest_graph(graph, source="drive")


def sync_from_source() -> dict:
    """Live Drive when possible, else the bundled sample graph."""
    try:
        graph = drive_source.load_from_drive()
        if graph.get("nodes"):
            return ingest_graph(graph, source="drive")
    except Exception:
        pass
    return ingest_graph(sample_graph(), source="sample")


def ensure_seeded() -> None:
    """Seed the demo database on first run so the dashboard is never empty."""
    nodes, _ = store.count()
    if nodes == 0:
        ingest_graph(sample_graph(), source="sample")
