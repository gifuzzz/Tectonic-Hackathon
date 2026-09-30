"""JSON API. Views return plain data; the @api decorator turns it into JSON and errors into 400/404."""
import json
from functools import wraps
from itertools import combinations

from django.core.exceptions import ValidationError
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt

from . import cases as case_service
from .conflicts import compare as compare_files
from .enrich import COUNTRY_NAMES, COUNTRY_TERMS
from .experts import find_experts
from .models import Case, Conflict, Customer, DriveFile, Expert
from .search import build_context, search as run_search
from .serializers import (
    case_detail, case_summary, conflict_dict, context_dict, customer_dict, expert_dict, file_detail, file_summary,
)
from .trust import Context, evaluate

MAX_COMPARE = 10


def api(*methods):
    def decorator(view):
        @csrf_exempt
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return JsonResponse({"error": f"method {request.method} not allowed"}, status=405)
            try:
                return JsonResponse(view(request, *args, **kwargs), safe=False)
            except Http404 as e:
                return JsonResponse({"error": str(e) or "not found"}, status=404)
            except ValidationError as e:
                return JsonResponse({"error": "; ".join(e.messages)}, status=400)

        return wrapper

    return decorator


def _body(request):
    try:
        data = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise ValidationError("request body must be valid JSON")
    if not isinstance(data, dict):
        raise ValidationError("request body must be a JSON object")
    return data


def _int(value, name, required=False):
    if value in (None, ""):
        if required:
            raise ValidationError(f"{name} is required")
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError(f"{name} must be an integer")


def _int_list(value, name):
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValidationError(f"{name} must be a list of integers")
    return [_int(v, name, required=True) for v in value]


def _customer(value):
    """Accept a customer id or name (or alias)."""
    if value in (None, ""):
        return None
    if isinstance(value, int) or str(value).isdigit():
        customer = Customer.objects.filter(pk=int(value)).first()
    else:
        name = str(value).strip().lower()
        customer = next(
            (c for c in Customer.objects.all() if name in [n.lower() for n in [c.name, *c.aliases]]), None
        )
    if customer is None:
        raise ValidationError(f"unknown customer: {value}")
    return customer


def _country(value):
    """Accept an ISO code ("BE") or a name ("Belgium")."""
    if value in (None, ""):
        return ""
    value = str(value).strip()
    if value.upper() in COUNTRY_NAMES:
        return value.upper()
    if value.upper() == "UK":
        return "GB"
    for code, terms in COUNTRY_TERMS.items():
        if value.lower() in terms or value.lower() == COUNTRY_NAMES[code].lower():
            return code
    raise ValidationError(f"unknown country: {value}")


def _str(value, name):
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValidationError(f"{name} must be a string")
    return value.strip()


@api("GET")
def index(request):
    """List the endpoints, so opening the server in a browser shows something useful."""
    return {
        "service": "SD Worx knowledge backend",
        "knowledge": [
            "GET  /cases", "GET  /cases/:id", "GET  /cases/:id/evidence", "GET  /files/:id",
            "POST /search", "POST /compare", "POST /request-review", "POST /resolve", "GET  /experts",
            "GET  /api/conflicts", "GET  /api/customers",
        ],
        "storage": [
            "GET  /api/browse?path=", "GET  /api/graph", "GET  /api/nodes/:driveId", "PATCH /api/nodes/:driveId/meta",
            "GET  /api/nodes/:driveId/history", "GET  /api/nodes/:driveId/meta-at?timestamp=",
            "GET  /api/nodes/:driveId/versions", "GET|POST /api/nodes/:driveId/notes", "PATCH /api/notes/:id",
            "GET  /api/search?q=&tag=&category=&type=&validity=&company=", "POST /api/ingest", "POST /api/sync",
            "GET  /api/users", "GET  /api/activity", "GET  /api/suggestions", "POST /api/suggestions/analyze",
            "POST /api/suggestions/:id/accept", "POST /api/suggestions/:id/dismiss", "GET  /api/health",
        ],
        "note": "Knowledge endpoints also work under /api/. All routes accept a trailing slash. "
                "Send X-User-Email to apply company/country visibility. Admin UI: /admin/",
    }


@api("GET")
def cases(request):
    qs = Case.objects.select_related("customer", "assigned_expert").prefetch_related("assigned_expert__customers")
    if request.GET.get("status"):
        qs = qs.filter(status=request.GET["status"])
    return [case_summary(c) for c in qs]


@api("GET")
def case(request, case_id):
    c = get_object_or_404(Case.objects.select_related("customer", "assigned_expert"), pk=case_id)
    return case_detail(c, case_service.unresolved_conflicts(c))


@api("GET")
def case_evidence(request, case_id):
    c = get_object_or_404(Case.objects.select_related("customer"), pk=case_id)
    ctx = case_service.context_for(c)
    return {
        "caseId": c.id,
        "context": context_dict(ctx),
        "evidence": [
            {**file_summary(link.file), "selected": link.selected, "note": link.note, "trust": evaluate(link.file, ctx)}
            for link in case_service.evidence_links(c)
        ],
        "conflicts": [conflict_dict(x) for x in case_service.unresolved_conflicts(c)],
    }


@api("GET")
def file(request, file_id):
    """File metadata, content, relationships, conflicts and trust (optionally for ?country=&customer=)."""
    f = get_object_or_404(DriveFile.objects.select_related("customer", "owner", "supersedes"), pk=file_id)
    ctx = Context(country=_country(request.GET.get("country")), customer=_customer(request.GET.get("customer")))
    conflicts = [*f.conflicts_as_a.select_related("file_a", "file_b"), *f.conflicts_as_b.select_related("file_a", "file_b")]
    return {
        **file_detail(f),
        "trust": evaluate(f, ctx),
        "conflicts": [conflict_dict(x) for x in sorted(conflicts, key=lambda x: x.id)],
        "cases": [{"id": c.id, "title": c.title, "status": c.status} for c in f.cases.all()],
    }


@api("POST")
def search(request):
    data = _body(request)
    query = _str(data.get("query"), "query")
    if not query:
        raise ValidationError("query is required")
    limit = _int(data.get("limit"), "limit") or 10
    if not 1 <= limit <= 50:
        raise ValidationError("limit must be between 1 and 50")
    ctx = build_context(
        query,
        country=_country(data.get("country")),
        customer=_customer(data.get("customer")),
        topic=_str(data.get("topic"), "topic"),
    )
    results, conflicts = run_search(query, ctx, user_email=_str(data.get("userEmail"), "userEmail"), limit=limit)
    from storage.access import can_see, viewer_for  # storage builds on knowledge; import late to avoid a cycle

    viewer = viewer_for(request)
    results = [r for r in results if can_see(r["file"], viewer)]
    visible = {r["file"].id for r in results}
    conflicts = [c for c in conflicts if c.file_a_id in visible and c.file_b_id in visible]
    return {
        "query": query,
        "context": context_dict(ctx),
        "results": [
            {**file_summary(r["file"]), "relevance": r["relevance"], "rank": r["rank"],
             "snippet": r["snippet"], "trust": r["trust"]}
            for r in results
        ],
        "conflicts": [conflict_dict(c) for c in conflicts],
    }


@api("POST")
def compare(request):
    data = _body(request)
    ids = list(dict.fromkeys(_int_list(data.get("fileIds"), "fileIds")))
    if not 2 <= len(ids) <= MAX_COMPARE:
        raise ValidationError(f"fileIds must contain 2 to {MAX_COMPARE} different file ids")
    files = DriveFile.objects.in_bulk(ids)
    missing = [i for i in ids if i not in files]
    if missing:
        raise Http404(f"unknown file id(s): {missing}")
    comparisons = [compare_files(files[a], files[b]) for a, b in combinations(ids, 2)]
    return {"comparisons": comparisons, "conflictCount": sum(c["isConflict"] for c in comparisons)}


@api("POST")
def request_review(request):
    """Body: {caseId} to review an existing case, or {title, question?, customer?, country?, topic?}
    to create one; plus optional evidenceFileIds and expertId."""
    data = _body(request)
    case_id = _int(data.get("caseId"), "caseId")
    expert_id = _int(data.get("expertId"), "expertId")
    c = get_object_or_404(Case, pk=case_id) if case_id else None
    expert = get_object_or_404(Expert, pk=expert_id, active=True) if expert_id else None
    c = case_service.request_review(
        case=c,
        title=_str(data.get("title"), "title"),
        question=_str(data.get("question"), "question"),
        customer=_customer(data.get("customer")),
        country=_country(data.get("country")),
        topic=_str(data.get("topic"), "topic"),
        file_ids=_int_list(data.get("evidenceFileIds"), "evidenceFileIds"),
        expert=expert,
    )
    return case_detail(c, case_service.unresolved_conflicts(c))


@api("POST")
def resolve(request):
    """Body: {caseId, resolution, conflictIds?} (conflictIds defaults to all unresolved conflicts of the case)."""
    data = _body(request)
    c = get_object_or_404(Case, pk=_int(data.get("caseId"), "caseId", required=True))
    conflict_ids = _int_list(data["conflictIds"], "conflictIds") if data.get("conflictIds") is not None else None
    c = case_service.resolve(c, _str(data.get("resolution"), "resolution"), conflict_ids)
    return case_detail(c, case_service.unresolved_conflicts(c))


@api("GET")
def customers(request):
    return [customer_dict(c) for c in Customer.objects.all()]


@api("GET")
def conflicts(request):
    """All conflicts, newest first. ?resolved=true|false filters."""
    qs = Conflict.objects.select_related("file_a", "file_b")
    if request.GET.get("resolved") in ("true", "false"):
        qs = qs.filter(resolved=request.GET["resolved"] == "true")
    return [conflict_dict(c) for c in qs]


@api("GET")
def experts(request):
    """Optional filters: ?customer=&country=&topic=&fileId= (results are ranked with reasons)."""
    file_id = _int(request.GET.get("fileId"), "fileId")
    files = [get_object_or_404(DriveFile, pk=file_id)] if file_id else []
    matches = find_experts(
        customer=_customer(request.GET.get("customer")),
        country=_country(request.GET.get("country")),
        topic=request.GET.get("topic", "").strip(),
        files=files,
        limit=100,
    )
    return [{**expert_dict(m["expert"]), "score": m["score"], "reasons": m["reasons"]} for m in matches]
