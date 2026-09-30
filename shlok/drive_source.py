"""Adapter over archit's ``GoogleDrive`` class: flat file list -> our graph.

archit's ``list_files()`` returns dicts like::

    {"id", "name", "mimeType", "size", "modifiedTime", "parents", "webViewLink"}

This module turns that flat list into the ``{"nodes": [...], "edges": [...]}``
shape our store understands. It is the only place that knows about Drive.
"""
from __future__ import annotations

FOLDER_MIME = "application/vnd.google-apps.folder"


def to_graph(files) -> dict:
    """Map a flat Drive file list to ``{"nodes", "edges"}``.

    A file's primary parent comes from ``parents[0]``; every parent also becomes
    an edge, so shared files end up with several parents (a graph, not a tree).
    """
    nodes: list[dict] = []
    edges: list[dict] = []
    seen_edges: set[tuple[str, str]] = set()

    for f in files or []:
        file_id = f.get("id")
        if not file_id:
            continue
        mime = f.get("mimeType")
        parents = [p for p in (f.get("parents") or []) if p]
        nodes.append(
            {
                "id": file_id,
                "name": f.get("name") or "",
                "type": "folder" if mime == FOLDER_MIME else "file",
                "mime_type": mime,
                "parent_id": parents[0] if parents else None,
                "size": f.get("size"),
                "modified_time": f.get("modifiedTime"),
                "trashed": bool(f.get("trashed", False)),
            }
        )
        for parent in parents:
            key = (parent, file_id)
            if key not in seen_edges:
                seen_edges.add(key)
                edges.append({"parent_id": parent, "child_id": file_id})

    return {"nodes": nodes, "edges": edges, "source": "drive"}


def is_available() -> bool:
    """True when archit's module can be imported (Drive libs installed)."""
    try:
        from archit.drive import GoogleDrive  # noqa: F401
    except Exception:
        return False
    return True


def load_from_drive(limit: int = 1000, search: str | None = None, folders_only: bool = False) -> dict:
    """Authenticate with archit's class and return our graph shape.

    Raises if Drive is not configured; callers that must not fail should catch
    and fall back to the sample graph.
    """
    from archit.drive import GoogleDrive

    drive = GoogleDrive()
    drive.authenticate()
    files = drive.list_files(limit=limit, search=search, folders_only=folders_only)
    return to_graph(files)
