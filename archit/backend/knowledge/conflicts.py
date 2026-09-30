"""Conflict detection: claims come from the LLM (or "Label: value" rules); these rules decide if a conflict matters."""
import re
from collections import defaultdict
from datetime import date
from itertools import combinations

from django.db import transaction

from .models import Conflict, DriveFile

NEGATIONS = {"not", "no", "never", "none", "prohibited", "forbidden", "excluded", "niet", "pas"}


def _normalize(value):
    return " ".join(value.lower().replace(",", ".").split())


def _numbers(value):
    return sorted(float(n) for n in re.findall(r"\d+(?:\.\d+)?", value))


def values_oppose(a, b):
    na, nb = _normalize(a), _normalize(b)
    if na == nb:
        return False
    nums_a, nums_b = _numbers(na), _numbers(nb)
    if nums_a and nums_b:
        return nums_a != nums_b
    neg_a, neg_b = bool(NEGATIONS & set(na.split())), bool(NEGATIONS & set(nb.split()))
    if neg_a != neg_b:
        return True
    return na != nb


def _validity(f):
    return (f.effective_date or date.min, f.expiry_date or date.max)


def validity_overlaps(a, b):
    start_a, end_a = _validity(a)
    start_b, end_b = _validity(b)
    return start_a <= end_b and start_b <= end_a


def opposing_claims(a, b):
    claims_b = {c["subject"]: c for c in b.claims}
    out = []
    for ca in a.claims:
        cb = claims_b.get(ca["subject"])
        if cb and values_oppose(ca["value"], cb["value"]):
            out.append({
                "subject": ca["subject"],
                "valueA": ca["value"],
                "valueB": cb["value"],
                "textA": ca.get("text", ""),
                "textB": cb.get("text", ""),
            })
    return out


def compare(a, b, superseded_ids=None):
    """Compare two files and explain whether they conflict in a way that matters."""
    if superseded_ids is None:
        superseded_ids = set(
            DriveFile.objects.filter(supersedes_id__in=[a.id, b.id], trashed=False).values_list("supersedes_id", flat=True)
        )
    checks = {
        "sameTopic": bool(a.topic) and a.topic == b.topic,
        "sameCustomer": a.customer_id == b.customer_id,
        "sameCountry": a.country == b.country,
        "overlappingValidity": validity_overlaps(a, b),
        "supersession": a.supersedes_id == b.id or b.supersedes_id == a.id,
        "eitherSuperseded": a.id in superseded_ids or b.id in superseded_ids,
    }
    claims = opposing_claims(a, b)

    reasons = []
    if not checks["sameTopic"]:
        reasons.append("different or unknown topic")
    if not checks["sameCustomer"]:
        reasons.append("different customer scope: customer-specific rules override generic ones")
    if not checks["sameCountry"]:
        reasons.append("different country scope")
    if not checks["overlappingValidity"]:
        reasons.append("validity periods do not overlap")
    if checks["supersession"] or checks["eitherSuperseded"]:
        reasons.append("superseded documents no longer apply")
    if not claims:
        reasons.append("no opposing claims")

    is_conflict = not reasons
    if is_conflict:
        reasons = [
            f"same topic ({a.topic}), customer and country scope",
            "validity periods overlap",
            f"{len(claims)} opposing claim(s)",
        ]
    approved = [a.status, b.status].count(DriveFile.Status.APPROVED)
    severity = {2: Conflict.Severity.HIGH, 1: Conflict.Severity.MEDIUM}.get(approved, Conflict.Severity.LOW)
    return {
        "fileA": a.id,
        "fileB": b.id,
        "checks": checks,
        "opposingClaims": claims,
        "isConflict": is_conflict,
        "severity": severity if is_conflict else None,
        "reasons": reasons,
    }


@transaction.atomic
def detect_conflicts():
    """Recompute stored conflicts between related files. Keeps resolved ones. Returns the unresolved count."""
    files = [f for f in DriveFile.objects.filter(trashed=False, is_folder=False).exclude(topic="") if f.claims]
    superseded_ids = set(
        DriveFile.objects.filter(trashed=False, supersedes__isnull=False).values_list("supersedes_id", flat=True)
    )
    groups = defaultdict(list)
    for f in files:
        groups[(f.topic, f.customer_id, f.country)].append(f)

    found = {}
    for group in groups.values():
        for a, b in combinations(sorted(group, key=lambda f: f.id), 2):
            result = compare(a, b, superseded_ids)
            if result["isConflict"]:
                for claim in result["opposingClaims"]:
                    found[(a.id, b.id, claim["subject"])] = (claim, result)

    existing = {(c.file_a_id, c.file_b_id, c.subject): c for c in Conflict.objects.all()}
    for key, conflict in existing.items():
        if key not in found and not conflict.resolved:
            conflict.delete()
    for (a_id, b_id, subject), (claim, result) in found.items():
        conflict = existing.get((a_id, b_id, subject)) or Conflict(file_a_id=a_id, file_b_id=b_id, subject=subject)
        if conflict.resolved:
            continue
        conflict.claim_a = claim["valueA"]
        conflict.claim_b = claim["valueB"]
        conflict.severity = result["severity"]
        conflict.reasons = result["reasons"]
        conflict.save()
    return Conflict.objects.filter(resolved=False).count()
