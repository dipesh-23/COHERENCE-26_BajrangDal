"""
apply_supabase_schema.py
Applies the Supabase SQL schema programmatically via the Supabase Management API.
The Management API requires a Supabase ACCESS TOKEN (not service_role key).
If you don't have one, just run supabase_schema.sql in the SQL Editor manually.

Runs from: backend/scripts/
"""
import os, sys, pathlib, httpx, json
from dotenv import load_dotenv

# Load from parent .env
load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SERVICE_KEY  = os.getenv("SUPABASE_SERVICE_KEY", "")

project_ref = SUPABASE_URL.replace("https://", "").split(".")[0]

sql_path = pathlib.Path(__file__).parent.parent / "supabase_schema.sql"
sql = sql_path.read_text(encoding="utf-8")

print(f"[apply_schema] Project: {project_ref}")
print(f"[apply_schema] SQL file: {sql_path}")

# ── Attempt 1: Supabase pg endpoint (service_role) ────────────────────────────
resp = httpx.post(
    f"{SUPABASE_URL}/pg/query",
    headers={
        "apikey":         SERVICE_KEY,
        "Authorization":  f"Bearer {SERVICE_KEY}",
        "Content-Type":   "application/json",
    },
    json={"query": sql},
    timeout=30,
)

if resp.status_code in (200, 201):
    print("✅  Schema applied via /pg/query endpoint!")
    sys.exit(0)

print(f"[/pg/query] {resp.status_code}: {resp.text[:200]}")
print()
print("──────────────────────────────────────────────────────────────────────────")
print("The schema could not be applied automatically.")
print("Please run it manually (takes ~30 seconds):")
print()
print(f"  1. Open: https://supabase.com/dashboard/project/{project_ref}/sql")
print(f"  2. Click 'New query'")
print(f"  3. Paste the contents of:  backend/supabase_schema.sql")
print(f"  4. Click 'Run'")
print("──────────────────────────────────────────────────────────────────────────")
sys.exit(1)
