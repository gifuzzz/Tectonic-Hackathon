from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from knowledge.drive_client import DriveClient
from knowledge.ingestion import sync_drive


class Command(BaseCommand):
    help = "Sync Google Drive: pull files, extract text + metadata, enrich, index, link and detect conflicts."

    def add_arguments(self, parser):
        parser.add_argument("--no-content", action="store_true", help="metadata only, skip downloading content")
        parser.add_argument("--full", action="store_true", help="re-ingest every file, not only changed ones")

    def handle(self, *args, **options):
        client = DriveClient(settings.GOOGLE_CREDENTIALS_FILE, settings.GOOGLE_TOKEN_FILE)
        try:
            stats = sync_drive(client, with_content=not options["no_content"], force=options["full"])
        except (FileNotFoundError, ValueError) as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(
            f"Synced {stats['files']} items: {stats['changed']} ingested, {stats['removed']} removed, "
            f"{stats['unresolvedConflicts']} unresolved conflict(s)."
        ))
