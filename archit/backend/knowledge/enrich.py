"""Knowledge enrichment: detect country, customer, topic, owner, dates, document type, status and claims.

Rules always run. When OPENAI_API_KEY is set, the LLM's answers replace the rule-based ones
wherever they are valid.
"""
import logging
import re
from datetime import date

from django.utils import timezone

from . import llm
from .models import Customer, DriveFile, Expert

logger = logging.getLogger(__name__)

SCAN_CHARS = 50_000  # only scan the start of long documents

COUNTRY_NAMES = {
    "BE": "Belgium", "NL": "Netherlands", "FR": "France", "DE": "Germany", "LU": "Luxembourg",
    "GB": "United Kingdom", "IE": "Ireland", "ES": "Spain", "IT": "Italy", "AT": "Austria",
    "CH": "Switzerland", "PL": "Poland", "PT": "Portugal",
}
COUNTRY_TERMS = {
    "BE": ["belgium", "belgian", "belgique", "belgië", "belgie"],
    "NL": ["netherlands", "nederland", "holland"],
    "FR": ["france"],
    "DE": ["germany", "deutschland"],
    "LU": ["luxembourg"],
    "GB": ["united kingdom", "great britain", "england"],
    "IE": ["ireland"],
    "ES": ["spain", "españa"],
    "IT": ["italy", "italia"],
    "AT": ["austria", "österreich"],
    "CH": ["switzerland", "schweiz", "suisse"],
    "PL": ["poland", "polska"],
    "PT": ["portugal"],
}
# Upper-case codes counted in titles and folder names only ("IT" is left out: it usually means the department).
COUNTRY_CODES = {"BE": "BE", "NL": "NL", "FR": "FR", "DE": "DE", "LU": "LU", "GB": "GB", "UK": "GB",
                 "IE": "IE", "ES": "ES", "AT": "AT", "CH": "CH", "PL": "PL", "PT": "PT"}

TOPICS = {
    "payroll": ["payroll", "salary", "salaries", "wage", "wages", "payslip", "payslips"],
    "social_security": ["social security", "social contributions", "rsz", "onss"],
    "tax": ["tax", "taxes", "withholding", "fiscal"],
    "leave": ["leave", "holiday", "holidays", "vacation", "absence", "sick"],
    "benefits": ["benefit", "benefits", "meal voucher", "meal vouchers", "company car", "insurance", "pension"],
    "termination": ["termination", "dismissal", "notice period", "resignation", "severance"],
    "onboarding": ["onboarding", "new hire", "new hires", "employment contract"],
    "time_registration": ["time registration", "timesheet", "timesheets", "overtime", "working hours"],
    "expenses": ["expense", "expenses", "reimbursement", "mileage", "allowance"],
    "compliance": ["gdpr", "compliance", "audit", "privacy"],
}

DOCUMENT_TYPES = [
    ("policy", ["policy", "policies"]),
    ("procedure", ["procedure", "process", "how to", "work instruction"]),
    ("contract", ["contract", "agreement", "sla"]),
    ("guideline", ["guideline", "guidelines", "guide"]),
    ("faq", ["faq", "frequently asked questions"]),
    ("template", ["template"]),
    ("memo", ["memo", "announcement"]),
    ("report", ["report", "minutes", "analysis"]),
]

STATUS_PATTERNS = [
    ("archived", r"\b(obsolete|deprecated|archived|superseded|no longer valid)\b"),
    ("draft", r"\b(draft|wip|work in progress)\b"),
    ("in_review", r"\b(in review|under review|for review|pending approval)\b"),
    ("approved", r"\b(approved|validated)\b"),
]

MONTHS = {}
for _i, _m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august",
                         "september", "october", "november", "december"], start=1):
    MONTHS[_m] = MONTHS[_m[:3]] = _i

DATE_PATTERN = (
    r"(\d{4}-\d{1,2}-\d{1,2}"
    r"|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}"
    r"|\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{4}"
    r"|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})"
)
EFFECTIVE_RX = re.compile(
    r"\b(?:effective|valid from|applicable from|in force from|in effect from|start date)\b"
    r"(?:\s+(?:date|from|as of|since|on))?\s*[:\-]?\s*" + DATE_PATTERN,
    re.IGNORECASE,
)
EXPIRY_RX = re.compile(
    r"\b(?:valid until|valid through|expires?(?: on)?|expiry date|expiration date|end date)\b\s*[:\-]?\s*"
    + DATE_PATTERN,
    re.IGNORECASE,
)
STATUS_LINE_RX = re.compile(r"^\s*status\s*[:\-]\s*(.+)$", re.IGNORECASE | re.MULTILINE)
OWNER_RX = re.compile(
    r"^\s*(?:document owner|content owner|owner)\s*[:\-].*?([\w.+-]+@[\w-]+(?:\.[\w-]+)+)",
    re.IGNORECASE | re.MULTILINE,
)
SUPERSEDES_RX = re.compile(r"^\s*(?:supersedes|replaces)\s*[:\-]?\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)
CLAIM_RX = re.compile(r"^\s*[-*•]?\s*([A-Za-z][A-Za-z0-9 /()'&,-]{2,80}?)\s*:\s*(\S.{0,200}?)\s*$", re.MULTILINE)
MAX_CLAIMS = 30


def _term_rx(term):
    return re.compile(r"(?<!\w)" + re.escape(term) + r"(?!\w)", re.IGNORECASE)


def _code_rx(code):
    return re.compile(r"(?<![A-Za-z])" + code + r"(?![A-Za-z])")  # case-sensitive on purpose


_COUNTRY_RX = {code: [_term_rx(t) for t in terms] for code, terms in COUNTRY_TERMS.items()}
_CODE_RX = {code: _code_rx(code) for code in COUNTRY_CODES}
_TOPIC_RX = {topic: [_term_rx(t) for t in terms] for topic, terms in TOPICS.items()}
_DOCTYPE_RX = [(doc_type, [_term_rx(t) for t in terms]) for doc_type, terms in DOCUMENT_TYPES]
STOP_CLAIM_SUBJECTS = {
    "customer", "country", "status", "owner", "document_owner", "content_owner", "effective_date",
    "effective_from", "valid_from", "valid_until", "expiry_date", "version", "title", "author", "date",
    "last_updated", "supersedes", "replaces", "topic", "document_type", "type", "https", "http",
}


def normalize_subject(label):
    return re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")


def _count(regexes, text):
    return sum(len(rx.findall(text)) for rx in regexes)


def _best(scores):
    best = max(scores, key=scores.get, default=None)
    return best if best is not None and scores[best] > 0 else None


def detect_country(name, path, text):
    """ISO code of the country the document is about, or ""; title and folders weigh 5x the body."""
    head, body = f"{name} {path}", text[:SCAN_CHARS]
    scores = {code: 5 * _count(rxs, head) + _count(rxs, body) for code, rxs in _COUNTRY_RX.items()}
    for token, code in COUNTRY_CODES.items():
        scores[code] += 5 * len(_CODE_RX[token].findall(head))
    return _best(scores) or ""


def detect_customer(name, path, text, customers):
    head, body = f"{name} {path}", text[:SCAN_CHARS]
    scores = {}
    for customer in customers:
        rxs = [_term_rx(n) for n in [customer.name, *customer.aliases] if n]
        scores[customer] = 5 * _count(rxs, head) + _count(rxs, body)
    return _best(scores)


def detect_topic(name, path, text):
    head, body = f"{name} {path}", text[:SCAN_CHARS]
    scores = {topic: 5 * _count(rxs, head) + _count(rxs, body) for topic, rxs in _TOPIC_RX.items()}
    return _best(scores) or ""


def detect_document_type(name, text):
    for source in (name, text[:500]):
        for doc_type, rxs in _DOCTYPE_RX:
            if any(rx.search(source) for rx in rxs):
                return doc_type
    return DriveFile.DocumentType.OTHER


def detect_status(name, text):
    """An explicit "Status: ..." line wins over words in the title."""
    line = STATUS_LINE_RX.search(text[:3000])
    for source in ([line.group(1)] if line else []) + [name]:
        for status, pattern in STATUS_PATTERNS:
            if re.search(pattern, source, re.IGNORECASE):
                return status
    return DriveFile.Status.UNKNOWN


def parse_date(value):
    """Parse ISO, day-first numeric (European) and English month-name dates. Returns None if invalid."""
    s = value.strip()
    try:
        if m := re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", s):
            return date(int(m[1]), int(m[2]), int(m[3]))
        if m := re.fullmatch(r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})", s):
            return date(int(m[3]), int(m[2]), int(m[1]))
        if m := re.fullmatch(r"(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})", s):
            month = MONTHS.get(m[2].lower()) or MONTHS.get(m[2].lower()[:3])
            return date(int(m[3]), month, int(m[1])) if month else None
        if m := re.fullmatch(r"([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})", s):
            month = MONTHS.get(m[1].lower()) or MONTHS.get(m[1].lower()[:3])
            return date(int(m[3]), month, int(m[2])) if month else None
    except ValueError:
        return None
    return None


def _first_date(rx, text):
    for m in rx.finditer(text[:SCAN_CHARS]):
        parsed = parse_date(m.group(1))
        if parsed:
            return parsed
    return None


def detect_effective_date(text):
    return _first_date(EFFECTIVE_RX, text)


def detect_expiry_date(text):
    return _first_date(EXPIRY_RX, text)


def detect_owner_email(text, owners):
    """An "Owner: someone@..." line in the document wins over the Drive owner."""
    m = OWNER_RX.search(text[:5000])
    if m:
        return m.group(1).lower()
    emails = [o.get("email", "") for o in owners if o.get("email")]
    return emails[0].lower() if emails else ""


def extract_claims(text):
    """Rule-based claims: "Label: value" lines, e.g. "Notice period: 30 days"."""
    claims, seen = [], set()
    for m in CLAIM_RX.finditer(text[:SCAN_CHARS]):
        label, value = m.group(1).strip(), m.group(2).strip()
        subject = normalize_subject(label)
        if not subject or subject in STOP_CLAIM_SUBJECTS or subject in seen or value.startswith("//"):
            continue
        seen.add(subject)
        claims.append({"subject": subject, "value": value, "text": m.group(0).strip()})
        if len(claims) >= MAX_CLAIMS:
            break
    return claims


def detect_supersedes_hint(text):
    m = SUPERSEDES_RX.search(text[:5000])
    return m.group(1)[:500] if m else ""


def base_name(name):
    """Title without versions, dates and status words: "Policy v2 (final).docx" -> "policy"."""
    s = name.lower()
    s = re.sub(r"\.(docx?|pdf|txt|xlsx?|pptx?|csv|md)$", "", s)
    s = re.sub(r"^copy of\s+", "", s)
    s = re.sub(r"\b(v|version|rev)\s*\.?\s*\d+(\.\d+)*\b", " ", s)
    s = re.sub(r"\b(19|20)\d{2}([-_./]\d{1,2}){0,2}\b", " ", s)
    s = re.sub(r"\b(final|draft|new|old|latest|updated)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def _summary(text):
    return " ".join(text.split())[:300]


def rule_based(f, customers):
    text = f.content_text or ""
    return {
        "country": detect_country(f.name, f.path, text),
        "customer": detect_customer(f.name, f.path, text, customers),
        "topic": detect_topic(f.name, f.path, text),
        "document_type": detect_document_type(f.name, text),
        "status": detect_status(f.name, text),
        "effective_date": detect_effective_date(text),
        "expiry_date": detect_expiry_date(text),
        "owner_email": detect_owner_email(text, f.owners),
        "summary": _summary(text),
        "claims": extract_claims(text),
        "supersedes_hint": detect_supersedes_hint(text),
    }


LLM_SYSTEM = (
    "You extract metadata from internal HR, payroll and legal documents at SD Worx, a payroll and HR "
    "services company. Reply with a JSON object with exactly these keys:\n"
    "country: ISO 3166-1 alpha-2 code of the country the document applies to, or null if not country-specific\n"
    "customer: name of the client company the document is specific to, or null if it is generic\n"
    "topic: one of TOPICS, or null\n"
    "document_type: one of DOCTYPES\n"
    "status: one of STATUSES\n"
    "effective_date: YYYY-MM-DD or null\n"
    "expiry_date: YYYY-MM-DD or null\n"
    "summary: at most two sentences\n"
    'claims: up to 15 rules or values the document states, each {"subject": a short generic snake_case key '
    'such as notice_period or meal_voucher_value, "value": the stated value, "text": the sentence it comes from}\n'
    "supersedes: title of an older document this one says it replaces, or null\n"
    "Known customers: CUSTOMERS. Use the exact known name when one matches."
)


def _match_or_create_customer(name, customers):
    for customer in customers:
        if name.lower() in [n.lower() for n in [customer.name, *customer.aliases]]:
            return customer
    customer = Customer.objects.filter(name__iexact=name).first() or Customer.objects.create(name=name[:200])
    customers.append(customer)
    return customer


def llm_based(f, customers):
    """Ask the LLM, and keep only the answers that are valid."""
    system = (
        LLM_SYSTEM.replace("TOPICS", ", ".join(TOPICS))
        .replace("DOCTYPES", ", ".join(DriveFile.DocumentType.values))
        .replace("STATUSES", ", ".join(DriveFile.Status.values))
        .replace("CUSTOMERS", ", ".join(c.name for c in customers) or "none")
    )
    data = llm.complete_json(system, f"Title: {f.name}\nFolder: {f.path}\n\n{f.content_text[:12000]}")
    out = {}
    country = str(data.get("country") or "").upper()
    if country in COUNTRY_NAMES:
        out["country"] = country
    if isinstance(data.get("customer"), str) and data["customer"].strip():
        out["customer"] = _match_or_create_customer(data["customer"].strip(), customers)
    if data.get("topic") in TOPICS:
        out["topic"] = data["topic"]
    if data.get("document_type") in DriveFile.DocumentType.values:
        out["document_type"] = data["document_type"]
    if data.get("status") in DriveFile.Status.values:
        out["status"] = data["status"]
    for key in ("effective_date", "expiry_date"):
        parsed = parse_date(str(data.get(key) or ""))
        if parsed:
            out[key] = parsed
    if isinstance(data.get("summary"), str) and data["summary"].strip():
        out["summary"] = data["summary"].strip()[:1000]
    claims = []
    for c in data.get("claims") or []:
        if isinstance(c, dict) and isinstance(c.get("subject"), str) and isinstance(c.get("value"), str):
            subject = normalize_subject(c["subject"])
            if subject:
                claims.append({"subject": subject, "value": c["value"][:300], "text": str(c.get("text", ""))[:500]})
    if claims:
        out["claims"] = claims[:MAX_CLAIMS]
    if isinstance(data.get("supersedes"), str) and data["supersedes"].strip():
        out["supersedes_hint"] = data["supersedes"].strip()[:500]
    return out


def enrich_file(f, customers=None):
    """Fill the enrichment fields of a DriveFile (does not save)."""
    customers = list(Customer.objects.all()) if customers is None else customers
    result = rule_based(f, customers)
    source = "rules"
    if llm.enabled() and f.content_text.strip():
        try:
            result.update(llm_based(f, customers))
            source = "llm"
        except Exception:
            logger.exception("LLM enrichment failed for %s; keeping rule-based results", f.name)

    for key, value in result.items():
        setattr(f, key, value)
    f.owner = Expert.objects.filter(email__iexact=f.owner_email).first() if f.owner_email else None
    f.enrichment_source = source
    f.enriched_at = timezone.now()
    return f
