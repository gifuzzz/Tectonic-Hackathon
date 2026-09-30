"""List your Google Drive files in the terminal.

Setup:
  pip install google-api-python-client google-auth-oauthlib
  Put an OAuth "Desktop app" client file next to this script as credentials.json
  (Google Cloud Console -> APIs & Services -> Credentials, with the Drive API enabled).

Usage:
  python drive.py                 # 20 most recently modified files
  python drive.py -n 50           # show 50 files
  python drive.py -s report       # files whose name contains "report"
  python drive.py -f              # folders only
  python drive.py --logout        # forget the saved login
"""
import argparse
import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"]
HERE = os.path.dirname(os.path.abspath(__file__))
CREDS_FILE = os.path.join(HERE, "credentials.json")
TOKEN_FILE = os.path.join(HERE, "token.json")


def login():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds and creds.valid:
        return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        flow = InstalledAppFlow.from_client_secrets_file(CREDS_FILE, SCOPES)
        creds = flow.run_local_server(port=0)
    with open(TOKEN_FILE, "w") as f:
        f.write(creds.to_json())
    return creds


def human_size(size):
    if size is None:
        return "-"
    size = float(size)
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.0f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def main():
    parser = argparse.ArgumentParser(description="List your Google Drive files.")
    parser.add_argument("-n", "--limit", type=int, default=20, help="number of files to show")
    parser.add_argument("-s", "--search", help="only files whose name contains this text")
    parser.add_argument("-f", "--folders", action="store_true", help="only show folders")
    parser.add_argument("--logout", action="store_true", help="delete the saved login token")
    args = parser.parse_args()

    if args.logout:
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
        print("Logged out.")
        return

    query = ["trashed = false"]
    if args.search:
        query.append("name contains '{}'".format(args.search.replace("'", "\\'")))
    if args.folders:
        query.append("mimeType = 'application/vnd.google-apps.folder'")

    service = build("drive", "v3", credentials=login())
    files, page_token = [], None
    while len(files) < args.limit:
        resp = service.files().list(
            q=" and ".join(query),
            orderBy="modifiedTime desc",
            pageSize=min(args.limit - len(files), 1000),
            pageToken=page_token,
            fields="nextPageToken, files(name, mimeType, size, modifiedTime)",
        ).execute()
        files += resp.get("files", [])
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    if not files:
        print("No files found.")
        return

    print(f"{'NAME':<50} {'TYPE':<14} {'SIZE':>8}  MODIFIED")
    print("-" * 90)
    for f in files:
        name = f["name"] if len(f["name"]) <= 50 else f["name"][:47] + "..."
        kind = f["mimeType"].split("/")[-1].replace("vnd.google-apps.", "")[:14]
        print(f"{name:<50} {kind:<14} {human_size(f.get('size')):>8}  {f['modifiedTime'][:10]}")
    print(f"\n{len(files)} file(s)")


if __name__ == "__main__":
    main()
