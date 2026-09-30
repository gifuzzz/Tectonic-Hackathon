from django.urls import re_path

from . import views

# Mounted under /api/. Each route works with or without a trailing slash.
urlpatterns = [
    re_path(r"^health/?$", views.health),
    re_path(r"^browse/?$", views.browse),
    re_path(r"^graph/?$", views.graph),
    re_path(r"^nodes/(?P<drive_id>[\w-]+)/?$", views.node),
    re_path(r"^nodes/(?P<drive_id>[\w-]+)/meta/?$", views.patch_meta),
    re_path(r"^nodes/(?P<drive_id>[\w-]+)/history/?$", views.history),
    re_path(r"^nodes/(?P<drive_id>[\w-]+)/meta-at/?$", views.meta_at),
    re_path(r"^nodes/(?P<drive_id>[\w-]+)/versions/?$", views.versions),
    re_path(r"^nodes/(?P<drive_id>[\w-]+)/notes/?$", views.notes),
    re_path(r"^notes/(?P<note_id>\d+)/?$", views.note),
    re_path(r"^search/?$", views.search),
    re_path(r"^ingest/?$", views.ingest),
    re_path(r"^sync/?$", views.sync),
    re_path(r"^users/?$", views.users),
    re_path(r"^activity/?$", views.recent_changes),
    re_path(r"^suggestions/?$", views.suggestions),
    re_path(r"^suggestions/analyze/?$", views.analyze),
    re_path(r"^suggestions/(?P<suggestion_id>\d+)/accept/?$", views.accept_suggestion),
    re_path(r"^suggestions/(?P<suggestion_id>\d+)/dismiss/?$", views.dismiss_suggestion),
]
