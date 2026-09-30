from django.urls import re_path

from . import views

# Each route works with or without a trailing slash.
urlpatterns = [
    re_path(r"^$", views.index),
    re_path(r"^cases/?$", views.cases),
    re_path(r"^cases/(?P<case_id>\d+)/?$", views.case),
    re_path(r"^cases/(?P<case_id>\d+)/evidence/?$", views.case_evidence),
    re_path(r"^files/(?P<file_id>\d+)/?$", views.file),
    re_path(r"^search/?$", views.search),
    re_path(r"^compare/?$", views.compare),
    re_path(r"^request-review/?$", views.request_review),
    re_path(r"^resolve/?$", views.resolve),
    re_path(r"^experts/?$", views.experts),
    re_path(r"^conflicts/?$", views.conflicts),
    re_path(r"^customers/?$", views.customers),
]
