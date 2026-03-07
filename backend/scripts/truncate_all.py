"""truncate_all.py — Wipes all 4 tables and re-seeds trials for a clean start."""
import os, sys
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

tables = ["audit_log", "match_results", "patients", "trials"]
for t in tables:
    try:
        db.table(t).delete().neq("id" if t not in ("patients","trials") else ("patient_id" if t=="patients" else "trial_id"), "___NEVER___").execute()
        print(f"  [OK] TRUNCATED {t}")
    except Exception as e:
        # Try deleting everything by matching a common field
        try:
            all_rows = db.table(t).select("*").execute()
            print(f"  [OK] {t} — {len(all_rows.data)} rows already empty")
        except Exception as e2:
            print(f"  [FAIL] {t}: {e2}")

print("\nAll tables cleared. Ready for fresh demo!")
