"""Mock data so the frontend can be built without Google Drive: customers, experts, files and cases."""
from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from knowledge.conflicts import detect_conflicts
from knowledge.ingestion import DEMO_PREFIX, ingest_file, link_supersessions
from knowledge.models import Case, CaseEvidence, Customer, DriveFile, Expert

DOC = "application/vnd.google-apps.document"
SOFIE = ("Sofie Peeters", "sofie.peeters@sdworx.example")
MARC = ("Marc Dubois", "marc.dubois@sdworx.example")
ANNA = ("Anna Jansen", "anna.jansen@sdworx.example")
FORMER = ("Former Employee", "former.employee@sdworx.example")  # not in the expert directory

CUSTOMERS = [("Acme Retail", ["Acme"]), ("Brightwave Logistics", ["Brightwave"])]
EXPERTS = [
    (SOFIE, ["payroll", "benefits", "BE"], ["Acme Retail"]),
    (MARC, ["termination", "social_security", "BE", "FR"], ["Brightwave Logistics"]),
    (ANNA, ["leave", "NL"], []),
]

FILES = [
    ("payroll-acme-v2", "BE Payroll Policy - Acme Retail v2", "HR Knowledge / Payroll / Belgium / Acme Retail",
     SOFIE, "2026-01-05", """Payroll policy for Acme Retail (Belgium)
Status: Approved
Effective date: 2026-01-01
Owner: sofie.peeters@sdworx.example
Supersedes: BE Payroll Policy - Acme Retail v1

This policy describes how monthly payroll is processed for Acme Retail employees in Belgium.

Payroll cutoff: 20th of the month
Payment date: last working day of the month
Meal voucher value: 8 EUR per working day
"""),
    ("payroll-acme-v1", "BE Payroll Policy - Acme Retail v1", "HR Knowledge / Payroll / Belgium / Acme Retail",
     SOFIE, "2024-01-10", """Payroll policy for Acme Retail (Belgium)
Status: Approved
Effective date: 2024-01-01
Owner: sofie.peeters@sdworx.example

This policy describes how monthly payroll is processed for Acme Retail employees in Belgium.

Payroll cutoff: 25th of the month
Payment date: last working day of the month
Meal voucher value: 7 EUR per working day
"""),
    ("payroll-acme-faq", "Acme Retail - Belgium payroll FAQ", "HR Knowledge / Payroll / Belgium / Acme Retail",
     MARC, "2026-03-10", """Frequently asked questions - payroll for Acme Retail in Belgium
Status: Approved
Effective date: 2026-03-01
Owner: marc.dubois@sdworx.example

Q: How much is the meal voucher?
Meal voucher value: 6 EUR per working day

Q: When is the payroll cutoff?
Payroll cutoff: 20th of the month
"""),
    ("termination-be", "Belgium Termination Guidelines", "HR Knowledge / Legal / Belgium",
     MARC, "2026-02-01", """Termination guidelines for employers in Belgium
Status: Approved
Effective date: 2026-01-01
Owner: marc.dubois@sdworx.example

These guidelines apply to all customers unless a customer-specific procedure exists.

Notice period (less than 1 year seniority): 1 week
Notice period (1 to 2 years seniority): 5 weeks
"""),
    ("termination-brightwave", "Brightwave Logistics - Termination procedure BE DRAFT",
     "HR Knowledge / Legal / Belgium / Brightwave Logistics", MARC, "2026-09-01",
     """Termination procedure for Brightwave Logistics warehouse staff in Belgium
Status: Draft
Effective date: 2026-10-01
Owner: marc.dubois@sdworx.example

Notice period (less than 1 year seniority): 2 weeks
Exit interview: mandatory
"""),
    ("leave-nl-2025", "NL Leave Policy 2025", "HR Knowledge / Leave / Netherlands",
     ANNA, "2025-01-02", """Leave policy for employees in the Netherlands
Status: Approved
Effective date: 2025-01-01
Valid until: 2025-12-31
Owner: anna.jansen@sdworx.example

Annual leave days: 25
Carry-over of unused leave: 5 days
"""),
    ("leave-nl-2026", "NL Leave Policy 2026", "HR Knowledge / Leave / Netherlands",
     ANNA, "2026-01-02", """Leave policy for employees in the Netherlands
Status: Approved
Effective date: 2026-01-01
Owner: anna.jansen@sdworx.example

Annual leave days: 26
Carry-over of unused leave: 5 days
"""),
    ("expenses-acme", "Acme Retail BE expense reimbursement", "HR Knowledge / Finance / Belgium / Acme Retail",
     FORMER, "2023-04-01", """Expense reimbursement rules for Acme Retail employees in Belgium

Mileage allowance: 0.42 EUR per km
Maximum hotel cost per night: 150 EUR
"""),
]

CASES = [
    {
        "title": "Which meal voucher value applies to Acme Retail in Belgium?",
        "question": "An Acme Retail employee asks why their meal voucher is 6 EUR instead of 8 EUR.",
        "customer": "Acme Retail", "country": "BE", "topic": "payroll",
        "evidence": ["payroll-acme-v2", "payroll-acme-faq"],
    },
    {
        "title": "Notice period for Brightwave warehouse staff",
        "question": "What notice period applies to a Brightwave warehouse worker with 8 months seniority?",
        "customer": "Brightwave Logistics", "country": "BE", "topic": "termination",
        "evidence": ["termination-be", "termination-brightwave"],
        "expert": MARC, "status": Case.Status.IN_REVIEW, "review_status": Case.ReviewStatus.REQUESTED,
    },
    {
        "title": "NL annual leave days for 2026",
        "question": "How many annual leave days do Dutch employees get in 2026?",
        "customer": None, "country": "NL", "topic": "leave",
        "evidence": ["leave-nl-2025", "leave-nl-2026"],
        "expert": ANNA, "status": Case.Status.RESOLVED, "review_status": Case.ReviewStatus.COMPLETED,
        "resolution": "26 days apply from 2026-01-01. The 2025 policy (25 days) is superseded.",
    },
]


def _dt(day):
    return datetime.fromisoformat(day).replace(hour=9, tzinfo=dt_timezone.utc)


class Command(BaseCommand):
    help = "Load demo customers, experts, files and cases (no Google Drive needed)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="delete existing demo files and cases first")

    @transaction.atomic
    def handle(self, *args, **options):
        demo_files = DriveFile.objects.filter(drive_id__startswith=DEMO_PREFIX)
        demo_cases = Case.objects.filter(title__in=[c["title"] for c in CASES])
        if options["reset"]:
            demo_cases.delete()
            demo_files.delete()
        elif demo_files.exists():
            raise CommandError("Demo data already exists. Use --reset to recreate it.")

        customers = {}
        for name, aliases in CUSTOMERS:
            customers[name], _ = Customer.objects.update_or_create(name=name, defaults={"aliases": aliases})
        experts = {}
        for (name, email), tags, customer_names in EXPERTS:
            expert, _ = Expert.objects.update_or_create(
                email=email, defaults={"name": name, "expertise_tags": tags, "active": True}
            )
            expert.customers.set([customers[n] for n in customer_names])
            experts[email] = expert

        files = {}
        customer_list = list(Customer.objects.all())
        for key, name, path, (owner_name, owner_email), modified, content in FILES:
            f = DriveFile.objects.create(
                drive_id=DEMO_PREFIX + key,
                name=name,
                mime_type=DOC,
                path=path,
                owners=[{"name": owner_name, "email": owner_email, "role": "owner"}],
                drive_modified_at=_dt(modified),
                content_text=content,
            )
            ingest_file(f, customer_list)
            files[key] = f
        link_supersessions()
        conflicts = detect_conflicts()

        for spec in CASES:
            expert = experts[spec["expert"][1]] if spec.get("expert") else None
            case = Case.objects.create(
                title=spec["title"],
                question=spec["question"],
                customer=customers.get(spec["customer"]),
                country=spec["country"],
                topic=spec["topic"],
                assigned_expert=expert,
                status=spec.get("status", Case.Status.OPEN),
                review_status=spec.get("review_status", Case.ReviewStatus.NOT_REQUESTED),
                resolution=spec.get("resolution", ""),
                resolved_at=timezone.now() if spec.get("resolution") else None,
            )
            for key in spec["evidence"]:
                CaseEvidence.objects.create(case=case, file=files[key])

        self.stdout.write(self.style.SUCCESS(
            f"Loaded {len(FILES)} files, {len(EXPERTS)} experts, {len(CASES)} cases, {conflicts} unresolved conflict(s)."
        ))
