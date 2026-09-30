"""Metadata edits with history, threaded notes with @mentions, file versions and AI suggestions."""
import re

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from knowledge.enrich import base_name
from knowledge.models import Customer, DriveFile

from .models import ChangeLog, FileMeta, FileVersion, Note, NoteMention, Suggestion, Validity

META_FIELDS = ("companies", "source", "tags", "category", "marks", "validity")
MENTION_RX = re.compile(r"@\[([^\]]+)\]|@([\w][\w.\-]*[\w])")


def get_meta(f):
    meta, _ = FileMeta.objects.get_or_create(file=f)
    return meta


def meta_state(meta):
    """The editable metadata as plain JSON values."""
    if meta is None:
        return {"companies": [], "source": "", "tags": [], "category": "", "marks": {}, "validity": ""}
    return {
        "companies": sorted(c.name for c in meta.companies.all()),
        "source": meta.source,
        "tags": list(meta.tags),
        "category": meta.category,
        "marks": dict(meta.marks),
        "validity": meta.validity,
    }


def _validity(value):
    value = "" if value is None else value
    if value not in Validity.values:
        raise ValidationError(f"validity must be one of {[v for v in Validity.values if v]} or empty")
    return value


def _customer(value):
    if isinstance(value, int) and not isinstance(value, bool):
        customer = Customer.objects.filter(pk=value).first()
        if customer is None:
            raise ValidationError(f"unknown company id: {value}")
        return customer
    if not isinstance(value, str) or not value.strip():
        raise ValidationError("companies must be a list of names or ids")
    name = value.strip()
    for customer in Customer.objects.all():
        if name.lower() in [n.lower() for n in [customer.name, *customer.aliases]]:
            return customer
    return Customer.objects.create(name=name[:200])


def _clean(field, value):
    if field == "companies":
        if not isinstance(value, list):
            raise ValidationError("companies must be a list")
        return list({c.id: c for c in (_customer(v) for v in value)}.values())
    if field == "tags":
        if not isinstance(value, list) or not all(isinstance(t, str) for t in value):
            raise ValidationError("tags must be a list of strings")
        return list(dict.fromkeys(t.strip() for t in value if t.strip()))
    if field in ("source", "category"):
        if value is not None and not isinstance(value, str):
            raise ValidationError(f"{field} must be a string")
        return (value or "").strip()[:200]
    if field == "marks":
        if value is not None and not isinstance(value, dict):
            raise ValidationError("marks must be an object")
        return value or {}
    return _validity(value)


@transaction.atomic
def update_meta(f, changes, changed_by):
    """Apply only the given fields. One ChangeLog row per field that actually changed."""
    meta = get_meta(f)
    before = meta_state(meta)
    now = timezone.now()
    logs = []
    for field in META_FIELDS:
        if field not in changes:
            continue
        value = _clean(field, changes[field])
        if field == "companies":
            new = sorted(c.name for c in value)
            if new != before["companies"]:
                meta.companies.set(value)
                logs.append((field, before["companies"], new))
            continue
        if value != before[field]:
            setattr(meta, field, value)
            logs.append((field, before[field], value))
    if logs:
        meta.updated_at, meta.updated_by = now, changed_by
        meta.save()
        ChangeLog.objects.bulk_create(
            ChangeLog(file=f, action=ChangeLog.Action.META, field=field, old_value=old, new_value=new,
                      changed_by=changed_by, changed_at=now)
            for field, old, new in logs
        )
    return meta


def meta_at(f, timestamp):
    """Metadata as it was at `timestamp`, rebuilt from the change log."""
    state = meta_state(None)
    for log in f.changes.filter(action=ChangeLog.Action.META, changed_at__lte=timestamp).order_by("changed_at", "id"):
        state[log.field] = log.new_value
    return state


def current_version(f):
    return f.versions.aggregate(n=Max("number"))["n"] or 0


def record_version(f, changed_by="drive sync"):
    """Snapshot a new version when the file's name or Drive modified time changed."""
    latest = f.versions.first()
    if latest and latest.modified_at == f.drive_modified_at and latest.name == f.name:
        return latest
    number = (latest.number if latest else 0) + 1
    version = FileVersion.objects.create(
        file=f, number=number, name=f.name, modified_at=f.drive_modified_at, md5=f.md5, size=f.size
    )
    ChangeLog.objects.create(
        file=f, action=ChangeLog.Action.VERSION, field="version",
        old_value=number - 1 if latest else None, new_value=number, changed_by=changed_by,
    )
    return version


def find_mentions(text):
    """Files referenced as @name.pdf or @[Name with spaces]."""
    found = {}
    for m in MENTION_RX.finditer(text):
        name = (m.group(1) or m.group(2)).strip()
        f = DriveFile.objects.filter(name__iexact=name, trashed=False).first()
        if f is None:
            f = next((c for c in DriveFile.objects.filter(trashed=False, name__istartswith=name[:3])
                      if base_name(c.name) == base_name(name)), None)
        if f is not None:
            found[f.id] = f
    return list(found.values())


@transaction.atomic
def add_note(f, text, author, parent=None, validity=""):
    text = (text or "").strip()
    if not text:
        raise ValidationError("text is required")
    if parent is not None and parent.file_id != f.id:
        raise ValidationError("a reply must be on the same file as the note it answers")
    note = Note.objects.create(file=f, parent=parent, author=author, text=text, validity=_validity(validity))
    for target in find_mentions(text):
        NoteMention.objects.create(note=note, file=target, version=current_version(target))
    ChangeLog.objects.create(
        file=f, note=note,
        action=ChangeLog.Action.NOTE_REPLY if parent else ChangeLog.Action.NOTE_ADDED,
        field="notes", new_value={"text": text[:500], "validity": note.validity}, changed_by=author,
    )
    return note


@transaction.atomic
def set_note_validity(note, validity, changed_by):
    validity = _validity(validity)
    if validity != note.validity:
        ChangeLog.objects.create(
            file=note.file, note=note, action=ChangeLog.Action.NOTE_VALIDITY, field="validity",
            old_value=note.validity, new_value=validity, changed_by=changed_by,
        )
        note.validity = validity
        note.save(update_fields=["validity"])
    return note


VALIDITY_HINTS = [
    (Validity.INVALID, r"no longer (valid|in (force|action|use))|obsolete|do not use|don't use|invalid|withdrawn"),
    (Validity.AWAITING_REPLACEMENT, r"(will be|being|to be) replaced|new version (is )?(coming|on its way)|awaiting replacement"),
    (Validity.OLD, r"out of date|outdated|old version|superseded"),
    (Validity.USEFUL, r"still (valid|correct|accurate)|confirmed|very useful|up to date"),
]


def analyze_message(source, sender, text):
    """Rule-based stand-in for the AI reading emails/messages/calls: find mentioned files and propose
    a validity change (when the message says so) or a note."""
    if source not in Suggestion.Source.values:
        raise ValidationError(f"source must be one of {Suggestion.Source.values}")
    text = (text or "").strip()
    if not text:
        raise ValidationError("text is required")
    lower = text.lower()
    candidates = list(DriveFile.objects.filter(trashed=False, is_folder=False))
    # Exact titles (as whole words) first, else fuzzy titles. A title inside a longer matched title
    # ("Draft" inside "... procedure BE DRAFT") is not a separate mention.
    files = [f for f in candidates if re.search(r"(?<!\w)" + re.escape(f.name.lower()) + r"(?!\w)", lower)]
    files = [f for f in files if not any(f.name.lower() in g.name.lower() and f.id != g.id for g in files)]
    if not files:
        text_base = f" {base_name(text)} "
        files = [f for f in candidates if len(base_name(f.name)) > 5 and f" {base_name(f.name)} " in text_base]
    validity = next((v for v, rx in VALIDITY_HINTS if re.search(rx, lower)), "")
    created = []
    for f in files:
        if validity:
            reason = f"The {source} says the document is '{Validity(validity).label.lower()}'."
            created.append(Suggestion.objects.create(
                file=f, source=source, sender=sender[:200], excerpt=text[:2000], kind=Suggestion.Kind.VALIDITY,
                suggested_validity=validity, reason=reason,
            ))
        created.append(Suggestion.objects.create(
            file=f, source=source, sender=sender[:200], excerpt=text[:2000], kind=Suggestion.Kind.NOTE,
            suggested_note=f"From {source} ({sender or 'unknown'}): {text[:400]}",
            reason=f"The {source} mentions this file.",
        ))
    return created


@transaction.atomic
def decide_suggestion(suggestion, accept, decided_by):
    if suggestion.status != Suggestion.Status.PENDING:
        raise ValidationError(f"suggestion was already {suggestion.status}")
    if accept:
        if suggestion.kind == Suggestion.Kind.VALIDITY:
            update_meta(suggestion.file, {"validity": suggestion.suggested_validity}, f"{decided_by} (AI suggestion)")
        else:
            add_note(suggestion.file, suggestion.suggested_note, f"{decided_by} (AI suggestion)")
    suggestion.status = Suggestion.Status.ACCEPTED if accept else Suggestion.Status.DISMISSED
    suggestion.decided_by, suggestion.decided_at = decided_by, timezone.now()
    suggestion.save()
    return suggestion
