import json
from datetime import date
from io import BytesIO, StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from .conflicts import compare, values_oppose
from .enrich import base_name, detect_country, extract_claims, parse_date
from .extract import DOCX, text_from_bytes
from .ingestion import sync_drive
from .models import Case, Conflict, DriveFile
from .trust import Context, evaluate


def demo(key):
    return DriveFile.objects.get(drive_id=f"demo-{key}")


class UnitTests(TestCase):
    def test_parse_date(self):
        self.assertEqual(parse_date("2026-01-31"), date(2026, 1, 31))
        self.assertEqual(parse_date("31/01/2026"), date(2026, 1, 31))  # day first
        self.assertEqual(parse_date("31.01.2026"), date(2026, 1, 31))
        self.assertEqual(parse_date("1 January 2026"), date(2026, 1, 1))
        self.assertEqual(parse_date("Sept 5, 2026"), date(2026, 9, 5))
        self.assertIsNone(parse_date("31/02/2026"))
        self.assertIsNone(parse_date("soon"))

    def test_detect_country_ignores_lowercase_codes(self):
        self.assertEqual(detect_country("BE payroll", "", ""), "BE")
        self.assertEqual(detect_country("be careful", "", ""), "")
        self.assertEqual(detect_country("", "Leave / Netherlands", ""), "NL")

    def test_extract_claims_skips_metadata(self):
        claims = extract_claims("Status: Approved\nOwner: a@b.com\nNotice period: 30 days\nSee https://x.org")
        self.assertEqual([c["subject"] for c in claims], ["notice_period"])
        self.assertEqual(claims[0]["value"], "30 days")

    def test_base_name(self):
        self.assertEqual(base_name("BE Payroll Policy - Acme v2.docx"), "be payroll policy acme")
        self.assertEqual(base_name("NL Leave Policy 2025 (final)"), "nl leave policy")

    def test_values_oppose(self):
        self.assertTrue(values_oppose("8 EUR", "6 EUR"))
        self.assertFalse(values_oppose("20th of the month", "20th  of the month"))
        self.assertFalse(values_oppose("0,42 EUR", "0.42 EUR"))
        self.assertTrue(values_oppose("allowed", "not allowed"))

    def test_text_extraction(self):
        import docx

        self.assertEqual(text_from_bytes("﻿hello".encode(), "text/plain"), "hello")
        document = docx.Document()
        document.add_paragraph("Notice period: 30 days")
        buf = BytesIO()
        document.save(buf)
        self.assertIn("Notice period: 30 days", text_from_bytes(buf.getvalue(), DOCX))


@override_settings(OPENAI_API_KEY="")
class DemoDataTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())

    def test_enrichment(self):
        f = demo("payroll-acme-v2")
        self.assertEqual(f.country, "BE")
        self.assertEqual(f.customer.name, "Acme Retail")
        self.assertEqual(f.topic, "payroll")
        self.assertEqual(f.document_type, "policy")
        self.assertEqual(f.status, "approved")
        self.assertEqual(f.effective_date, date(2026, 1, 1))
        self.assertEqual(f.owner.email, "sofie.peeters@sdworx.example")
        self.assertIn("meal_voucher_value", [c["subject"] for c in f.claims])
        self.assertEqual(demo("leave-nl-2025").expiry_date, date(2025, 12, 31))
        self.assertEqual(demo("termination-brightwave").status, "draft")
        self.assertIsNone(demo("termination-be").customer)
        self.assertTrue(f.chunks.exists())

    def test_supersession(self):
        self.assertEqual(demo("payroll-acme-v2").supersedes, demo("payroll-acme-v1"))
        self.assertEqual(demo("leave-nl-2026").supersedes, demo("leave-nl-2025"))
        self.assertIsNone(demo("payroll-acme-faq").supersedes)

    def test_conflicts(self):
        conflicts = list(Conflict.objects.all())
        self.assertEqual(len(conflicts), 1)
        c = conflicts[0]
        self.assertEqual(c.subject, "meal_voucher_value")
        self.assertEqual({c.file_a, c.file_b}, {demo("payroll-acme-v2"), demo("payroll-acme-faq")})
        self.assertEqual(c.severity, "high")
        # Generic guideline vs customer-specific procedure: opposing claims, but not a conflict that matters.
        result = compare(demo("termination-be"), demo("termination-brightwave"))
        self.assertTrue(result["opposingClaims"])
        self.assertFalse(result["isConflict"])

    def test_trust(self):
        today = date(2026, 9, 30)
        acme_be = Context(country="BE", customer=demo("payroll-acme-v2").customer)
        t = evaluate(demo("payroll-acme-v2"), acme_be, today)
        self.assertEqual(
            {k: t[k] for k in ["contextMatch", "authority", "recency", "ownerVerified", "superseded", "conflicts"]},
            {"contextMatch": "strong", "authority": "official", "recency": "current",
             "ownerVerified": True, "superseded": False, "conflicts": 1},
        )
        self.assertEqual(t["verdict"], "use_with_caution")
        old = evaluate(demo("payroll-acme-v1"), acme_be, today)
        self.assertTrue(old["superseded"])
        self.assertEqual(old["verdict"], "do_not_use")
        self.assertEqual(evaluate(demo("leave-nl-2026"), acme_be, today)["contextMatch"], "mismatch")
        stale = evaluate(demo("expenses-acme"), acme_be, today)
        self.assertEqual((stale["recency"], stale["ownerVerified"], stale["authority"]), ("stale", False, "unverified"))
        self.assertEqual(evaluate(demo("leave-nl-2025"), Context(country="NL"), today)["recency"], "expired")
        self.assertEqual(evaluate(demo("leave-nl-2026"), Context(country="NL"), today)["verdict"], "trusted")

    def post(self, url, body):
        return self.client.post(url, json.dumps(body), content_type="application/json")

    def test_search(self):
        resp = self.post("/search", {"query": "meal voucher value Acme Retail Belgium"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["context"]["country"], "BE")
        self.assertEqual(data["context"]["customer"]["name"], "Acme Retail")
        names = [r["name"] for r in data["results"]]
        # The two current documents (which conflict) outrank the superseded v1.
        self.assertEqual(set(names[:2]), {"BE Payroll Policy - Acme Retail v2", "Acme Retail - Belgium payroll FAQ"})
        self.assertEqual(names[2], "BE Payroll Policy - Acme Retail v1")
        self.assertEqual(data["results"][2]["trust"]["verdict"], "do_not_use")
        self.assertEqual(len(data["conflicts"]), 1)
        self.assertIn("trust", data["results"][0])

    def test_search_validation(self):
        self.assertEqual(self.post("/search", {}).status_code, 400)
        self.assertEqual(self.post("/search", {"query": "x", "customer": "Nobody"}).status_code, 400)
        self.assertEqual(self.post("/search", {"query": "x", "country": "Atlantis"}).status_code, 400)
        self.assertEqual(self.client.get("/search").status_code, 405)
        resp = self.client.post("/search", "not json", content_type="application/json")
        self.assertEqual(resp.status_code, 400)

    def test_cases_endpoints(self):
        cases = self.client.get("/cases").json()
        self.assertEqual(len(cases), 3)
        case = Case.objects.get(title__startswith="Which meal voucher")
        detail = self.client.get(f"/cases/{case.id}").json()
        self.assertEqual(len(detail["unresolvedConflicts"]), 1)
        evidence = self.client.get(f"/cases/{case.id}/evidence").json()
        self.assertEqual(len(evidence["evidence"]), 2)
        self.assertEqual(evidence["evidence"][0]["trust"]["contextMatch"], "strong")
        self.assertEqual(self.client.get("/cases/99999").status_code, 404)
        self.assertEqual(len(self.client.get("/cases?status=resolved").json()), 1)

    def test_file_endpoint(self):
        f = demo("payroll-acme-v2")
        data = self.client.get(f"/files/{f.id}?country=BE&customer=Acme").json()
        self.assertEqual(data["supersedes"]["id"], demo("payroll-acme-v1").id)
        self.assertEqual(data["trust"]["contextMatch"], "strong")
        self.assertEqual(len(data["conflicts"]), 1)
        self.assertIn("Meal voucher value", data["content"])
        self.assertEqual(self.client.get("/files/99999").status_code, 404)

    def test_compare_endpoint(self):
        ids = [demo("payroll-acme-v2").id, demo("payroll-acme-faq").id, demo("payroll-acme-v1").id]
        data = self.post("/compare", {"fileIds": ids}).json()
        self.assertEqual(len(data["comparisons"]), 3)
        self.assertEqual(data["conflictCount"], 1)
        self.assertEqual(self.post("/compare", {"fileIds": [ids[0]]}).status_code, 400)
        self.assertEqual(self.post("/compare", {"fileIds": [ids[0], 99999]}).status_code, 404)

    def test_request_review_and_resolve(self):
        ids = [demo("payroll-acme-v2").id, demo("payroll-acme-faq").id]
        resp = self.post("/request-review", {
            "title": "Meal vouchers again", "customer": "Acme Retail", "country": "Belgium",
            "topic": "payroll", "evidenceFileIds": ids,
        })
        self.assertEqual(resp.status_code, 200)
        case = resp.json()
        self.assertEqual(case["reviewStatus"], "requested")
        self.assertEqual(case["assignedExpert"]["email"], "sofie.peeters@sdworx.example")
        self.assertEqual(len(case["unresolvedConflicts"]), 1)
        self.assertEqual(self.post("/request-review", {"evidenceFileIds": ids}).status_code, 400)
        self.assertEqual(self.post("/request-review", {"title": "x", "evidenceFileIds": [99999]}).status_code, 400)

        self.assertEqual(self.post("/resolve", {"caseId": case["id"], "resolution": " "}).status_code, 400)
        resolved = self.post("/resolve", {"caseId": case["id"], "resolution": "v2 (8 EUR) applies; FAQ to be fixed."}).json()
        self.assertEqual(resolved["status"], "resolved")
        self.assertEqual(resolved["unresolvedConflicts"], [])
        self.assertEqual(Conflict.objects.filter(resolved=False).count(), 0)

    def test_url_variants(self):
        for url in ["/", "/cases", "/cases/", "/api/cases", "/api/cases/", "/api/"]:
            self.assertEqual(self.client.get(url).status_code, 200, url)
        self.assertEqual(self.post("/api/search/", {"query": "payroll"}).status_code, 200)

    def test_experts_endpoint(self):
        experts = self.client.get("/experts?topic=termination&country=BE").json()
        self.assertEqual(experts[0]["email"], "marc.dubois@sdworx.example")
        self.assertTrue(experts[0]["reasons"])
        self.assertEqual(len(self.client.get("/experts").json()), 3)


class FakeDrive:
    """Stands in for DriveClient so sync can be tested without Google."""

    def __init__(self, items, texts):
        self.items, self.texts, self.extracted = items, texts, []

    def authenticate(self):
        pass

    def list_shared_drives(self):
        return {"sd1": "HR Knowledge"}

    def list_all_files(self):
        return iter(self.items)

    def get_permissions(self, file_id):
        return [{"type": "domain", "role": "reader", "domain": "sdworx.example"}]

    def extract_text(self, item):
        self.extracted.append(item["id"])
        return self.texts.get(item["id"], "")


@override_settings(OPENAI_API_KEY="")
class SyncTests(TestCase):
    ITEMS = [
        {"id": "f1", "name": "Belgium", "mimeType": "application/vnd.google-apps.folder",
         "parents": ["sd1"], "driveId": "sd1", "modifiedTime": "2026-01-01T10:00:00.000Z"},
        {"id": "d1", "name": "BE Leave Policy", "mimeType": "application/vnd.google-apps.document",
         "parents": ["f1"], "driveId": "sd1", "modifiedTime": "2026-02-01T10:00:00.000Z",
         "lastModifyingUser": {"displayName": "Sofie", "emailAddress": "sofie@sdworx.example"}},
        {"id": "d2", "name": "Notes.txt", "mimeType": "text/plain", "size": "20", "parents": ["root"],
         "modifiedTime": "2026-02-02T10:00:00.000Z", "owners": [{"displayName": "Me", "emailAddress": "me@x.org"}],
         "permissions": [{"type": "user", "role": "owner", "emailAddress": "me@x.org"}]},
    ]
    TEXTS = {"d1": "Status: Approved\nEffective date: 2026-01-01\nAnnual leave days: 20", "d2": "hello"}

    def test_sync(self):
        drive = FakeDrive(self.ITEMS, self.TEXTS)
        stats = sync_drive(drive)
        self.assertEqual((stats["files"], stats["changed"], stats["removed"]), (3, 2, 0))
        d1 = DriveFile.objects.get(drive_id="d1")
        self.assertEqual(d1.path, "HR Knowledge / Belgium")
        self.assertEqual(d1.shared_drive_name, "HR Knowledge")
        self.assertEqual(d1.owners[0]["role"], "lastModifier")
        self.assertEqual(d1.permissions[0]["domain"], "sdworx.example")  # fetched separately
        self.assertEqual((d1.country, d1.topic, d1.status), ("BE", "leave", "approved"))
        d2 = DriveFile.objects.get(drive_id="d2")
        self.assertEqual(d2.path, "My Drive")
        self.assertEqual(d2.permissions[0]["email"], "me@x.org")
        self.assertTrue(DriveFile.objects.get(drive_id="f1").is_folder)

        # Unchanged files are not downloaded again; missing files are marked trashed.
        drive2 = FakeDrive(self.ITEMS[:2], self.TEXTS)
        stats = sync_drive(drive2)
        self.assertEqual((stats["changed"], stats["removed"]), (0, 1))
        self.assertEqual(drive2.extracted, [])
        self.assertTrue(DriveFile.objects.get(drive_id="d2").trashed)
