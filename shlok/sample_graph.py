"""Bundled sample graph so the dashboard runs without Drive credentials.

Shape matches section 8 of FRONTEND_API.md: {"nodes": [...], "edges": [...]}.
The extra edge from 'f-shared' to 'file-contract' shows the store handles a
graph (a file reachable from two folders), not only a strict tree.
"""
from __future__ import annotations

FOLDER_MIME = "application/vnd.google-apps.folder"


def _folder(node_id: str, name: str, parent_id: str | None) -> dict:
    return {
        "id": node_id,
        "name": name,
        "type": "folder",
        "mime_type": FOLDER_MIME,
        "parent_id": parent_id,
        "size": None,
    }


def _file(node_id: str, name: str, parent_id: str, mime: str, size: int, modified: str) -> dict:
    return {
        "id": node_id,
        "name": name,
        "type": "file",
        "mime_type": mime,
        "parent_id": parent_id,
        "size": size,
        "modified_time": modified,
    }


def sample_graph() -> dict:
    nodes = [
        _folder("root", "My Drive", None),
        _folder("f-docs", "Documents", "root"),
        _folder("f-images", "Images", "root"),
        _folder("f-shared", "Shared Team", "root"),
        _folder("f-legal", "Legal", "f-docs"),
        _file("file-contract", "Contract.pdf", "f-legal", "application/pdf", 184320, "2026-09-28T10:00:00Z"),
        _file("file-nda", "NDA.docx", "f-legal", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 40960, "2026-09-20T09:30:00Z"),
        _file("file-report", "Q3 Report.xlsx", "f-docs", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 92160, "2026-09-29T16:45:00Z"),
        _file("file-logo", "logo.png", "f-images", "image/png", 15360, "2026-08-11T12:00:00Z"),
        _file("file-budget", "Budget.xlsx", "f-shared", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 30720, "2026-09-15T08:15:00Z"),
        _file("file-roadmap", "Roadmap.md", "f-shared", "text/markdown", 5120, "2026-09-27T18:05:00Z"),
    ]
    edges = [
        {"parent_id": n["parent_id"], "child_id": n["id"]}
        for n in nodes
        if n.get("parent_id")
    ]
    # Graph, not tree: the contract is shared into the team folder too.
    edges.append({"parent_id": "f-shared", "child_id": "file-contract"})
    return {"nodes": nodes, "edges": edges, "source": "sample"}
