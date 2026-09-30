"""One command: pull your Google Drive into the local database.

    uv run python -m shlok.sync_drive            # up to 1000 files
    uv run python -m shlok.sync_drive -n 5000    # more
    uv run python -m shlok.sync_drive -s report  # name contains "report"
    uv run python -m shlok.sync_drive -f         # folders only

Needs archit/credentials.json (a Desktop app OAuth client). A browser opens the
first time to authorise; the token is reused after that.
"""
from __future__ import annotations

import argparse

from . import ingest


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Google Drive into the local database.")
    parser.add_argument("-n", "--limit", type=int, default=1000, help="max files to fetch (default 1000)")
    parser.add_argument("-s", "--search", help="only files whose name contains this text")
    parser.add_argument("-f", "--folders", action="store_true", help="folders only")
    args = parser.parse_args()

    print("Connecting to Google Drive (a browser may open the first time)...")
    try:
        result = ingest.import_from_drive(
            limit=args.limit, search=args.search, folders_only=args.folders
        )
    except Exception as exc:  # noqa: BLE001 - show any Drive/auth problem plainly
        raise SystemExit(f"Drive import failed: {exc}")

    print(
        f"Imported {result['nodes_upserted']} node(s) and "
        f"{result['edges_upserted']} edge(s) into shlok/data/tree.db"
    )


if __name__ == "__main__":
    main()
