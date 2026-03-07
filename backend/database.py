"""
database.py — Supabase client singleton for the Clinical Trial Matching Engine.

Usage (anywhere in the backend):
    from database import get_db
    db = get_db()
    db.table("patients").upsert({...}).execute()

The client is a singleton — created once on first call, reused after that.
All methods return Supabase PostgREST APIResponse objects.
"""
from __future__ import annotations

import logging
import sys
from functools import lru_cache
from typing import Any

log = logging.getLogger(__name__)

# ── Supabase import guard ──────────────────────────────────────────────────────
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    log.warning(
        "supabase-py not installed. Database persistence disabled.\n"
        "Run: pip install supabase"
    )


# ── Minimal no-op client for offline / dev mode ────────────────────────────────
class _NoOpTable:
    """Returned by _NoOpClient.table() — silently swallows all DB calls."""
    def __init__(self, name: str):
        self._name = name

    def upsert(self, *a, **kw):   return self
    def insert(self, *a, **kw):   return self
    def select(self, *a, **kw):   return self
    def update(self, *a, **kw):   return self
    def delete(self, *a, **kw):   return self
    def eq(self, *a, **kw):       return self
    def order(self, *a, **kw):    return self
    def limit(self, *a, **kw):    return self
    def execute(self):
        log.debug(f"[NoOpDB] {self._name}: execute() called (Supabase not configured)")
        return type("R", (), {"data": [], "error": None})()


class _NoOpClient:
    def table(self, name: str) -> _NoOpTable:
        return _NoOpTable(name)


# ── Supabase client singleton ──────────────────────────────────────────────────
@lru_cache(maxsize=1)
def get_db() -> "Client | _NoOpClient":
    """
    Return the Supabase client.
    Falls back to _NoOpClient if:
      - supabase-py is not installed
      - SUPABASE_URL / SUPABASE_SERVICE_KEY are not set
    This lets the app run in pure in-memory demo mode without crashing.
    """
    from config import get_settings
    settings = get_settings()

    if not SUPABASE_AVAILABLE:
        log.warning("Supabase library missing — using in-memory NoOp database.")
        return _NoOpClient()

    if not settings.supabase_configured:
        log.warning(
            "SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env — "
            "running in in-memory demo mode (no persistence)."
        )
        return _NoOpClient()

    try:
        client: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_KEY,
        )
        log.info(f"Supabase client connected → {settings.SUPABASE_URL}")
        return client
    except Exception as exc:
        log.error(f"Failed to initialise Supabase client: {exc}")
        return _NoOpClient()


# ── Table name constants ───────────────────────────────────────────────────────
class Tables:
    PATIENTS       = "patients"
    TRIALS         = "trials"
    MATCH_RESULTS  = "match_results"
    AUDIT_LOG      = "audit_log"


# ── Helper: safe upsert that never throws ─────────────────────────────────────
# ── Helper: safe upsert that never throws ─────────────────────────────────────
def safe_upsert(table: str, record: dict[str, Any]) -> bool:
    """Insert/update a record. Returns True on success, False on error."""
    try:
        db = get_db()
        db.table(table).upsert(record).execute()
        return True
    except Exception as exc:
        log.error(f"DB upsert exception [{table}]: {exc}")
        return False


def safe_insert(table: str, record: dict[str, Any]) -> bool:
    """Insert a record. Returns True on success, False on error.
    Silently swallows duplicate-key violations (Postgres code 23505)."""
    try:
        db = get_db()
        db.table(table).insert(record).execute()
        return True
    except Exception as exc:
        exc_str = str(exc)
        # Suppress duplicate key noise — happens when re-running a match for the same patient
        if "23505" in exc_str or "duplicate key" in exc_str.lower() or "already exists" in exc_str.lower():
            log.debug(f"[{table}] duplicate key skipped (expected on re-match)")
        else:
            log.error(f"DB insert exception [{table}]: {exc}")
        return False


def safe_select(table: str, filters: dict[str, Any] | None = None) -> list[dict]:
    """Select records with optional equality filters. Returns list or []."""
    try:
        db = get_db()
        q = db.table(table).select("*")
        for col, val in (filters or {}).items():
            q = q.eq(col, val)
        resp = q.execute()
        return resp.data or []
    except Exception as exc:
        log.error(f"DB select exception [{table}]: {exc}")
        return []
