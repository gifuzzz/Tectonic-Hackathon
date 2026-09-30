"""Case service: evidence, unresolved conflicts, review requests and resolutions."""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .experts import find_experts
from .models import Case, CaseEvidence, Conflict, DriveFile
from .trust import Context


def context_for(case):
    return Context(country=case.country, customer=case.customer, topic=case.topic)


def evidence_links(case):
    return case.evidence_links.select_related("file__customer", "file__owner")


def unresolved_conflicts(case):
    ids = list(case.evidence_links.values_list("file_id", flat=True))
    return Conflict.objects.filter(resolved=False, file_a_id__in=ids, file_b_id__in=ids).select_related(
        "file_a", "file_b"
    )


@transaction.atomic
def request_review(case=None, title="", question="", customer=None, country="", topic="", file_ids=(), expert=None):
    """Create the case if needed, attach evidence, assign the best expert and mark it for review."""
    files = list(DriveFile.objects.filter(id__in=file_ids))
    missing = set(file_ids) - {f.id for f in files}
    if missing:
        raise ValidationError(f"unknown file id(s): {sorted(missing)}")
    if case is None:
        if not title.strip():
            raise ValidationError("title is required when caseId is not given")
        case = Case.objects.create(title=title.strip(), question=question, customer=customer, country=country, topic=topic)
    for f in files:
        CaseEvidence.objects.get_or_create(case=case, file=f)

    if expert is None and case.assigned_expert is None:
        evidence = [link.file for link in evidence_links(case)]
        matches = find_experts(customer=case.customer, country=case.country, topic=case.topic, files=evidence, limit=1)
        expert = matches[0]["expert"] if matches and matches[0]["score"] > 0 else None
    if expert is not None:
        case.assigned_expert = expert
    case.status = Case.Status.IN_REVIEW
    case.review_status = Case.ReviewStatus.REQUESTED
    case.save()
    return case


@transaction.atomic
def resolve(case, resolution, conflict_ids=None):
    """Close the case and mark its conflicts (all, or only conflict_ids) as resolved."""
    if not resolution.strip():
        raise ValidationError("resolution is required")
    conflicts = unresolved_conflicts(case)
    if conflict_ids is not None:
        conflicts = conflicts.filter(id__in=conflict_ids)
    conflicts.update(resolved=True, resolution_note=resolution.strip())
    case.resolution = resolution.strip()
    case.status = Case.Status.RESOLVED
    case.review_status = Case.ReviewStatus.COMPLETED
    case.resolved_at = timezone.now()
    case.save()
    return case
