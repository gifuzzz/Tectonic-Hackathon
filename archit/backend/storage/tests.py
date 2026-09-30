import json
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from knowledge.ingestion import sync_drive
from knowledge.models import DriveFile
from knowledge import tests as knowledge_tests

from . import services
from .models import ChangeLog, FileVersion, Note, Suggestion

SOFIE = {"HTTP_X_USER_EMAIL": "sofie.peeters@sdworx.example"}
ANNA = {"HTTP_X_USER_EMAIL": "anna.jansen@sdworx.example"}
ADMIN = {"HTTP_X_USER_EMAIL": "lm@sdworx.example"}


@override_settings(OPENAI_API_KEY="", GOOGLE_TOKEN_FILE="does-not-exist.json")
class StorageApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())

    def get(self, url, **headers):
        resp = self.client.get(url, **headers)
        return resp.status_code, resp.json()

    def send(self, method, url, body, **headers):
        resp = getattr(self.client, method)(url, json.dumps(body), content_type="application/json", **headers)
        return resp.status_code, resp.json()

    def test_browse_root_and_folders(self):
        status, root = self.get("/api/browse")
        self.assertEqual(status, 200)
        self.assertEqual(root["path"], "")
        self.assertEqual([c["name"] for c in root["children"]], ["HR Knowledge"])
        self.assertTrue(root["children"][0]["virtual"])  # shared drive: not a Drive file itself

        status, payroll = self.get("/api/browse?path=HR Knowledge/Payroll")
        self.assertEqual(status, 200)
        self.assertEqual(payroll["path"], "HR Knowledge / Payroll")
        self.assertEqual([b["name"] for b in payroll["breadcrumbs"]], ["HR Knowledge", "Payroll"])
        self.assertFalse(payroll["folder"]["virtual"])
        self.assertEqual(payroll["folder"]["meta"]["category"], "Payroll")  # our data on a folder
        self.assertEqual(payroll["folder"]["notesCount"], 1)
        self.assertEqual([c["name"] for c in payroll["children"]], ["Belgium"])

        status, acme = self.get("/api/browse?path=HR Knowledge / Payroll / Belgium / Acme Retail")
        names = [c["name"] for c in acme["children"]]
        self.assertIn("BE Payroll Policy - Acme Retail v2", names)
        v2 = next(c for c in acme["children"] if c["name"] == "BE Payroll Policy - Acme Retail v2")
        self.assertEqual(v2["drive"]["owners"][0]["email"], "sofie.peeters@sdworx.example")  # Drive data
        self.assertEqual(v2["knowledge"]["country"], "BE")  # knowledge data
        self.assertEqual(v2["meta"]["validity"], "useful")  # our data
        self.assertEqual(v2["version"], 2)

        self.assertEqual(self.get("/api/browse?path=Nope/Nothing")[0], 404)

    def test_browse_to_a_file(self):
        status, data = self.get("/api/browse?path=HR Knowledge/Leave/Netherlands/NL Leave Policy 2026")
        self.assertEqual(status, 200)
        self.assertEqual(data["folder"]["type"], "file")
        self.assertEqual(data["children"], [])

    def test_visibility(self):
        _, as_anna = self.get("/api/browse?path=HR Knowledge / Payroll / Belgium / Acme Retail", **ANNA)
        self.assertEqual(as_anna["children"], [])  # Acme + BE files are hidden from an NL-only user
        _, as_sofie = self.get("/api/browse?path=HR Knowledge / Payroll / Belgium / Acme Retail", **SOFIE)
        self.assertEqual(len(as_sofie["children"]), 3)
        self.assertEqual(self.get("/api/nodes/demo-payroll-acme-v2", **ANNA)[0], 404)
        self.assertEqual(self.get("/api/nodes/demo-payroll-acme-v2", **SOFIE)[0], 200)
        _, admin_graph = self.get("/api/graph", **ADMIN)
        _, anna_graph = self.get("/api/graph", **ANNA)
        self.assertGreater(len(admin_graph["nodes"]), len(anna_graph["nodes"]))
        _, results = self.send("post", "/api/search", {"query": "meal voucher Acme"}, **ANNA)
        self.assertEqual(results["results"], [])

    def test_node_detail(self):
        status, data = self.get("/api/nodes/demo-payroll-acme-faq")
        self.assertEqual(status, 200)
        self.assertEqual(data["node"]["knowledge"]["documentType"], "faq")
        self.assertIn("permissions", data["node"]["drive"])
        self.assertEqual(data["trust"]["conflicts"], 1)
        self.assertEqual(len(data["conflicts"]), 1)
        note = data["notes"][0]
        self.assertEqual(note["author"], "Marc Dubois")
        self.assertEqual(note["replies"][0]["author"], "Sofie Peeters")
        mention = note["mentions"][0]
        self.assertEqual(mention["name"], "BE Payroll Policy - Acme Retail v2")
        self.assertEqual((mention["mentionedVersion"], mention["currentVersion"], mention["outdated"]), (1, 2, True))
        _, policy = self.get("/api/nodes/demo-payroll-acme-v2")
        self.assertEqual(policy["mentionedIn"][0]["fileName"], "Acme Retail - Belgium payroll FAQ")
        self.assertEqual([v["number"] for v in policy["versions"]], [2, 1])
        _, folder = self.get(f"/api/nodes/{DriveFile.objects.get(name='Payroll').drive_id}")
        self.assertEqual([c["name"] for c in folder["children"]], ["Belgium"])
        self.assertIsNone(folder["trust"])

    def test_patch_meta_history_and_meta_at(self):
        status, node = self.send("patch", "/api/nodes/demo-leave-nl-2026/meta",
                                 {"tags": ["policy", "leave"], "validity": "awaiting_replacement", "source": "HR"},
                                 **ANNA)
        self.assertEqual(status, 200)
        self.assertEqual(node["meta"]["tags"], ["policy", "leave"])
        self.assertEqual(node["meta"]["updatedBy"], "Anna Jansen")
        _, history = self.get("/api/nodes/demo-leave-nl-2026/history?field=validity")
        self.assertEqual(history["history"][0]["oldValue"], "useful")
        self.assertEqual(history["history"][0]["newValue"], "awaiting_replacement")
        # source didn't change, so no history row for it
        self.assertFalse(ChangeLog.objects.filter(file__drive_id="demo-leave-nl-2026", field="source",
                                                  changed_by="Anna Jansen").exists())
        before = ChangeLog.objects.filter(file__drive_id="demo-leave-nl-2026", field="validity").last().changed_at
        _, at = self.get(f"/api/nodes/demo-leave-nl-2026/meta-at?timestamp={before.isoformat().replace('+', '%2B')}")
        self.assertEqual(at["meta"]["validity"], "useful")

        self.assertEqual(self.send("patch", "/api/nodes/demo-leave-nl-2026/meta", {"validity": "great"})[0], 400)
        self.assertEqual(self.send("patch", "/api/nodes/demo-leave-nl-2026/meta", {"tags": "x"})[0], 400)
        _, node = self.send("patch", "/api/nodes/demo-leave-nl-2026/meta", {"companies": ["New Client BV"]})
        self.assertEqual(node["meta"]["companies"], ["New Client BV"])

    def test_notes(self):
        status, data = self.send("post", "/api/nodes/demo-termination-be/notes",
                                 {"text": "If you read this you also need @[NL Leave Policy 2026]", "validity": "useful"},
                                 **SOFIE)
        self.assertEqual(status, 200)
        note = data["notes"][-1]
        self.assertEqual(note["author"], "Sofie Peeters")
        self.assertEqual(note["mentions"][0]["name"], "NL Leave Policy 2026")
        self.assertFalse(note["mentions"][0]["outdated"])
        status, data = self.send("post", "/api/nodes/demo-termination-be/notes",
                                 {"text": "Agreed", "parentId": note["id"], "author": "Marc"})
        self.assertEqual(data["notes"][-1]["replies"][0]["text"], "Agreed")
        status, data = self.send("patch", f"/api/notes/{note['id']}", {"validity": "invalid"})
        self.assertEqual(data["notes"][-1]["validity"], "invalid")
        self.assertTrue(ChangeLog.objects.filter(action="note_validity", note_id=note["id"]).exists())
        self.assertEqual(self.send("post", "/api/nodes/demo-termination-be/notes", {"text": " "})[0], 400)
        other = Note.objects.exclude(file__drive_id="demo-termination-be").first()
        self.assertEqual(self.send("post", "/api/nodes/demo-termination-be/notes",
                                   {"text": "x", "parentId": other.id})[0], 400)

    def test_metadata_search(self):
        _, data = self.get("/api/search?tag=law")
        self.assertEqual([n["name"] for n in data["nodes"]], ["Belgium Termination Guidelines"])
        _, data = self.get("/api/search?validity=old")
        self.assertEqual({n["name"] for n in data["nodes"]}, {"BE Payroll Policy - Acme Retail v1", "NL Leave Policy 2025"})
        _, data = self.get("/api/search?type=folder&q=bel")
        self.assertTrue(all(n["type"] == "folder" for n in data["nodes"]))
        _, data = self.get("/api/search?company=Brightwave Logistics")
        self.assertEqual([n["name"] for n in data["nodes"]], ["Brightwave Logistics - Termination procedure BE DRAFT"])

    def test_suggestions(self):
        _, pending = self.get("/api/suggestions")
        kinds = {(s["file"]["name"], s["kind"], s["suggestedValidity"]) for s in pending}
        self.assertIn(("Acme Retail - Belgium payroll FAQ", "validity", "old"), kinds)
        self.assertIn(("Brightwave Logistics - Termination procedure BE DRAFT", "validity", "awaiting_replacement"), kinds)
        validity = next(s for s in pending if s["kind"] == "validity" and s["suggestedValidity"] == "old")
        status, accepted = self.send("post", f"/api/suggestions/{validity['id']}/accept", {}, **SOFIE)
        self.assertEqual((status, accepted["status"]), (200, "accepted"))
        self.assertEqual(DriveFile.objects.get(drive_id="demo-payroll-acme-faq").meta.validity, "old")
        self.assertEqual(self.send("post", f"/api/suggestions/{validity['id']}/accept", {})[0], 400)
        note = next(s for s in pending if s["kind"] == "note")
        self.assertEqual(self.send("post", f"/api/suggestions/{note['id']}/dismiss", {})[1]["status"], "dismissed")

        _, created = self.send("post", "/api/suggestions/analyze",
                               {"source": "message", "sender": "Teams", "text": "NL Leave Policy 2025 is obsolete"})
        self.assertEqual({s["kind"] for s in created["created"]}, {"validity", "note"})
        self.assertEqual({s["file"]["name"] for s in created["created"]}, {"NL Leave Policy 2025"})
        self.assertEqual(self.send("post", "/api/suggestions/analyze", {"source": "fax", "text": "x"})[0], 400)

    def test_short_titles_inside_longer_ones_are_not_mentions(self):
        DriveFile.objects.create(drive_id="x-draft", name="Draft", mime_type="text/plain")
        created = services.analyze_message("message", "", "Brightwave Logistics - Termination procedure BE DRAFT is outdated")
        self.assertEqual({s.file.name for s in created}, {"Brightwave Logistics - Termination procedure BE DRAFT"})

    def test_users_health_activity(self):
        _, users = self.get("/api/users")
        self.assertEqual(len(users), 4)
        _, health = self.get("/api/health")
        self.assertEqual(health["status"], "ok")
        _, activity = self.get("/api/activity?limit=5")
        self.assertEqual(len(activity), 5)
        self.assertIn("file", activity[0])

    def test_sync_without_login_is_a_clear_error(self):
        status, data = self.send("post", "/api/sync", {})
        self.assertEqual(status, 400)
        self.assertIn("sync_drive", data["error"])

    def test_ingest(self):
        status, data = self.send("post", "/api/ingest", {
            "nodes": [
                {"id": "x-reports", "name": "Reports", "type": "folder"},
                {"id": "x-q3", "name": "Q3 BE payroll report.pdf", "type": "file", "mime_type": "application/pdf",
                 "parent_id": "x-reports", "size": 42, "modified_time": "2026-09-01T10:00:00Z"},
            ],
            "source": "archive",
        })
        self.assertEqual(status, 200)
        self.assertEqual((data["nodesUpserted"], data["changed"], data["source"]), (2, 1, "archive"))
        q3 = DriveFile.objects.get(drive_id="x-q3")
        self.assertEqual(q3.path, "My Drive / Reports")
        self.assertEqual(q3.versions.count(), 1)
        self.send("patch", "/api/nodes/x-q3/meta", {"tags": ["keep me"]})
        self.send("post", "/api/ingest", {"nodes": [{"id": "x-q3", "name": "Q3 renamed.pdf", "parent_id": "x-reports",
                                                     "modified_time": "2026-09-02T10:00:00Z"}]})
        q3.refresh_from_db()
        self.assertEqual(q3.name, "Q3 renamed.pdf")
        self.assertEqual(q3.meta.tags, ["keep me"])  # re-ingest never touches our data
        self.assertEqual(q3.versions.count(), 2)
        self.assertEqual(self.send("post", "/api/ingest", {"nodes": "nope"})[0], 400)


@override_settings(OPENAI_API_KEY="")
class SyncVersionTests(TestCase):
    def test_sync_records_versions_only_on_change(self):
        items = [dict(i) for i in knowledge_tests.SyncTests.ITEMS]
        sync_drive(knowledge_tests.FakeDrive(items, knowledge_tests.SyncTests.TEXTS))
        self.assertEqual(FileVersion.objects.filter(file__drive_id="d1").count(), 1)
        sync_drive(knowledge_tests.FakeDrive(items, knowledge_tests.SyncTests.TEXTS))
        self.assertEqual(FileVersion.objects.filter(file__drive_id="d1").count(), 1)
        items[1]["modifiedTime"] = "2026-03-01T10:00:00.000Z"
        items[1]["name"] = "BE Leave Policy (renamed)"
        sync_drive(knowledge_tests.FakeDrive(items, knowledge_tests.SyncTests.TEXTS))
        versions = FileVersion.objects.filter(file__drive_id="d1")
        self.assertEqual([v.number for v in versions], [2, 1])
        self.assertEqual(versions[0].name, "BE Leave Policy (renamed)")
        self.assertEqual(Suggestion.objects.count(), 0)
