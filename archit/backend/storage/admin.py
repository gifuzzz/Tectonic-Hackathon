from django.contrib import admin

from .models import ChangeLog, FileMeta, FileVersion, Note, Suggestion, UserAccess


@admin.register(FileMeta)
class FileMetaAdmin(admin.ModelAdmin):
    list_display = ["file", "validity", "source", "category", "updated_by", "updated_at"]
    list_filter = ["validity"]
    raw_id_fields = ["file"]
    filter_horizontal = ["companies"]


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ["text", "file", "author", "validity", "created_at"]
    raw_id_fields = ["file", "parent"]


@admin.register(FileVersion)
class FileVersionAdmin(admin.ModelAdmin):
    list_display = ["file", "number", "name", "modified_at"]
    raw_id_fields = ["file"]


@admin.register(ChangeLog)
class ChangeLogAdmin(admin.ModelAdmin):
    list_display = ["file", "action", "field", "changed_by", "changed_at"]
    list_filter = ["action"]
    raw_id_fields = ["file", "note"]


@admin.register(UserAccess)
class UserAccessAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "countries", "see_all"]
    filter_horizontal = ["companies"]


@admin.register(Suggestion)
class SuggestionAdmin(admin.ModelAdmin):
    list_display = ["file", "source", "kind", "status", "created_at"]
    list_filter = ["status", "source", "kind"]
    raw_id_fields = ["file"]
