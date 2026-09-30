"""Plain dataclasses mirroring the JSON shapes in FRONTEND_API.md."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


def loads(value: Any, default: Any) -> Any:
    """Decode a JSON column, tolerating already-decoded values and blanks."""
    if value is None or value == "":
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


@dataclass
class Meta:
    """App-owned categorisation data attached to a file or folder."""

    notes: str = ""
    tags: list[str] = field(default_factory=list)
    category: str | None = None
    marks: dict[str, Any] = field(default_factory=dict)
    updated_at: str | None = None
    updated_by: str | None = None

    @classmethod
    def from_row(cls, row) -> "Meta":
        keys = row.keys()
        return cls(
            notes=(row["notes"] or "") if "notes" in keys else "",
            tags=loads(row["tags"], []) if "tags" in keys else [],
            category=row["category"] if "category" in keys else None,
            marks=loads(row["marks"], {}) if "marks" in keys else {},
            updated_at=row["updated_at"] if "updated_at" in keys else None,
            updated_by=row["updated_by"] if "updated_by" in keys else None,
        )

    def to_dict(self) -> dict:
        return {
            "notes": self.notes,
            "tags": list(self.tags),
            "category": self.category,
            "marks": dict(self.marks),
            "updated_at": self.updated_at,
            "updated_by": self.updated_by,
        }


@dataclass
class Node:
    """A Drive file or folder plus its metadata."""

    id: str
    name: str
    type: str
    mime_type: str | None = None
    parent_id: str | None = None
    size: int | None = None
    modified_time: str | None = None
    trashed: bool = False
    meta: Meta = field(default_factory=Meta)

    @classmethod
    def from_row(cls, row) -> "Node":
        return cls(
            id=row["id"],
            name=row["name"] or "",
            type=row["type"] or "file",
            mime_type=row["mime_type"],
            parent_id=row["parent_id"],
            size=row["size"],
            modified_time=row["modified_time"],
            trashed=bool(row["trashed"]),
            meta=Meta.from_row(row),
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "mime_type": self.mime_type,
            "parent_id": self.parent_id,
            "size": self.size,
            "modified_time": self.modified_time,
            "trashed": self.trashed,
            "meta": self.meta.to_dict(),
        }


@dataclass
class Edge:
    parent_id: str
    child_id: str

    @classmethod
    def from_row(cls, row) -> "Edge":
        return cls(parent_id=row["parent_id"], child_id=row["child_id"])

    def to_dict(self) -> dict:
        return {"parent_id": self.parent_id, "child_id": self.child_id}


@dataclass
class HistoryEntry:
    id: int
    node_id: str
    field: str
    old_value: Any
    new_value: Any
    changed_at: str
    changed_by: str | None = None

    @classmethod
    def from_row(cls, row) -> "HistoryEntry":
        return cls(
            id=row["id"],
            node_id=row["node_id"],
            field=row["field"],
            old_value=loads(row["old_value"], None),
            new_value=loads(row["new_value"], None),
            changed_at=row["changed_at"],
            changed_by=row["changed_by"],
        )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "node_id": self.node_id,
            "field": self.field,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "changed_at": self.changed_at,
            "changed_by": self.changed_by,
        }
