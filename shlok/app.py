"""FastAPI app: JSON API + static dashboard for the Drive storage layer.

Run with:  uv run python -m shlok.app
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db, ingest, store
from .history import get_history, meta_at


def fail(status: int, code: str, message: str):
    """Raise an HTTPException shaped like {"error": {...}}."""
    raise HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.get_conn()
    ingest.ensure_seeded()
    yield


app = FastAPI(title="Drive Dashboard API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def _http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        return JSONResponse(status_code=exc.status_code, content=detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "error", "message": str(detail)}},
    )


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "server_error", "message": str(exc)}},
    )


# --------------------------------------------------------------------------- #
# Root (API index; the UI is built by the frontend team)
# --------------------------------------------------------------------------- #
@app.get("/", include_in_schema=False)
def index():
    return {
        "name": "Drive Dashboard API",
        "docs": "/docs",
        "endpoints": [
            "GET  /api/health",
            "GET  /api/graph",
            "GET  /api/nodes/{id}",
            "PATCH /api/nodes/{id}/meta",
            "GET  /api/nodes/{id}/history",
            "GET  /api/nodes/{id}/meta-at?timestamp=",
            "GET  /api/search",
            "POST /api/ingest",
            "POST /api/sync",
        ],
    }


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    nodes, edges = store.count()
    return {"status": "ok", "nodes": nodes, "edges": edges}


@app.get("/api/graph")
def graph():
    return store.get_graph()


@app.get("/api/nodes/{node_id}")
def node_detail(node_id: str):
    data = store.get_node(node_id)
    if data is None:
        fail(404, "not_found", "Unknown node id")
    return data


@app.patch("/api/nodes/{node_id}/meta")
def patch_node_meta(node_id: str, payload: dict | None = Body(default=None)):
    payload = payload or {}
    if not isinstance(payload, dict):
        fail(400, "bad_request", "Body must be a JSON object")
    updated = store.patch_meta(node_id, payload, changed_by=payload.get("changed_by"))
    if updated is None:
        fail(404, "not_found", "Unknown node id")
    return updated


@app.get("/api/nodes/{node_id}/history")
def node_history(node_id: str, field: str | None = Query(default=None)):
    if store.get_node(node_id) is None:
        fail(404, "not_found", "Unknown node id")
    return {"node_id": node_id, "history": get_history(node_id, field)}


@app.get("/api/nodes/{node_id}/meta-at")
def node_meta_at(node_id: str, timestamp: str = Query(...)):
    if store.get_node(node_id) is None:
        fail(404, "not_found", "Unknown node id")
    return {"node_id": node_id, "timestamp": timestamp, "meta": meta_at(node_id, timestamp)}


@app.get("/api/search")
def search(
    q: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    category: str | None = Query(default=None),
    type: str | None = Query(default=None),
):
    nodes = store.search(q=q, tag=tag, category=category, type=type)
    return {"count": len(nodes), "nodes": nodes}


@app.post("/api/ingest")
def ingest_endpoint(payload: dict | None = Body(default=None)):
    payload = payload or {}
    try:
        return ingest.ingest_graph(payload, source=payload.get("source"))
    except ValueError as exc:
        fail(400, "bad_request", str(exc))


@app.post("/api/sync")
def sync_endpoint():
    return ingest.sync_from_source()


def main():
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
