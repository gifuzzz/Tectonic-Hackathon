"""Runnable checks for the whole storage layer. No pytest needed.

Runs against a throwaway database in the temp dir, so it never touches
``shlok/data/tree.db``. Prints PASS/FAIL per check and exits non-zero if any
check fails.

    uv run python -m shlok.test_db
"""
from __future__ import annotations

import tempfile
from pathlib import Path

from shlok import db, ingest, store
from shlok.drive_source import to_graph
from shlok.history import get_history, meta_at
from shlok.sample_graph import sample_graph

RESULTS: list[tuple[str, bool, str]] = []


def check(name: str, fn) -> None:
    try:
        fn()
    except AssertionError as exc:
        RESULTS.append((name, False, str(exc) or "assertion failed"))
    except Exception as exc:  # noqa: BLE001 - report every failure kind
        RESULTS.append((name, False, f"{type(exc).__name__}: {exc}"))
    else:
        RESULTS.append((name, True, ""))


def fresh_db() -> Path:
    """Point the store at an empty throwaway database."""
    path = Path(tempfile.gettempdir()) / "tree_testdb.db"
    for suffix in ("", "-wal", "-shm"):
        candidate = Path(str(path) + suffix)
        if candidate.exists():
            candidate.unlink()
    db._conn = db.connect(path)
    return path


# --------------------------------------------------------------------------- #
# Checks
# --------------------------------------------------------------------------- #
def check_ingest_counts() -> None:
    result = ingest.ingest_graph(sample_graph(), source="test")
    assert result["nodes_upserted"] == 11, result
    assert result["edges_upserted"] == 11, result


def check_nodes_saved() -> None:
    ids = {n["id"] for n in store.get_graph()["nodes"]}
    assert "file-contract" in ids and "f-legal" in ids, ids


def check_roots() -> None:
    assert store.get_graph()["root_ids"] == ["root"], store.get_graph()["root_ids"]


def check_shared_file_has_two_parents() -> None:
    parents = {
        e["parent_id"]
        for e in store.get_graph()["edges"]
        if e["child_id"] == "file-contract"
    }
    assert parents == {"f-legal", "f-shared"}, parents


def check_get_node_children() -> None:
    data = store.get_node("f-legal")
    assert data is not None
    names = {c["name"] for c in data["children"]}
    assert names == {"Contract.pdf", "NDA.docx"}, names


def check_get_node_parents() -> None:
    data = store.get_node("file-contract")
    assert {p["id"] for p in data["parents"]} == {"f-legal", "f-shared"}, data["parents"]


def check_patch_metadata() -> None:
    node = store.patch_meta(
        "file-contract",
        {"notes": "Signed", "tags": ["contract", "legal"], "category": "Legal"},
        changed_by="alice",
    )
    assert node is not None
    assert node["meta"]["notes"] == "Signed", node["meta"]
    assert node["meta"]["tags"] == ["contract", "legal"], node["meta"]
    assert node["meta"]["category"] == "Legal", node["meta"]
    assert node["meta"]["marks"] == {}, node["meta"]


def check_patch_marks() -> None:
    node = store.patch_meta("file-contract", {"marks": {"reviewed": True}}, changed_by="alice")
    assert node["meta"]["marks"] == {"reviewed": True}, node["meta"]


def check_metadata_persisted() -> None:
    node = store.get_node("file-contract")["node"]
    assert node["meta"]["notes"] == "Signed"
    assert node["meta"]["tags"] == ["contract", "legal"]
    assert node["meta"]["marks"] == {"reviewed": True}
    assert node["meta"]["updated_by"] == "alice", node["meta"]


def check_history_per_field() -> None:
    fields = {e["field"] for e in get_history("file-contract")}
    assert fields == {"notes", "tags", "category", "marks"}, fields


def check_history_old_new() -> None:
    entry = next(e for e in get_history("file-contract") if e["field"] == "tags")
    assert entry["old_value"] == [], entry
    assert entry["new_value"] == ["contract", "legal"], entry


def check_history_author() -> None:
    assert all(e["changed_by"] == "alice" for e in get_history("file-contract")), get_history(
        "file-contract"
    )


def check_noop_patch_no_history() -> None:
    before = len(get_history("file-contract"))
    store.patch_meta(
        "file-contract",
        {"notes": "Signed", "tags": ["contract", "legal"], "category": "Legal"},
        changed_by="alice",
    )
    assert len(get_history("file-contract")) == before, "no-op patch wrote history"


def check_history_newest_first() -> None:
    store.patch_meta("file-report", {"notes": "first"}, changed_by="bob")
    store.patch_meta("file-report", {"category": "Finance"}, changed_by="carol")
    history = get_history("file-report")
    assert history[0]["field"] == "category", history
    assert history[0]["changed_by"] == "carol", history


def check_history_field_filter() -> None:
    only = get_history("file-contract", field="tags")
    assert len(only) == 1 and only[0]["field"] == "tags", only


def check_meta_at_before_edits() -> None:
    assert meta_at("file-contract", "1970-01-01T00:00:00Z") == {
        "notes": "",
        "tags": [],
        "category": None,
        "marks": {},
    }


def check_meta_at_reflects_later_state() -> None:
    state = meta_at("file-contract", "2999-01-01T00:00:00Z")
    assert state["notes"] == "Signed", state
    assert state["tags"] == ["contract", "legal"], state


def check_search_by_tag() -> None:
    assert [n["id"] for n in store.search(tag="contract")] == ["file-contract"]


def check_search_by_category() -> None:
    assert [n["id"] for n in store.search(category="Finance")] == ["file-report"]


def check_search_by_name() -> None:
    assert {n["id"] for n in store.search(q="report")} == {"file-report"}


def check_search_by_type() -> None:
    folders = {n["id"] for n in store.search(type="folder")}
    assert folders == {"root", "f-docs", "f-images", "f-shared", "f-legal"}, folders
    assert [n["id"] for n in store.search(type="file", tag="contract")] == ["file-contract"]


def check_reingest_preserves_metadata() -> None:
    before = len(get_history("file-contract"))
    ingest.ingest_graph(sample_graph(), source="test-again")
    node = store.get_node("file-contract")["node"]
    assert node["meta"]["notes"] == "Signed", node["meta"]
    assert node["meta"]["tags"] == ["contract", "legal"], node["meta"]
    assert len(get_history("file-contract")) == before, "re-ingest wrote history"


def check_reingest_updates_drive_fields() -> None:
    moved = sample_graph()
    for node in moved["nodes"]:
        if node["id"] == "file-report":
            node["name"] = "Q3 Report (final).xlsx"
            node["size"] = 100000
    ingest.ingest_graph(moved, source="test-move")
    node = store.get_node("file-report")["node"]
    assert node["name"] == "Q3 Report (final).xlsx", node
    assert node["size"] == 100000, node
    assert node["meta"]["notes"] == "first", "metadata lost on re-ingest"


def check_edges_idempotent() -> None:
    _, edges_before = store.count()
    ingest.ingest_graph(sample_graph(), source="test-idem")
    _, edges_after = store.count()
    assert edges_before == edges_after, (edges_before, edges_after)


def check_unknown_node_is_none() -> None:
    assert store.get_node("nope") is None
    assert store.patch_meta("nope", {"notes": "x"}) is None
    assert get_history("nope") == []


def check_archit_drive_mapping() -> None:
    """Mapping from archit's flat list_files() output into our graph."""
    files = [
        {"id": "A", "name": "Team", "mimeType": "application/vnd.google-apps.folder",
         "size": None, "modifiedTime": "2026-09-01T00:00:00Z", "parents": []},
        {"id": "B", "name": "Plan.md", "mimeType": "text/markdown",
         "size": 10, "modifiedTime": "2026-09-02T00:00:00Z", "parents": ["A", "ROOT"]},
    ]
    graph = to_graph(files)
    assert [n["id"] for n in graph["nodes"]] == ["A", "B"], graph
    assert graph["nodes"][0]["type"] == "folder", graph["nodes"][0]
    assert graph["nodes"][1]["type"] == "file", graph["nodes"][1]
    assert graph["nodes"][1]["parent_id"] == "A", graph["nodes"][1]
    assert {"parent_id": "A", "child_id": "B"} in graph["edges"], graph["edges"]
    assert {"parent_id": "ROOT", "child_id": "B"} in graph["edges"], graph["edges"]


def check_archit_drive_end_to_end_stubbed() -> None:
    """ingest.import_from_drive() using a stub GoogleDrive (no network)."""
    import archit.drive as ad

    class StubDrive:
        def __init__(self, *args, **kwargs):
            pass

        def authenticate(self):
            pass

        def list_files(self, limit=20, search=None, folders_only=False):
            return [
                {"id": "S-root", "name": "My Drive", "mimeType": "application/vnd.google-apps.folder",
                 "size": None, "modifiedTime": "2026-09-01T00:00:00Z", "parents": []},
                {"id": "S-file", "name": "Stub.txt", "mimeType": "text/plain",
                 "size": 5, "modifiedTime": "2026-09-03T00:00:00Z", "parents": ["S-root"]},
            ]

    original = ad.GoogleDrive
    ad.GoogleDrive = StubDrive
    try:
        result = ingest.import_from_drive()
    finally:
        ad.GoogleDrive = original

    assert result["source"] == "drive", result
    assert result["nodes_upserted"] == 2, result
    node = store.get_node("S-file")
    assert node is not None and node["node"]["name"] == "Stub.txt", node
    assert {p["id"] for p in node["parents"]} == {"S-root"}, node["parents"]
    # Metadata on a Drive-imported node is writable and tracked.
    store.patch_meta("S-file", {"tags": ["from-drive"]}, changed_by="dave")
    assert [n["id"] for n in store.search(tag="from-drive")] == ["S-file"]
    assert get_history("S-file")[0]["changed_by"] == "dave"


# --------------------------------------------------------------------------- #
# Runner
# --------------------------------------------------------------------------- #
CHECKS = [
    ("ingest sample graph counts", check_ingest_counts),
    ("nodes saved", check_nodes_saved),
    ("root detection", check_roots),
    ("shared file has two parents", check_shared_file_has_two_parents),
    ("get_node returns children", check_get_node_children),
    ("get_node returns parents", check_get_node_parents),
    ("patch notes/tags/category", check_patch_metadata),
    ("patch marks", check_patch_marks),
    ("metadata persisted", check_metadata_persisted),
    ("history records each changed field", check_history_per_field),
    ("history stores old and new values", check_history_old_new),
    ("history stores who changed it", check_history_author),
    ("no-op patch writes no history", check_noop_patch_no_history),
    ("history newest first", check_history_newest_first),
    ("history filter by field", check_history_field_filter),
    ("point-in-time: before edits is empty", check_meta_at_before_edits),
    ("point-in-time: reflects later state", check_meta_at_reflects_later_state),
    ("search by tag", check_search_by_tag),
    ("search by category", check_search_by_category),
    ("search by name", check_search_by_name),
    ("search by type", check_search_by_type),
    ("re-ingest preserves metadata", check_reingest_preserves_metadata),
    ("re-ingest updates Drive fields", check_reingest_updates_drive_fields),
    ("edges idempotent on re-ingest", check_edges_idempotent),
    ("unknown node handled", check_unknown_node_is_none),
    ("archit list_files -> graph mapping", check_archit_drive_mapping),
    ("archit GoogleDrive import (stubbed)", check_archit_drive_end_to_end_stubbed),
]


def main() -> None:
    db_path = fresh_db()
    print(f"test db: {db_path}\n")

    for name, fn in CHECKS:
        check(name, fn)

    passed = sum(1 for _, ok, _ in RESULTS if ok)
    failed = len(RESULTS) - passed

    for name, ok, message in RESULTS:
        status = "PASS" if ok else "FAIL"
        suffix = "" if ok else f"  <- {message}"
        print(f"[{status}] {name}{suffix}")

    print(f"\n{passed} passed, {failed} failed, {len(RESULTS)} total")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
