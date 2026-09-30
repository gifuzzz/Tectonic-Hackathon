# SD Worx Knowledge Backend (Django)

Google Drive → sync → text + metadata → enrichment → search index → trust rules → conflict detection → JSON API.

Runs out of the box on SQLite with rule-based enrichment and keyword search.
Add `OPENAI_API_KEY` for LLM enrichment + semantic search, and `DATABASE_URL` for PostgreSQL.

## Run

```bash
cd archit/backend
uv sync
cp .env.example .env              # optional
uv run python manage.py migrate
uv run python manage.py seed_demo  # mock data, no Google needed (--reset to recreate)
uv run python manage.py runserver  # http://localhost:8000
uv run python manage.py test knowledge
```

Real Google Drive data (needs `archit/credentials.json`, a Desktop app OAuth client; opens a browser the first time):

```bash
uv run python manage.py sync_drive          # only new/changed files are re-ingested
uv run python manage.py sync_drive --full   # re-ingest everything
uv run python manage.py reindex             # re-run enrichment/conflicts without calling Drive
```

Admin UI (customers, experts, files, cases): `uv run python manage.py createsuperuser`, then http://localhost:8000/admin/.
Add your **customers** and **experts** there: customers are what gets detected in documents, and a document
owner is only "verified" if they exist as an active expert.

## API

All JSON. POST bodies are JSON objects. Errors return `{"error": "..."}` with 400/404/405.
`customer` accepts an id, name or alias. `country` accepts `BE` or `Belgium`.

| Endpoint | Input | Returns |
|---|---|---|
| `GET /cases` | `?status=open\|in_review\|resolved` | case summaries |
| `GET /cases/:id` | | case + unresolved conflicts between its evidence |
| `GET /cases/:id/evidence` | | evidence files, each with `trust` in the case's context, + conflicts |
| `GET /files/:id` | `?country=&customer=` (trust context) | metadata, permissions, content, claims, supersedes/supersededBy, conflicts, trust |
| `POST /search` | `{query, country?, customer?, topic?, userEmail?, limit?}` | ranked results with `snippet`, `relevance`, `trust`; conflicts among them. Missing country/customer/topic are detected from the query. `userEmail` hides files that user can't open in Drive. |
| `POST /compare` | `{fileIds: [2..10 ids]}` | pairwise checks, opposing claims, `isConflict`, reasons |
| `POST /request-review` | `{caseId}` or `{title, question?, customer?, country?, topic?}`, plus `evidenceFileIds?`, `expertId?` | case (creates it if needed, auto-assigns best expert) |
| `POST /resolve` | `{caseId, resolution, conflictIds?}` | resolved case (resolves all its conflicts unless `conflictIds` given) |
| `GET /experts` | `?customer=&country=&topic=&fileId=` | experts ranked by score with reasons |

Trust result (per file, per context):

```json
{
  "contextMatch": "strong | partial | weak | mismatch | unknown",
  "authority": "official | in_review | unverified | draft | archived",
  "recency": "current | upcoming | stale | expired | unknown",
  "ownerVerified": true,
  "superseded": false,
  "supersededBy": null,
  "conflicts": 1,
  "customerSpecific": true,
  "score": 0.8,
  "verdict": "trusted | use_with_caution | do_not_use",
  "checks": [{"rule": "correct_country", "passed": true, "detail": "..."}]
}
```

## Where things live (`knowledge/`)

| Module | Job |
|---|---|
| `drive_client.py`, `extract.py` | Drive connector: files, folders, owners, dates, permissions, shared drives, content (Docs/Sheets/Slides/PDF/DOCX/text) |
| `enrich.py`, `llm.py` | Detect country, customer, topic, owner, effective/expiry date, document type, status, claims (rules, or OpenAI) |
| `ingestion.py` | Sync + change detection, chunks + embeddings, "supersedes" links |
| `search.py` | Keyword + embedding retrieval, ranked with trust |
| `trust.py` | Trust rules |
| `conflicts.py` | Conflict detection (claims from LLM/rules, rules decide if it matters) |
| `cases.py`, `experts.py` | Case workflow and expert lookup |
| `views.py`, `urls.py`, `serializers.py` | API |

Relationships are relational: `DriveFile.customer` (belongs to customer), `.country` (applies to Belgium),
`.supersedes`, `.owner` (expert owns file), `CaseEvidence` (case references file), `Conflict`.

MVP limits: no API authentication; embeddings are compared in Python (fine for thousands of files, move to
pgvector beyond that); sync is a command you run (or schedule), not a live Drive webhook.
