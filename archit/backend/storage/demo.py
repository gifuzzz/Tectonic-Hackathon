"""Demo storage data on top of knowledge's seed_demo files: users, metadata, notes, versions, suggestions."""
from datetime import timedelta

from knowledge.models import Customer, DriveFile

from . import services
from .models import UserAccess

USERS = [
    ("lm@sdworx.example", "L. Martin", [], [], True),
    ("sofie.peeters@sdworx.example", "Sofie Peeters", ["Acme Retail"], ["BE"], False),
    ("marc.dubois@sdworx.example", "Marc Dubois", ["Brightwave Logistics"], ["BE", "FR"], False),
    ("anna.jansen@sdworx.example", "Anna Jansen", [], ["NL"], False),
]


def seed(files, folders):
    """`files` maps seed keys to DriveFiles; `folders` maps full paths to folder DriveFiles."""
    for email, name, companies, countries, see_all in USERS:
        user, _ = UserAccess.objects.update_or_create(
            email=email, defaults={"name": name, "countries": countries, "see_all": see_all}
        )
        user.companies.set(Customer.objects.filter(name__in=companies))

    meta = {
        "payroll-acme-v2": {"companies": ["Acme Retail"], "source": "HR", "tags": ["policy", "payroll"], "validity": "useful"},
        "payroll-acme-v1": {"companies": ["Acme Retail"], "source": "HR", "tags": ["policy", "payroll"], "validity": "old"},
        "payroll-acme-faq": {"companies": ["Acme Retail"], "source": "Company A", "tags": ["summary of BE Payroll Policy"]},
        "termination-be": {"source": "Belgian FPS Employment", "tags": ["law"], "validity": "useful"},
        "termination-brightwave": {"companies": ["Brightwave Logistics"], "source": "Brightwave Logistics", "tags": ["contract"]},
        "leave-nl-2025": {"source": "HR", "tags": ["policy"], "validity": "old"},
        "leave-nl-2026": {"source": "HR", "tags": ["policy"], "validity": "useful"},
        "expenses-acme": {"companies": ["Acme Retail"], "tags": ["template for expense claims"], "validity": "invalid"},
    }
    for key, changes in meta.items():
        services.update_meta(files[key], changes, "Sofie Peeters")
    services.update_meta(folders["HR Knowledge / Payroll"], {"category": "Payroll", "tags": ["country policies"]}, "L. Martin")

    first = services.add_note(
        files["payroll-acme-faq"],
        "The meal voucher value here (6 EUR) contradicts @[BE Payroll Policy - Acme Retail v2] (8 EUR). "
        "Check the policy before answering customers.",
        "Marc Dubois",
        validity="useful",
    )
    services.add_note(files["payroll-acme-faq"], "Confirmed with Acme HR: the policy is right, this FAQ will be updated.",
                      "Sofie Peeters", parent=first)
    old = services.add_note(files["payroll-acme-v1"], "Section on the payroll cutoff is no longer in action.",
                            "Sofie Peeters", validity="invalid")
    services.set_note_validity(old, "useful", "Marc Dubois")
    services.add_note(folders["HR Knowledge / Payroll"], "Country policies live here; customer-specific rules go in "
                      "the customer's subfolder.", "L. Martin")

    # The policy got edited after Marc's note, so his @mention now points to an older version.
    policy = files["payroll-acme-v2"]
    policy.drive_modified_at += timedelta(days=30)
    policy.save(update_fields=["drive_modified_at"])
    services.record_version(policy)

    services.analyze_message(
        "email", "payroll-be@acme-retail.example",
        "Hi, the Acme Retail - Belgium payroll FAQ is outdated: meal vouchers went up to 8 EUR in January.",
    )
    services.analyze_message(
        "call", "Brightwave HR (phone call summary)",
        "The Brightwave Logistics - Termination procedure BE DRAFT will be replaced by the final version next week.",
    )


def demo_folders(paths, prefix):
    """Create folder rows for every path level below the top one (a shared drive, which isn't a folder)."""
    folders = {}
    for path in sorted({p for p in paths}, key=len):
        segments = path.split(" / ")
        for depth in range(2, len(segments) + 1):
            full = " / ".join(segments[:depth])
            if full in folders:
                continue
            parent = folders.get(" / ".join(segments[: depth - 1]))
            folders[full] = DriveFile.objects.create(
                drive_id=f"{prefix}folder-{len(folders) + 1}",
                name=segments[depth - 1],
                mime_type="application/vnd.google-apps.folder",
                is_folder=True,
                path=" / ".join(segments[: depth - 1]),
                parent_ids=[parent.drive_id] if parent else [],
                shared_drive_id=f"{prefix}shared-drive",
                shared_drive_name=segments[0],
            )
    return folders
