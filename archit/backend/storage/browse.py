"""Folder browsing by path: "HR Knowledge / Payroll / Belgium" -> the folder, its children, breadcrumbs.

Top-level entries such as a shared drive name or "My Drive" are not Drive files themselves, so they
(and any folder the user can't see) appear as virtual folders.
"""
import re
from collections import defaultdict

from django.db.models import Count, Max

from knowledge.models import DriveFile

from .access import can_see

SEP = " / "


def split_path(path):
    return [s.strip() for s in re.split(r"/", path or "") if s.strip()]


def full_segments(f):
    return [*split_path(f.path), f.name]


def annotated_files():
    return (
        DriveFile.objects.filter(trashed=False)
        .select_related("customer", "owner", "meta")
        .prefetch_related("meta__companies")
        .annotate(notes_count=Count("notes", distinct=True), version=Max("versions__number"))
    )


def browse(path, viewer):
    """Returns (segments, folder_file_or_None, children, child_counts) or None when nothing is at the path."""
    segs = tuple(split_path(path))
    files = [f for f in annotated_files() if can_see(f, viewer)]

    tree = defaultdict(dict)  # parent segments -> {name: file-or-None (None = virtual folder)}
    for f in files:
        fsegs = tuple(split_path(f.path))
        for i in range(len(fsegs)):
            tree[fsegs[:i]].setdefault(fsegs[i], None)
        current = tree[fsegs].get(f.name)
        if current is None or (f.is_folder and not current.is_folder):
            tree[fsegs][f.name] = f

    folder = None
    if segs:
        parent_entries = tree.get(segs[:-1], {})
        if segs[-1] not in parent_entries:
            return None
        folder = parent_entries[segs[-1]]
        if folder is not None and not folder.is_folder:
            return segs, folder, [], {}

    children = []
    for name, f in tree.get(segs, {}).items():
        children.append({"name": name, "file": f, "path": SEP.join([*segs, name])})
    children.sort(key=lambda c: (not (c["file"] is None or c["file"].is_folder), c["name"].lower()))
    counts = {c["path"]: len(tree.get((*segs, c["name"]), {})) for c in children}
    return segs, folder, children, counts
