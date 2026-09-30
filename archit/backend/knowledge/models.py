from django.db import models


class Customer(models.Model):
    name = models.CharField(max_length=200, unique=True)
    aliases = models.JSONField(default=list, blank=True, help_text='Other names to detect in documents, e.g. ["Acme"]')

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Expert(models.Model):
    """People directory. A document owner is 'verified' when they exist here and are active."""

    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    expertise_tags = models.JSONField(default=list, blank=True, help_text='e.g. ["payroll", "BE"]')
    customers = models.ManyToManyField(Customer, blank=True, related_name="experts", help_text="Customer history")
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class DriveFile(models.Model):
    class DocumentType(models.TextChoices):
        POLICY = "policy"
        PROCEDURE = "procedure"
        CONTRACT = "contract"
        GUIDELINE = "guideline"
        FAQ = "faq"
        TEMPLATE = "template"
        MEMO = "memo"
        REPORT = "report"
        OTHER = "other"

    class Status(models.TextChoices):
        APPROVED = "approved"
        IN_REVIEW = "in_review"
        DRAFT = "draft"
        ARCHIVED = "archived"
        UNKNOWN = "unknown"

    # Google Drive metadata
    drive_id = models.CharField(max_length=200, unique=True)
    name = models.CharField(max_length=500)
    mime_type = models.CharField(max_length=200)
    is_folder = models.BooleanField(default=False)
    parent_ids = models.JSONField(default=list, blank=True)
    path = models.CharField(max_length=2000, blank=True, help_text='e.g. "HR Shared Drive / Payroll / Belgium"')
    shared_drive_id = models.CharField(max_length=200, blank=True)
    shared_drive_name = models.CharField(max_length=500, blank=True)
    owners = models.JSONField(default=list, blank=True, help_text='[{"name", "email", "role"}]')
    permissions = models.JSONField(default=list, blank=True, help_text='[{"type", "role", "email", "domain", "name"}]')
    web_view_link = models.URLField(max_length=1000, blank=True)
    size = models.BigIntegerField(null=True, blank=True)
    drive_modified_at = models.DateTimeField(null=True, blank=True)
    md5 = models.CharField(max_length=64, blank=True)
    trashed = models.BooleanField(default=False)
    synced_at = models.DateTimeField(auto_now=True)

    # Content
    content_text = models.TextField(blank=True)
    content_hash = models.CharField(max_length=64, blank=True)

    # Enrichment (detected by rules, or by the LLM when OPENAI_API_KEY is set)
    country = models.CharField(max_length=2, blank=True, help_text="ISO code; blank = not country-specific")
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="files")
    topic = models.CharField(max_length=100, blank=True)
    owner = models.ForeignKey(Expert, null=True, blank=True, on_delete=models.SET_NULL, related_name="owned_files")
    owner_email = models.EmailField(blank=True)
    effective_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    document_type = models.CharField(max_length=20, choices=DocumentType.choices, default=DocumentType.OTHER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNKNOWN)
    summary = models.TextField(blank=True)
    claims = models.JSONField(default=list, blank=True, help_text='[{"subject", "value", "text"}]')
    supersedes_hint = models.CharField(max_length=500, blank=True, help_text="Title the document says it replaces")
    supersedes = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="superseded_by"
    )
    enriched_at = models.DateTimeField(null=True, blank=True)
    enrichment_source = models.CharField(max_length=20, blank=True, help_text='"rules" or "llm"')

    class Meta:
        ordering = ["-drive_modified_at"]

    def __str__(self):
        return self.name


class DocumentChunk(models.Model):
    """A piece of a file's text, with its embedding (a list of floats) when OpenAI is configured."""

    file = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="chunks")
    index = models.PositiveIntegerField()
    text = models.TextField()
    embedding = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["file", "index"]
        constraints = [models.UniqueConstraint(fields=["file", "index"], name="unique_chunk")]


class Case(models.Model):
    class Status(models.TextChoices):
        OPEN = "open"
        IN_REVIEW = "in_review"
        RESOLVED = "resolved"

    class ReviewStatus(models.TextChoices):
        NOT_REQUESTED = "not_requested"
        REQUESTED = "requested"
        COMPLETED = "completed"

    title = models.CharField(max_length=300)
    question = models.TextField(blank=True)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="cases")
    country = models.CharField(max_length=2, blank=True)
    topic = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    review_status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.NOT_REQUESTED)
    assigned_expert = models.ForeignKey(Expert, null=True, blank=True, on_delete=models.SET_NULL, related_name="cases")
    evidence = models.ManyToManyField(DriveFile, through="CaseEvidence", related_name="cases")
    resolution = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class CaseEvidence(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="evidence_links")
    file = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="case_links")
    selected = models.BooleanField(default=True)
    note = models.TextField(blank=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["added_at", "id"]
        constraints = [models.UniqueConstraint(fields=["case", "file"], name="unique_case_evidence")]


class Conflict(models.Model):
    """Two related files making opposing claims about the same subject. file_a.id < file_b.id."""

    class Severity(models.TextChoices):
        HIGH = "high"
        MEDIUM = "medium"
        LOW = "low"

    file_a = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="conflicts_as_a")
    file_b = models.ForeignKey(DriveFile, on_delete=models.CASCADE, related_name="conflicts_as_b")
    subject = models.CharField(max_length=200)
    claim_a = models.TextField()
    claim_b = models.TextField()
    severity = models.CharField(max_length=10, choices=Severity.choices, default=Severity.LOW)
    reasons = models.JSONField(default=list, blank=True)
    resolved = models.BooleanField(default=False)
    resolution_note = models.TextField(blank=True)
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-detected_at", "id"]
        constraints = [models.UniqueConstraint(fields=["file_a", "file_b", "subject"], name="unique_conflict")]

    def __str__(self):
        return f"{self.subject}: {self.file_a} vs {self.file_b}"
