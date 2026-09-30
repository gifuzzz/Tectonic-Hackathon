"""App-owned data on top of Drive files and folders (ported from shlok/, extended with ivan/features.md).

Drive sync owns knowledge.DriveFile; everything here is written by people (or accepted AI suggestions)
and is never touched by a re-sync.
"""
from django.db import models
from django.utils import timezone

from knowledge.models import Customer, DriveFile


class Validity(models.TextChoices):
    UNSET = "", "Not set"
    USEFUL = "useful", "Useful"
    OLD = "old", "Old"
    INVALID = "invalid", "Invalid"
    AWAITING_REPLACEMENT = "awaiting_replacement", "Awaiting replacement"


class FileMeta(models.Model):
    file = models.OneToOneField(DriveFile, on_delete=models.CASCADE, related_name="meta")
    companies = models.ManyToManyField(Customer, blank=True, related_name="tagged_files")
    source = models.CharField(max_length=200, blank=True, help_text='Where it came from, e.g. "Italian Gvt.", "HR"')
    tags = models.JSONField(default=list, blank=True, help_text='e.g. ["law", "template for 401K contribution"]')
    category = models.CharField(max_length=200, blank=True)
    marks = models.JSONField(default=dict, blank=True, help_text="Free-form flags")
    validity = models.CharField(max_length=30, choices=Validity.choices, blank=True)
    updated_at = models.DateTimeField(null=True, blank=True)
    updated_by = models.CharField(max_length=200, blank=True)

    def __str__(self):
        return f"meta of {self.file}"


class Note(models.Model):
    file = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="notes")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    author = models.CharField(max_length=200)
    text = models.TextField()
    validity = models.CharField(max_length=30, choices=Validity.choices, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return self.text[:60]


class NoteMention(models.Model):
    """An @mention of a file inside a note, pinned to the file version that existed when it was written."""

    note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="mentions")
    file = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="mentioned_in")
    version = models.PositiveIntegerField(default=0)


class FileVersion(models.Model):
    """Recorded by Drive sync whenever a file changes. The Drive id stays the same; the name may not."""

    file = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    name = models.CharField(max_length=500)
    modified_at = models.DateTimeField(null=True, blank=True)
    md5 = models.CharField(max_length=64, blank=True)
    size = models.BigIntegerField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-number"]
        constraints = [models.UniqueConstraint(fields=["file", "number"], name="unique_file_version")]


class ChangeLog(models.Model):
    """Append-only history of every change: metadata fields, notes, note validity and new versions."""

    class Action(models.TextChoices):
        META = "meta"
        NOTE_ADDED = "note_added"
        NOTE_REPLY = "note_reply"
        NOTE_VALIDITY = "note_validity"
        VERSION = "version"

    file = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="changes")
    note = models.ForeignKey(Note, null=True, blank=True, on_delete=models.SET_NULL, related_name="changes")
    action = models.CharField(max_length=30, choices=Action.choices)
    field = models.CharField(max_length=50, blank=True)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    changed_by = models.CharField(max_length=200, blank=True)
    changed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-changed_at", "-id"]


class UserAccess(models.Model):
    """Visibility: a file tagged with companies or a country is only shown to people assigned to one of them.
    Untagged files are visible to everyone."""

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200)
    companies = models.ManyToManyField(Customer, blank=True, related_name="members")
    countries = models.JSONField(default=list, blank=True, help_text='ISO codes, e.g. ["BE"]')
    see_all = models.BooleanField(default=False, help_text="Admins see every file")

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "user access"

    def __str__(self):
        return self.name


class Suggestion(models.Model):
    """An AI suggestion from an email, message or call: add a note, or change a file's validity."""

    class Source(models.TextChoices):
        EMAIL = "email"
        MESSAGE = "message"
        CALL = "call"

    class Kind(models.TextChoices):
        NOTE = "note"
        VALIDITY = "validity"

    class Status(models.TextChoices):
        PENDING = "pending"
        ACCEPTED = "accepted"
        DISMISSED = "dismissed"

    file = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="suggestions")
    source = models.CharField(max_length=20, choices=Source.choices)
    sender = models.CharField(max_length=200, blank=True)
    excerpt = models.TextField()
    kind = models.CharField(max_length=20, choices=Kind.choices)
    suggested_note = models.TextField(blank=True)
    suggested_validity = models.CharField(max_length=30, choices=Validity.choices, blank=True)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    decided_by = models.CharField(max_length=200, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
