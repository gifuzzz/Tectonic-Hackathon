"""Google Drive connector: files, folders, owners, dates, permissions, shared drives and content."""
import json
import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from . import extract

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
FOLDER_MIME = "application/vnd.google-apps.folder"
FILE_FIELDS = (
    "id, name, mimeType, parents, driveId, webViewLink, size, modifiedTime, md5Checksum, "
    "owners(displayName, emailAddress), lastModifyingUser(displayName, emailAddress), "
    "permissions(type, role, emailAddress, domain, displayName)"
)


class DriveClient:
    def __init__(self, credentials_file, token_file):
        self.credentials_file = credentials_file
        self.token_file = token_file
        self._service = None

    def authenticate(self):
        """Log in, reusing the saved token. Opens a browser the first time."""
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

    def list_shared_drives(self):
        """Return {shared_drive_id: name}."""
        drives, page_token = {}, None
        while True:
            resp = self._service.drives().list(
                pageSize=100, pageToken=page_token, fields="nextPageToken, drives(id, name)"
            ).execute()
            drives.update({d["id"]: d["name"] for d in resp.get("drives", [])})
            page_token = resp.get("nextPageToken")
            if not page_token:
                return drives

    def list_all_files(self):
        """Yield every non-trashed file and folder the user can see, in My Drive and shared drives."""
        page_token = None
        while True:
            resp = self._service.files().list(
                q="trashed = false",
                corpora="allDrives",
                includeItemsFromAllDrives=True,
                supportsAllDrives=True,
                pageSize=1000,
                pageToken=page_token,
                fields=f"nextPageToken, files({FILE_FIELDS})",
            ).execute()
            yield from resp.get("files", [])
            page_token = resp.get("nextPageToken")
            if not page_token:
                return

    def get_permissions(self, file_id):
        """Permissions for one file (files.list leaves them out for shared-drive files)."""
        try:
            resp = self._service.permissions().list(
                fileId=file_id,
                supportsAllDrives=True,
                fields="permissions(type, role, emailAddress, domain, displayName)",
            ).execute()
        except HttpError:
            return []  # the user may not be allowed to see a file's sharing settings
        return resp.get("permissions", [])

    def extract_text(self, item):
        return extract.extract_text(self._service, item)

    def _check_credentials_file(self):
        if not os.path.exists(self.credentials_file):
            raise FileNotFoundError(
                f"Missing {self.credentials_file}. Download a Desktop app OAuth client from Google Cloud Console."
            )
        with open(self.credentials_file) as f:
            if "installed" not in json.load(f):
                raise ValueError(
                    f"{self.credentials_file} is not a Desktop app OAuth client (Google will reject the login)."
                )
