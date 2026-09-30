"""Smoke test: ingest a graph, patch metadata, read history back.

Runs against a throwaway database so it never touches shlok/data/tree.db.

    uv run python -m shlok.smoke_test
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from shlok import db, ingest, store
from shlok.history import get_history, meta_at
from shlok.sample_graph import sample_graph


def _fresh_db() -> Path:
    path = Path(tempfile.gettempdir()) / "tree_smoke_test.db"
    for suffix in ("", "-wal", "-shm"):
        candidate = Path(str(path) + suffix)
        if candidate.exists():
            candidate.unlink()
    db._conn = db.connect(path)  # point the store at the throwaway db
    return path


def main() -> None:
    _fresh_db()

    # 1. Ingest the sample graph.
    result = ingest.ingest_graph(sample_graph(), source="smoke")
    assert result["nodes_upserted"] == 11, result
    assert result["edges_upserted"] == 11, result

    graph = store.get_graph()
    ids = {n["id"] for n in graph["nodes"]}
    assert "file-contract" in ids
    assert "root" in graph["root_ids"]

    # The contract file is reachable from two folders (graph, not tree).
    parents = {e["parent_id"] for e in graph["edges"] if e["child_id"] == "file-contract"}
    assert parents == {"f-legal", "f-shared"}, parents

    # 2. Patch metadata -> history is recorded per changed field.
    updated = store.patch_meta(
        "file-contract",
        {"notes": "Signed", "tags": ["contract", "legal"], "category": "Legal"},
        changed_by="tester",
    )
    assert updated["meta"]["notes"] == "Signed"
    assert updated["meta"]["tags"] == ["contract", "legal"]
    assert updated["meta"]["category"] == "Legal"

    entries = get_history("file-contract")
    assert len(entries) == 3, entries
    assert {e["field"] for e in entries} == {"notes", "tags", "category"}
    assert all(e["changed_by"] == "tester" for e in entries)

    # 3. Re-saving identical values records nothing new.
    store.patch_meta(
        "file-contract",
        {"notes": "Signed", "tags": ["contract", "legal"], "category": "Legal"},
        changed_by="tester",
    )
    assert len(get_history("file-contract")) == 3

    # 4. Search by tag / category / name.
    assert [n["id"] for n in store.search(tag="contract")] == ["file-contract"]
    assert [n["id"] for n in store.search(category="Legal")] == ["file-contract"]
    assert {n["id"] for n in store.search(q="report")} == {"file-report"}
    assert {n["id"] for n in store.search(type="folder")} == {
        "root", "f-docs", "f-images", "f-shared", "f-legal",
    }

    # 5. Point-in-time reconstruction before any edit is empty.
    assert meta_at("file-contract", "1970-01-01T00:00:00Z") == {
        "notes": "", "tags": [], "category": None, "marks": {},
    }

    # 6. Re-ingesting must not clobber user metadata.
    ingest.ingest_graph(sample_graph(), source="smoke-again")
    refetched = store.get_node("file-contract")["node"]
    assert refetched["meta"]["notes"] == "Signed"
    assert len(get_history("file-contract")) == 3

    print("smoke test OK")


if __name__ == "__main__":
    main()
