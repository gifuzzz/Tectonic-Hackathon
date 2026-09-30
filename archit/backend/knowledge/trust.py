"""Trust engine: evaluates a source against a context with explicit rules and returns a structured result."""
from dataclasses import dataclass
from datetime import date

from django.db.models import Q

from .models import Conflict, Customer, DriveFile

STALE_AFTER_DAYS = 730  # files without an effective date count as stale when not modified for 2 years

CONTEXT_WEIGHT = {"strong": 1.0, "partial": 0.7, "unknown": 0.7, "weak": 0.5, "mismatch": 0.1}
AUTHORITY_WEIGHT = {"official": 1.0, "in_review": 0.6, "unverified": 0.5, "draft": 0.3, "archived": 0.1}
RECENCY_WEIGHT = {"current": 1.0, "upcoming": 0.6, "unknown": 0.6, "stale": 0.4, "expired": 0.1}
AUTHORITY = {
    DriveFile.Status.APPROVED: "official",
    DriveFile.Status.IN_REVIEW: "in_review",
    DriveFile.Status.DRAFT: "draft",
    DriveFile.Status.ARCHIVED: "archived",
    DriveFile.Status.UNKNOWN: "unverified",
}


@dataclass
class Context:
    country: str = ""
    customer: Customer | None = None
    topic: str = ""


def _scope_check(requested, actual, label):
    """match / generic (file not specific to any) / mismatch / None (nothing requested)."""
    if not requested:
        return None, None, f"no {label} requested"
    if actual == requested:
        return "match", True, f"file applies to the requested {label}"
    if not actual:
        return "generic", True, f"file is not specific to a {label}"
    return "mismatch", False, f"file applies to a different {label}"


def evaluate(f, ctx=None, today=None):
    ctx = ctx or Context()
    today = today or date.today()
    checks = []

    country, passed, detail = _scope_check(ctx.country, f.country, "country")
    checks.append({"rule": "correct_country", "passed": passed, "detail": f"{detail} ({f.country or 'none'})"})
    customer, passed, detail = _scope_check(
        ctx.customer.id if ctx.customer else None, f.customer_id, "customer"
    )
    checks.append({"rule": "correct_customer", "passed": passed,
                   "detail": f"{detail} ({f.customer.name if f.customer else 'none'})"})
    scopes = [s for s in (country, customer) if s]
    if not scopes:
        context_match = "unknown"
    elif "mismatch" in scopes:
        context_match = "mismatch"
    elif all(s == "match" for s in scopes):
        context_match = "strong"
    elif "match" in scopes:
        context_match = "partial"
    else:
        context_match = "weak"

    if f.expiry_date and f.expiry_date < today:
        recency, detail = "expired", f"expired on {f.expiry_date}"
    elif f.effective_date and f.effective_date > today:
        recency, detail = "upcoming", f"takes effect on {f.effective_date}"
    elif f.effective_date:
        recency, detail = "current", f"in effect since {f.effective_date}"
    elif f.drive_modified_at:
        age = (today - f.drive_modified_at.date()).days
        recency = "current" if age <= STALE_AFTER_DAYS else "stale"
        detail = f"no effective date; last modified {age} days ago"
    else:
        recency, detail = "unknown", "no effective or modified date"
    checks.append({"rule": "current", "passed": recency == "current", "detail": detail})

    owner_verified = bool(f.owner_id and f.owner.active)
    checks.append({"rule": "owner_exists", "passed": owner_verified,
                   "detail": f"owner {f.owner_email or 'unknown'} "
                             f"{'is an active expert' if owner_verified else 'is not in the expert directory'}"})

    authority = AUTHORITY.get(f.status, "unverified")
    checks.append({"rule": "approved", "passed": f.status == DriveFile.Status.APPROVED, "detail": f"status: {f.status}"})

    successor = f.superseded_by.filter(trashed=False).order_by("-effective_date").first()
    checks.append({"rule": "superseded", "passed": successor is None,
                   "detail": f"superseded by '{successor.name}'" if successor else "not superseded"})

    conflicts = Conflict.objects.filter(Q(file_a=f) | Q(file_b=f), resolved=False).count()
    checks.append({"rule": "conflicting_source", "passed": conflicts == 0,
                   "detail": f"{conflicts} unresolved conflict(s) with other files"})

    customer_specific = f.customer_id is not None
    checks.append({"rule": "customer_specific", "passed": None,
                   "detail": "customer-specific document" if customer_specific else "generic document"})

    score = (CONTEXT_WEIGHT[context_match] * AUTHORITY_WEIGHT[authority] * RECENCY_WEIGHT[recency]
             * (1.0 if owner_verified else 0.8) * (0.2 if successor else 1.0) * (0.8 if conflicts else 1.0))
    if successor or context_match == "mismatch" or recency == "expired" or authority == "archived":
        verdict = "do_not_use"
    elif score >= 0.6 and conflicts == 0:
        verdict = "trusted"
    else:
        verdict = "use_with_caution"

    return {
        "contextMatch": context_match,
        "authority": authority,
        "recency": recency,
        "ownerVerified": owner_verified,
        "superseded": successor is not None,
        "supersededBy": successor.id if successor else None,
        "conflicts": conflicts,
        "customerSpecific": customer_specific,
        "score": round(score, 2),
        "verdict": verdict,
        "checks": checks,
    }
