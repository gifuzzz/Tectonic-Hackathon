"""Drive sync -> extract text + metadata -> enrichment -> chunks/embeddings -> relationships -> conflicts."""
import hashlib
import logging
from collections import defaultdict
from datetime import date

from django.db import transaction
from django.utils.dateparse import parse_datetime

from . import llm
from .conflicts import detect_conflicts
from .drive_client import FOLDER_MIME
from .enrich import base_name, enrich_file
from .models import Customer, DocumentChunk, DriveFile

logger = logging.getLogger(__name__)

DEMO_PREFIX = "demo-"  # drive_id prefix of seed_demo files; sync leaves them alone
MAX_TEXT_CHARS = 200_000
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 200
MAX_CHUNKS = 40


def sync_drive(client, with_content=True, force=False):
    """Pull everything from Drive and (re)ingest new or changed files. Returns counts."""
    client.authenticate()
    drive_names = client.list_shared_drives()
    items = list(client.list_all_files())
    folders = {i["id"]: i for i in items if i.get("mimeType") == FOLDER_MIME}
    existing = {f.drive_id: f for f in DriveFile.objects.all()}

    changed = []
    for item in items:
        f = existing.get(item["id"]) or DriveFile(drive_id=item["id"])
        modified = parse_datetime(item["modifiedTime"]) if item.get("modifiedTime") else None
        is_changed = force or f.pk is None or f.trashed or f.drive_modified_at != modified
        apply_metadata(f, item, folders, drive_names, modified)
        if is_changed and not f.is_folder:
            if "permissions" not in item:
                f.permissions = [_permission(p) for p in client.get_permissions(item["id"])]
            if with_content:
                try:
                    text = client.extract_text(item)
                except Exception:
                    logger.exception("Could not read content of %s", f.name)
                    text = ""
                f.content_text = text[:MAX_TEXT_CHARS]
                f.content_hash = hashlib.sha256(f.content_text.encode()).hexdigest()
            changed.append(f)
        f.save()

    seen = {i["id"] for i in items}
    gone = [d for d in existing if d not in seen and not d.startswith(DEMO_PREFIX)]
    for i in range(0, len(gone), 500):
        DriveFile.objects.filter(drive_id__in=gone[i : i + 500]).update(trashed=True)

    customers = list(Customer.objects.all())
    for n, f in enumerate(changed, start=1):
        logger.info("Ingesting %d/%d: %s", n, len(changed), f.name)
        ingest_file(f, customers)
    link_supersessions()
    conflicts = detect_conflicts()
    return {"files": len(items), "changed": len(changed), "removed": len(gone), "unresolvedConflicts": conflicts}


def apply_metadata(f, item, folders, drive_names, modified):
    f.name = item.get("name", "")[:500]
    f.mime_type = item.get("mimeType", "")
    f.is_folder = f.mime_type == FOLDER_MIME
    f.parent_ids = item.get("parents", [])
    f.shared_drive_id = item.get("driveId", "")
    f.shared_drive_name = drive_names.get(f.shared_drive_id, "")
    f.path = folder_path(item, folders, drive_names)[:2000]
    f.owners = [
        {"name": o.get("displayName", ""), "email": o.get("emailAddress", ""), "role": "owner"}
        for o in item.get("owners", [])
    ]
    if not f.owners and item.get("lastModifyingUser"):  # shared-drive files have no owner
        u = item["lastModifyingUser"]
        f.owners = [{"name": u.get("displayName", ""), "email": u.get("emailAddress", ""), "role": "lastModifier"}]
    if "permissions" in item:
        f.permissions = [_permission(p) for p in item["permissions"]]
    f.web_view_link = item.get("webViewLink", "")[:1000]
    f.size = int(item["size"]) if item.get("size") else None
    f.drive_modified_at = modified
    f.md5 = item.get("md5Checksum", "")
    f.trashed = False


def _permission(p):
    return {
        "type": p.get("type", ""),
        "role": p.get("role", ""),
        "email": p.get("emailAddress", ""),
        "domain": p.get("domain", ""),
        "name": p.get("displayName", ""),
    }


def folder_path(item, folders, drive_names):
    """ "Shared drive name / Folder / Subfolder" for the folder that contains the item."""
    parts, seen = [], set()
    parent = (item.get("parents") or [None])[0]
    while parent in folders and parent not in seen:
        seen.add(parent)
        parts.append(folders[parent].get("name", ""))
        parent = (folders[parent].get("parents") or [None])[0]
    if item.get("driveId"):
        root = drive_names.get(item["driveId"], "Shared drive")
    elif item.get("parents"):
        root = "My Drive"
    else:
        root = "Shared with me"
    return " / ".join([root, *reversed(parts)])


def ingest_file(f, customers=None):
    """Enrich, save and re-index one file."""
    enrich_file(f, customers)
    f.save()
    index_file(f)


def chunk_text(text):
    text = " ".join(text.split())
    chunks, start = [], 0
    while start < len(text) and len(chunks) < MAX_CHUNKS:
        chunks.append(text[start : start + CHUNK_CHARS])
        start += CHUNK_CHARS - CHUNK_OVERLAP
    return chunks


def index_file(f):
    header = f"{f.name}\n{f.path}"
    pieces = [f"{header}\n{c}" for c in chunk_text(f.content_text)] or [header]
    embeddings = [None] * len(pieces)
    if llm.enabled():
        try:
            embeddings = llm.embed(pieces)
        except Exception:
            logger.exception("Embedding failed for %s; it stays keyword-searchable", f.name)
    with transaction.atomic():
        f.chunks.all().delete()
        DocumentChunk.objects.bulk_create(
            DocumentChunk(file=f, index=i, text=text, embedding=emb)
            for i, (text, emb) in enumerate(zip(pieces, embeddings))
        )


def _sort_key(f):
    return (f.effective_date or date.min, f.drive_modified_at.timestamp() if f.drive_modified_at else 0, f.id)


@transaction.atomic
def link_supersessions():
    """Recompute "file supersedes file" from explicit "Supersedes: <title>" lines, then from versions
    of the same document (same base title, customer and country): each newer one supersedes the previous."""
    files = list(DriveFile.objects.filter(trashed=False, is_folder=False))
    by_base = defaultdict(list)
    for f in files:
        if base_name(f.name):
            by_base[base_name(f.name)].append(f)

    links = {}
    for f in files:
        if f.supersedes_hint:
            target = next(
                (t for t in by_base.get(base_name(f.supersedes_hint), []) if t.id != f.id and links.get(t.id) != f.id),
                None,
            )
            if target:
                links[f.id] = target.id

    versions = defaultdict(list)
    for base, group in by_base.items():
        for f in group:
            versions[(base, f.customer_id, f.country)].append(f)
    for group in versions.values():
        group.sort(key=_sort_key)
        for older, newer in zip(group, group[1:]):
            if newer.id not in links and links.get(older.id) != newer.id:
                links[newer.id] = older.id

    for f in files:
        target = links.get(f.id)
        if f.supersedes_id != target:
            f.supersedes_id = target
            f.save(update_fields=["supersedes"])
