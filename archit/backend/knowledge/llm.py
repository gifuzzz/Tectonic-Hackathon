"""Thin OpenAI wrapper. Everything works without it; set OPENAI_API_KEY to enable."""
import json

from django.conf import settings

_client = None


def enabled():
    return bool(settings.OPENAI_API_KEY)


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def complete_json(system, user):
    """Ask the model for a JSON object and return it as a dict."""
    resp = _get_client().chat.completions.create(
        model=settings.OPENAI_MODEL,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    data = json.loads(resp.choices[0].message.content or "{}")
    return data if isinstance(data, dict) else {}


def embed(texts):
    """Return one embedding (list of floats) per text."""
    vectors = []
    for i in range(0, len(texts), 100):
        resp = _get_client().embeddings.create(model=settings.OPENAI_EMBEDDING_MODEL, input=texts[i : i + 100])
        vectors += [d.embedding for d in resp.data]
    return vectors
