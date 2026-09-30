"""Storage API (ported from shlok's FastAPI app) + folder browsing, notes, versions, visibility, suggestions."""
import os
from collections import defaultdict

from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt

from knowledge import views as knowledge_views
from knowledge.drive_client import FOLDER_MIME, DriveClient
from knowledge.ingestion import ingest_items, sync_drive
from knowledge.models import DriveFile
from knowledge.serializers import conflict_dict
from knowledge.trust import Context, evaluate
from knowledge.views import _body, _country, _customer, _int, _str, api

from . import services
from .access import author_name, can_see, viewer_for
from .browse import SEP, annotated_files, browse as browse_path
from .models import ChangeLog, Note, Suggestion, UserAccess

from .serializers import (
    change_dict, file_meta, node_dict, note_tree, suggestion_dict, user_dict, version_dict, virtual_folder_dict,
)


def _file(request, drive_id):
    """A file the current viewer may see (404 otherwise, so hidden files don't leak)."""
    f = get_object_or_404(annotated_files(), drive_id=drive_id)
    if not can_see(f, viewer_for(request)):
        raise Http404("Unknown node id")
    return f


@api("GET")
def health(request):
    return {
        "status": "ok",
        "nodes": DriveFile.objects.filter(trashed=False).count(),
        "folders": DriveFile.objects.filter(trashed=False, is_folder=True).count(),
        "notes": Note.objects.count(),
    }


@api("GET")
def browse(request):
    """GET /api/browse?path=HR Knowledge / Payroll -> folder data + Drive data + our data for its children."""
    viewer = viewer_for(request)
    result = browse_path(request.GET.get("path", ""), viewer)
    if result is None:
        raise Http404(f"Nothing at path: {request.GET.get('path', '')}")
    segs, folder, children, counts = result
    path = SEP.join(segs)
    if folder is None:
        folder_json = virtual_folder_dict(segs[-1] if segs else "Drive", path, len(children))
    else:
        folder_json = node_dict(folder, len(children) if folder.is_folder else None)
    return {
        "path": path,
        "segments": list(segs),
        "breadcrumbs": [{"name": s, "path": SEP.join(segs[: i + 1])} for i, s in enumerate(segs)],
        "folder": folder_json,
        "children": [
            node_dict(c["file"], counts[c["path"]] if c["file"].is_folder else None)
            if c["file"] is not None
            else virtual_folder_dict(c["name"], c["path"], counts[c["path"]])
            for c in children
        ],
    }


@api("GET")
def graph(request):
    viewer = viewer_for(request)
    files = [f for f in annotated_files() if can_see(f, viewer)]
    known = {f.drive_id for f in files}
    edges = [{"parentId": p, "childId": f.drive_id} for f in files for p in f.parent_ids if p in known]
    return {
        "nodes": [node_dict(f) for f in files],
        "edges": edges,
        "rootIds": [f.drive_id for f in files if not any(p in known for p in f.parent_ids)],
    }


@api("GET")
def node(request, drive_id):
    """Everything about one file or folder: Drive + knowledge + trust + our meta, notes, history, versions."""
    f = _file(request, drive_id)
    viewer = viewer_for(request)
    ctx = Context(country=_country(request.GET.get("country")), customer=_customer(request.GET.get("customer")))
    # Parent ids live in a JSON list, which SQLite can't query, so children are found in Python.
    children = [c for c in annotated_files() if f.drive_id in c.parent_ids and can_see(c, viewer)] if f.is_folder else []
    parents = [p for p in annotated_files().filter(drive_id__in=f.parent_ids) if can_see(p, viewer)]
    conflicts = [*f.conflicts_as_a.select_related("file_a", "file_b"), *f.conflicts_as_b.select_related("file_a", "file_b")]
    mentioned_in = f.mentioned_in.select_related("note__file")
    data = node_dict(f)
    data["drive"]["permissions"] = f.permissions
    return {
        "node": data,
        "children": [node_dict(c) for c in sorted(children, key=lambda c: (not c.is_folder, c.name.lower()))],
        "parents": [node_dict(p) for p in parents],
        "trust": None if f.is_folder else evaluate(f, ctx),
        "claims": f.claims,
        "supersedes": {"id": f.supersedes.drive_id, "name": f.supersedes.name} if f.supersedes else None,
        "supersededBy": [{"id": s.drive_id, "name": s.name} for s in f.superseded_by.filter(trashed=False)],
        "conflicts": [conflict_dict(c) for c in sorted(conflicts, key=lambda c: c.id)],
        "notes": note_tree(f),
        "history": [change_dict(c) for c in f.changes.all()[:200]],
        "versions": [version_dict(v) for v in f.versions.all()],
        "mentionedIn": [
            {"noteId": m.note_id, "fileId": m.note.file.drive_id, "fileName": m.note.file.name, "version": m.version}
            for m in mentioned_in
        ],
        "content": f.content_text[:20000],
    }


@api("PATCH")
def patch_meta(request, drive_id):
    """Body: any of {companies, source, tags, category, marks, validity, changedBy}. tags is a full replacement."""
    f = _file(request, drive_id)
    data = _body(request)
    services.update_meta(f, data, author_name(request, data))
    return node_dict(_file(request, drive_id))


@api("GET")
def history(request, drive_id):
    f = _file(request, drive_id)
    changes = f.changes.all()
    if request.GET.get("field"):
        changes = changes.filter(field=request.GET["field"])
    return {"nodeId": f.drive_id, "history": [change_dict(c) for c in changes]}


@api("GET")
def meta_at(request, drive_id):
    f = _file(request, drive_id)
    timestamp = parse_datetime(request.GET.get("timestamp", "") or "")
    if timestamp is None:
        raise ValidationError("timestamp must be an ISO date-time, e.g. 2026-09-30T12:00:00Z")
    return {"nodeId": f.drive_id, "timestamp": timestamp.isoformat(), "meta": services.meta_at(f, timestamp)}


@api("GET")
def versions(request, drive_id):
    f = _file(request, drive_id)
    return {"nodeId": f.drive_id, "current": services.current_version(f),
            "versions": [version_dict(v) for v in f.versions.all()]}


@api("GET", "POST")
def notes(request, drive_id):
    """GET: threaded notes. POST: {text, parentId?, validity?, author?} (@file.pdf or @[File name] links a file)."""
    f = _file(request, drive_id)
    if request.method == "POST":
        data = _body(request)
        parent_id = _int(data.get("parentId"), "parentId")
        parent = get_object_or_404(Note, pk=parent_id) if parent_id else None
        services.add_note(f, _str(data.get("text"), "text"), author_name(request, data), parent,
                          _str(data.get("validity"), "validity"))
    return {"nodeId": f.drive_id, "notes": note_tree(f)}


@api("PATCH")
def note(request, note_id):
    """Body: {validity, changedBy?}."""
    n = get_object_or_404(Note.objects.select_related("file"), pk=note_id)
    _file(request, n.file.drive_id)
    data = _body(request)
    if "validity" not in data:
        raise ValidationError("validity is required")
    services.set_note_validity(n, data["validity"], author_name(request, data))
    return {"nodeId": n.file.drive_id, "notes": note_tree(n.file)}


@api("GET")
def node_search(request):
    """GET /api/search?q=&tag=&category=&type=&validity=&company= (name/metadata filters, ANDed)."""
    viewer = viewer_for(request)
    q = request.GET.get("q", "").strip().lower()
    tag, category = request.GET.get("tag", "").strip(), request.GET.get("category", "").strip()
    kind, validity = request.GET.get("type", "").strip(), request.GET.get("validity", "").strip()
    company = request.GET.get("company", "").strip().lower()
    results = []
    for f in annotated_files():
        meta = services.meta_state(file_meta(f))
        if q and q not in f.name.lower():
            continue
        if tag and tag not in meta["tags"]:
            continue
        if category and meta["category"] != category:
            continue
        if kind and ("folder" if f.is_folder else "file") != kind:
            continue
        if validity and meta["validity"] != validity:
            continue
        if company and company not in [c.lower() for c in meta["companies"]] and not (
            f.customer and f.customer.name.lower() == company
        ):
            continue
        if can_see(f, viewer):
            results.append(f)
    results.sort(key=lambda f: (not f.is_folder, f.name.lower()))
    return {"count": len(results), "nodes": [node_dict(f) for f in results]}


@csrf_exempt
def search(request):
    """GET = metadata search (storage), POST = knowledge search with trust (knowledge app)."""
    if request.method == "GET":
        return node_search(request)
    return knowledge_views.search(request)


@api("POST")
def ingest(request):
    """Body: {nodes: [{id, name, type, mime_type, parent_id, size, modified_time}], edges?: [{parent_id, child_id}]}.
    Upserts Drive fields only; our metadata is never touched."""
    data = _body(request)
    nodes = data.get("nodes")
    if not isinstance(nodes, list):
        raise ValidationError("payload must be an object with a 'nodes' list")
    edges = data.get("edges")
    parents = defaultdict(list)
    if isinstance(edges, list):
        for e in edges:
            if isinstance(e, dict) and e.get("parent_id") and e.get("child_id"):
                parents[str(e["child_id"])].append(str(e["parent_id"]))
    items = []
    for n in nodes:
        if not isinstance(n, dict) or not n.get("id"):
            continue
        node_id = str(n["id"])
        is_folder = n.get("type") == "folder" or n.get("mime_type") == FOLDER_MIME
        items.append({
            "id": node_id,
            "name": str(n.get("name") or ""),
            "mimeType": FOLDER_MIME if is_folder else str(n.get("mime_type") or "application/octet-stream"),
            "parents": parents.get(node_id) or ([str(n["parent_id"])] if n.get("parent_id") else []),
            "size": n.get("size"),
            "modifiedTime": n.get("modified_time"),
        })
    stats = ingest_items(items)
    return {**stats, "source": _str(data.get("source"), "source") or "api"}


@api("POST")
def sync(request):
    """Pull Google Drive now. Needs a saved login: run `manage.py sync_drive` once in a terminal first."""
    if not os.path.exists(settings.GOOGLE_TOKEN_FILE):
        raise ValidationError(
            "Not logged in to Google Drive yet. Run `uv run python manage.py sync_drive` once in a terminal "
            "(it opens a browser to log in); after that this button works."
        )
    client = DriveClient(settings.GOOGLE_CREDENTIALS_FILE, settings.GOOGLE_TOKEN_FILE, interactive=False)
    try:
        return sync_drive(client)
    except (FileNotFoundError, ValueError, RuntimeError) as e:
        raise ValidationError(str(e))


@api("GET")
def users(request):
    return [user_dict(u) for u in UserAccess.objects.prefetch_related("companies")]


@api("GET")
def suggestions(request):
    viewer = viewer_for(request)
    qs = Suggestion.objects.select_related("file")
    status = request.GET.get("status", Suggestion.Status.PENDING)
    if status != "all":
        qs = qs.filter(status=status)
    return [suggestion_dict(s) for s in qs if can_see(s.file, viewer)]


@api("POST")
def analyze(request):
    """Body: {source: email|message|call, sender?, text} -> new suggestions for the files it mentions."""
    data = _body(request)
    created = services.analyze_message(_str(data.get("source"), "source"), _str(data.get("sender"), "sender"),
                                       _str(data.get("text"), "text"))
    return {"created": [suggestion_dict(s) for s in created]}


def _decide(request, suggestion_id, accept):
    s = get_object_or_404(Suggestion.objects.select_related("file"), pk=suggestion_id)
    _file(request, s.file.drive_id)
    data = _body(request)
    return suggestion_dict(services.decide_suggestion(s, accept, author_name(request, data)))


@api("POST")
def accept_suggestion(request, suggestion_id):
    return _decide(request, suggestion_id, True)


@api("POST")
def dismiss_suggestion(request, suggestion_id):
    return _decide(request, suggestion_id, False)


@api("GET")
def recent_changes(request):
    """Activity feed across all files the viewer can see (newest first)."""
    viewer = viewer_for(request)
    limit = min(_int(request.GET.get("limit"), "limit") or 30, 200)
    out = []
    for c in ChangeLog.objects.select_related("file")[: limit * 3]:
        if can_see(c.file, viewer):
            out.append({**change_dict(c), "file": {"id": c.file.drive_id, "name": c.file.name}})
        if len(out) >= limit:
            break
    return out
