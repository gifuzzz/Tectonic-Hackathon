"""Read your Google Drive files, from Python or the terminal.

Setup:
  uv sync
  Put an OAuth "Desktop app" client file next to this script as credentials.json
  (Google Cloud Console -> APIs & Services -> Credentials, with the Drive API enabled).
  A "Web application" client will NOT work: Google rejects the localhost redirect.

Python:
  from archit.drive import GoogleDrive

  drive = GoogleDrive()
  drive.authenticate()                  # opens the browser the first time only
  files = drive.list_files(limit=50, search="report")
  for f in files:
      print(f["name"], f["size"], f["modifiedTime"])

  Run your script as a module from the repo root so `archit` is importable:
    uv run python -m yourfolder.yourscript      (for yourfolder/yourscript.py)

Terminal:
  uv run archit/drive.py              # 20 most recently modified files
  uv run archit/drive.py -n 50        # show 50 files
  uv run archit/drive.py -s report    # files whose name contains "report"
  uv run archit/drive.py -f           # folders only
  uv run archit/drive.py --logout     # forget the saved login
"""
import argparse
import json
import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"]
HERE = os.path.dirname(os.path.abspath(__file__))
FOLDER_MIME = "application/vnd.google-apps.folder"


class GoogleDrive:
    """Read-only access to one user's Google Drive file list."""

    def __init__(self, credentials_file=None, token_file=None):
        self.credentials_file = credentials_file or os.path.join(HERE, "credentials.json")
        self.token_file = token_file or os.path.join(HERE, "token.json")
        self._service = None

    def authenticate(self):
        """Log in, reusing the saved token if there is one. Opens a browser if needed."""
        creds = None
        if os.path.exists(self.token_file):
            creds = Credentials.from_authorized_user_file(self.token_file, SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        elif not (creds and creds.valid):
            self._check_credentials_file()
            flow = InstalledAppFlow.from_client_secrets_file(self.credentials_file, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(self.token_file, "w") as f:
            f.write(creds.to_json())
        self._service = build("drive", "v3", credentials=creds)

    def logout(self):
        """Forget the saved login. The next authenticate() opens the browser again."""
        if os.path.exists(self.token_file):
            os.remove(self.token_file)
        self._service = None

    def list_files(self, limit=20, search=None, folders_only=False):
        """Return up to `limit` files, most recently modified first.

        Each file is a dict with: id, name, mimeType, size (int bytes, or None for
        Google Docs/folders), modifiedTime (ISO string) and webViewLink (URL).
        """
        if self._service is None:
            self.authenticate()

        query = ["trashed = false"]
        if search:
            escaped = search.replace("\\", "\\\\").replace("'", "\\'")
            query.append(f"name contains '{escaped}'")
        if folders_only:
            query.append(f"mimeType = '{FOLDER_MIME}'")

        files, page_token = [], None
        while len(files) < limit:
            resp = self._service.files().list(
                q=" and ".join(query),
                orderBy="modifiedTime desc",
                pageSize=min(limit - len(files), 1000),
                pageToken=page_token,
                fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)",
            ).execute()
            files += resp.get("files", [])
            page_token = resp.get("nextPageToken")
            if not page_token:
                break

        for f in files:
            f["size"] = int(f["size"]) if "size" in f else None
        return files[:limit]

    def _check_credentials_file(self):
        if not os.path.exists(self.credentials_file):
            raise FileNotFoundError(
                f"Missing {self.credentials_file}. "
                "Download a Desktop app OAuth client from Google Cloud Console."
            )
        with open(self.credentials_file) as f:
            if "installed" not in json.load(f):
                raise ValueError(
                    f"{self.credentials_file} is not a Desktop app client (Google will reject the login).\n"
                    "Create one: Google Cloud Console -> APIs & Services -> Credentials ->\n"
                    "Create credentials -> OAuth client ID -> Application type: Desktop app.\n"
                    "Download the JSON and save it over credentials.json."
                )


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

    drive = GoogleDrive()
    if args.logout:
        drive.logout()
        print("Logged out.")
        return

    try:
        files = drive.list_files(limit=args.limit, search=args.search, folders_only=args.folders)
    except (FileNotFoundError, ValueError) as e:
        raise SystemExit(str(e))

    if not files:
        print("No files found.")
        return

    print(f"{'NAME':<50} {'TYPE':<14} {'SIZE':>8}  MODIFIED")
    print("-" * 90)
    for f in files:
        name = f["name"] if len(f["name"]) <= 50 else f["name"][:47] + "..."
        kind = f["mimeType"].split("/")[-1].replace("vnd.google-apps.", "")[:14]
        print(f"{name:<50} {kind:<14} {human_size(f['size']):>8}  {f['modifiedTime'][:10]}")
    print(f"\n{len(files)} file(s)")


if __name__ == "__main__":
    main()
