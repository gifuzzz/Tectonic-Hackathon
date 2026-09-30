"""Model -> JSON dicts (camelCase for the frontend)."""
from .enrich import COUNTRY_NAMES

CONTENT_PREVIEW_CHARS = 20_000


def _iso(value):
    return value.isoformat() if value else None


def customer_dict(c):
    return {"id": c.id, "name": c.name} if c else None


def expert_dict(e):
    if e is None:
        return None
    return {
        "id": e.id,
        "name": e.name,
        "email": e.email,
        "expertiseTags": e.expertise_tags,
        "customers": [c.name for c in e.customers.all()],
        "active": e.active,
    }


def file_brief(f):
    return {"id": f.id, "name": f.name} if f else None


def file_summary(f):
    return {
        "id": f.id,
        "driveId": f.drive_id,
        "name": f.name,
        "mimeType": f.mime_type,
        "path": f.path,
        "sharedDrive": {"id": f.shared_drive_id, "name": f.shared_drive_name} if f.shared_drive_id else None,
        "webViewLink": f.web_view_link,
        "owners": f.owners,
        "ownerEmail": f.owner_email,
        "owner": {"id": f.owner.id, "name": f.owner.name, "email": f.owner.email} if f.owner else None,
        "modifiedAt": _iso(f.drive_modified_at),
        "size": f.size,
        "country": f.country,
        "countryName": COUNTRY_NAMES.get(f.country, ""),
        "customer": customer_dict(f.customer),
        "topic": f.topic,
        "documentType": f.document_type,
        "status": f.status,
        "effectiveDate": _iso(f.effective_date),
        "expiryDate": _iso(f.expiry_date),
        "summary": f.summary,
    }


def file_detail(f):
    return {
        **file_summary(f),
        "permissions": f.permissions,
        "claims": f.claims,
        "content": f.content_text[:CONTENT_PREVIEW_CHARS],
        "contentTruncated": len(f.content_text) > CONTENT_PREVIEW_CHARS,
        "supersedes": file_brief(f.supersedes),
        "supersededBy": [file_brief(s) for s in f.superseded_by.filter(trashed=False)],
        "trashed": f.trashed,
        "enrichedAt": _iso(f.enriched_at),
        "enrichmentSource": f.enrichment_source,
    }


def conflict_dict(c):
    return {
        "id": c.id,
        "fileA": file_brief(c.file_a),
        "fileB": file_brief(c.file_b),
        "subject": c.subject,
        "claimA": c.claim_a,
        "claimB": c.claim_b,
        "severity": c.severity,
        "reasons": c.reasons,
        "resolved": c.resolved,
        "resolutionNote": c.resolution_note,
        "detectedAt": _iso(c.detected_at),
    }


def context_dict(ctx):
    return {"country": ctx.country, "customer": customer_dict(ctx.customer), "topic": ctx.topic}


def case_summary(c):
    return {
        "id": c.id,
        "title": c.title,
        "customer": customer_dict(c.customer),
        "country": c.country,
        "topic": c.topic,
        "status": c.status,
        "reviewStatus": c.review_status,
        "assignedExpert": expert_dict(c.assigned_expert),
        "evidenceCount": c.evidence_links.count(),
        "createdAt": _iso(c.created_at),
        "updatedAt": _iso(c.updated_at),
    }


def case_detail(c, unresolved):
    return {
        **case_summary(c),
        "question": c.question,
        "evidenceFileIds": list(c.evidence_links.values_list("file_id", flat=True)),
        "unresolvedConflicts": [conflict_dict(x) for x in unresolved],
        "resolution": c.resolution,
        "resolvedAt": _iso(c.resolved_at),
    }
