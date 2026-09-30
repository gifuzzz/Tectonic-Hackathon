from django.core.management.base import BaseCommand

from knowledge.conflicts import detect_conflicts
from knowledge.ingestion import ingest_file, link_supersessions
from knowledge.models import Customer, DriveFile


class Command(BaseCommand):
    help = "Re-run enrichment, indexing, relationships and conflict detection on stored files (no Drive calls)."

    def handle(self, *args, **options):
        customers = list(Customer.objects.all())
        files = DriveFile.objects.filter(trashed=False, is_folder=False)
        for f in files:
            ingest_file(f, customers)
        link_supersessions()
        conflicts = detect_conflicts()
        self.stdout.write(self.style.SUCCESS(f"Reindexed {files.count()} files, {conflicts} unresolved conflict(s)."))
