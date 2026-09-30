"""Node JSON: Drive data + knowledge (enrichment) data + our data (meta, notes, versions) in one shape."""
from knowledge.enrich import COUNTRY_NAMES
from knowledge.serializers import customer_dict

from .browse import SEP
from .models import FileMeta
from .services import current_version, meta_state


def _iso(value):
    return value.isoformat() if value else None


def file_meta(f):
    try:
        return f.meta
    except FileMeta.DoesNotExist:
        return None


def full_path(f):
    return f"{f.path}{SEP}{f.name}" if f.path else f.name


def meta_dict(f):
    meta = file_meta(f)
    return {
        **meta_state(meta),
        "updatedAt": _iso(meta.updated_at) if meta else None,
        "updatedBy": meta.updated_by if meta else "",
    }


def knowledge_dict(f):
    if f.is_folder:
        return None
    return {
        "country": f.country,
        "countryName": COUNTRY_NAMES.get(f.country, ""),
        "customer": customer_dict(f.customer),
        "topic": f.topic,
        "documentType": f.document_type,
        "status": f.status,
        "effectiveDate": _iso(f.effective_date),
        "expiryDate": _iso(f.expiry_date),
        "owner": {"id": f.owner.id, "name": f.owner.name, "email": f.owner.email} if f.owner else None,
        "ownerEmail": f.owner_email,
        "summary": f.summary,
    }


def node_dict(f, child_count=None):
    version = getattr(f, "version", None)
    notes_count = getattr(f, "notes_count", None)
    return {
        "id": f.drive_id,
        "pk": f.id,
        "name": f.name,
        "type": "folder" if f.is_folder else "file",
        "virtual": False,
        "mimeType": f.mime_type,
        "parentId": f.parent_ids[0] if f.parent_ids else None,
        "path": f.path,
        "fullPath": full_path(f),
        "trashed": f.trashed,
        "drive": {
            "owners": f.owners,
            "modifiedAt": _iso(f.drive_modified_at),
            "size": f.size,
            "webViewLink": f.web_view_link,
            "sharedDrive": f.shared_drive_name or None,
        },
        "knowledge": knowledge_dict(f),
        "meta": meta_dict(f),
        "notesCount": notes_count if notes_count is not None else f.notes.count(),
        "version": version if version is not None else current_version(f),
        "childCount": child_count,
    }


def virtual_folder_dict(name, path, child_count=None):
    return {
        "id": None, "pk": None, "name": name, "type": "folder", "virtual": True, "mimeType": None,
        "parentId": None, "path": path.rsplit(SEP, 1)[0] if SEP in path else "", "fullPath": path,
        "trashed": False, "drive": None, "knowledge": None, "meta": None, "notesCount": 0, "version": 0,
        "childCount": child_count,
    }


def mention_dict(m):
    current = current_version(m.file)
    return {
        "id": m.file.drive_id,
        "pk": m.file.id,
        "name": m.file.name,
        "fullPath": full_path(m.file),
        "mentionedVersion": m.version,
        "currentVersion": current,
        "outdated": current > m.version,
    }


def note_tree(f):
    notes = list(f.notes.prefetch_related("mentions__file"))
    by_parent = {}
    for n in notes:
        by_parent.setdefault(n.parent_id, []).append(n)

    def build(n):
        return {
            "id": n.id,
            "parentId": n.parent_id,
            "author": n.author,
            "text": n.text,
            "validity": n.validity,
            "createdAt": _iso(n.created_at),
            "mentions": [mention_dict(m) for m in n.mentions.all()],
            "replies": [build(r) for r in by_parent.get(n.id, [])],
        }

    return [build(n) for n in by_parent.get(None, [])]


def change_dict(c):
    return {
        "id": c.id,
        "action": c.action,
        "field": c.field,
        "oldValue": c.old_value,
        "newValue": c.new_value,
        "changedBy": c.changed_by,
        "changedAt": _iso(c.changed_at),
        "noteId": c.note_id,
    }


def version_dict(v):
    return {"number": v.number, "name": v.name, "modifiedAt": _iso(v.modified_at), "size": v.size,
            "recordedAt": _iso(v.recorded_at)}


def user_dict(u):
    return {"email": u.email, "name": u.name, "companies": [c.name for c in u.companies.all()],
            "countries": u.countries, "seeAll": u.see_all}


def suggestion_dict(s):
    return {
        "id": s.id,
        "file": {"id": s.file.drive_id, "pk": s.file.id, "name": s.file.name, "fullPath": full_path(s.file)},
        "source": s.source,
        "sender": s.sender,
        "excerpt": s.excerpt,
        "kind": s.kind,
        "suggestedNote": s.suggested_note,
        "suggestedValidity": s.suggested_validity,
        "reason": s.reason,
        "status": s.status,
        "createdAt": _iso(s.created_at),
        "decidedBy": s.decided_by,
        "decidedAt": _iso(s.decided_at),
    }
