"""Retrieval: semantic (embeddings) + keyword scoring over chunks, then ranked with the trust engine.

Embeddings are compared in Python, which is fine for thousands of files. For much larger corpora,
move DocumentChunk.embedding to a pgvector column.
"""
import math
import re
from collections import defaultdict

from . import llm
from .enrich import detect_country, detect_customer, detect_topic
from .models import Conflict, Customer, DocumentChunk, DriveFile
from .trust import Context, evaluate

STOPWORDS = {
    "the", "and", "for", "are", "with", "what", "which", "how", "does", "who", "that", "this", "from",
    "about", "into", "our", "your", "their", "can", "should", "when", "where", "is", "per", "any", "all",
}
MIN_SEMANTIC = 0.25


def tokenize(text):
    return {t for t in re.findall(r"[a-z0-9à-ÿ]+", text.lower()) if len(t) > 2 and t not in STOPWORDS}


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def build_context(query, country="", customer=None, topic=""):
    """Explicit filters win; otherwise detect country, customer and topic from the question."""
    return Context(
        country=country or detect_country(query, "", ""),
        customer=customer or detect_customer(query, "", "", list(Customer.objects.all())),
        topic=topic or detect_topic(query, "", ""),
    )


def can_access(f, email):
    if not email or not f.permissions:
        return True  # unknown permissions (e.g. demo data) are not filtered
    email = email.lower()
    domain = email.split("@")[-1]
    for p in f.permissions:
        if p.get("type") == "anyone":
            return True
        if p.get("type") in ("user", "group") and p.get("email", "").lower() == email:
            return True
        if p.get("type") == "domain" and p.get("domain", "").lower() == domain:
            return True
    return any(o.get("email", "").lower() == email for o in f.owners)


def search(query, ctx, user_email="", limit=10):
    """Return (results, conflicts): the best files for the query, each with relevance, snippet and trust."""
    q_tokens = tokenize(query)
    chunks = DocumentChunk.objects.filter(file__trashed=False, file__is_folder=False)
    use_semantic = llm.enabled() and chunks.filter(embedding__isnull=False).exists()
    q_vector = llm.embed([query])[0] if use_semantic else None

    best = defaultdict(lambda: {"keyword": 0.0, "semantic": 0.0, "snippet": ""})
    for chunk in chunks.only("file_id", "text", "embedding").iterator():
        keyword = len(q_tokens & tokenize(chunk.text)) / len(q_tokens) if q_tokens else 0.0
        semantic = cosine(q_vector, chunk.embedding) if q_vector and chunk.embedding else 0.0
        entry = best[chunk.file_id]
        if keyword + semantic > entry["keyword"] + entry["semantic"]:
            entry["snippet"] = chunk.text
        entry["keyword"] = max(entry["keyword"], keyword)
        entry["semantic"] = max(entry["semantic"], semantic)

    scored = []
    for file_id, entry in best.items():
        if use_semantic:
            relevance = 0.7 * entry["semantic"] + 0.3 * entry["keyword"]
            if entry["keyword"] == 0 and entry["semantic"] < MIN_SEMANTIC:
                continue
        else:
            relevance = entry["keyword"]
            if relevance == 0:
                continue
        scored.append((file_id, relevance, entry["snippet"]))
    scored.sort(key=lambda s: -s[1])

    files = DriveFile.objects.select_related("customer", "owner").in_bulk([s[0] for s in scored[: limit * 5]])
    results = []
    for file_id, relevance, snippet in scored[: limit * 5]:
        f = files.get(file_id)
        if f is None or not can_access(f, user_email):
            continue
        trust = evaluate(f, ctx)
        results.append({
            "file": f,
            "relevance": round(relevance, 3),
            "rank": round(relevance * (0.5 + 0.5 * trust["score"]), 3),
            "snippet": _snippet(snippet, q_tokens),
            "trust": trust,
        })
    results.sort(key=lambda r: (-r["rank"], -r["trust"]["score"], r["file"].id))
    results = results[:limit]

    ids = [r["file"].id for r in results]
    conflicts = Conflict.objects.filter(resolved=False, file_a_id__in=ids, file_b_id__in=ids).select_related(
        "file_a", "file_b"
    )
    return results, list(conflicts)


def _snippet(text, q_tokens, width=300):
    text = text.split("\n", 2)[-1]  # drop the "name / path" header
    lower = text.lower()
    positions = [lower.find(t) for t in q_tokens if lower.find(t) >= 0]
    start = max(0, min(positions) - 80) if positions else 0
    return ("…" if start else "") + text[start : start + width] + ("…" if start + width < len(text) else "")
