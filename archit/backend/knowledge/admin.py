from django.contrib import admin

from .models import Case, CaseEvidence, Conflict, Customer, DriveFile, Expert


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "aliases"]
    search_fields = ["name"]


@admin.register(Expert)
class ExpertAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "expertise_tags", "active"]
    search_fields = ["name", "email"]
    filter_horizontal = ["customers"]


@admin.register(DriveFile)
class DriveFileAdmin(admin.ModelAdmin):
    list_display = ["name", "country", "customer", "topic", "document_type", "status", "effective_date", "trashed"]
    list_filter = ["country", "topic", "document_type", "status", "trashed", "is_folder"]
    search_fields = ["name", "path", "drive_id"]
    raw_id_fields = ["supersedes"]


class CaseEvidenceInline(admin.TabularInline):
    model = CaseEvidence
    raw_id_fields = ["file"]
    extra = 0


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ["title", "customer", "country", "topic", "status", "review_status", "assigned_expert"]
    list_filter = ["status", "review_status", "country"]
    inlines = [CaseEvidenceInline]


@admin.register(Conflict)
class ConflictAdmin(admin.ModelAdmin):
    list_display = ["subject", "file_a", "file_b", "severity", "resolved"]
    list_filter = ["severity", "resolved"]
    raw_id_fields = ["file_a", "file_b"]
