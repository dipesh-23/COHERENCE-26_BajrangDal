"""e2e_test.py — Full end-to-end verification: ingest patient → match → verify in Supabase."""
import os, httpx, sys
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

BASE = "http://localhost:8000"

# ── Step 1: POST /ingest/patient ────────────────────────────────────────────
print("Step 1: Ingesting patient via /ingest/patient ...")
r = httpx.post(f"{BASE}/ingest/patient", json={
    "age": 54, "gender": "male", "zip_code": "94305",
    "diagnoses": ["E11.9"],
    "labs": {"HbA1c": 8.7, "eGFR": 68},
    "medications": ["Metformin 1000mg"],
    "history_text": "Patient with Type 2 Diabetes, poorly controlled."
}, timeout=15)
print(f"  HTTP {r.status_code}")
if r.status_code != 200:
    print("  Error:", r.text[:300]); sys.exit(1)
patient = r.json()
pid = patient["patient_id"]
print(f"  Patient ID  : {pid}")
print(f"  Age/Gender  : {patient['age']} / {patient['gender']}")

# ── Step 2: POST /match ─────────────────────────────────────────────────────
print("\nStep 2: Running trial match via /match ...")
r2 = httpx.post(f"{BASE}/match", json=patient, timeout=30)
print(f"  HTTP {r2.status_code}")
if r2.status_code != 200:
    print("  Error:", r2.text[:300]); sys.exit(1)
result = r2.json()
matches = result.get("matches", [])
print(f"  Matches returned : {len(matches)}")
if matches:
    top = matches[0]
    print(f"  Top trial        : {top['trial_id']}  score={top.get('score', top.get('match_score', '?'))}  eligible={top.get('eligible')}")

# ── Step 3: Verify Supabase persistence ─────────────────────────────────────
print("\nStep 3: Verifying persistence in Supabase ...")
db = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

pr = db.table("patients").select("patient_id,age,gender").eq("patient_id", pid).execute()
print(f"  patients table   : {pr.data}")

mr = db.table("match_results").select("trial_id,match_score,eligible").eq("patient_id", pid).execute()
print(f"  match_results    : {len(mr.data)} rows saved")
for row in mr.data[:5]:
    print(f"    {row['trial_id']}  score={row['match_score']}  eligible={row['eligible']}")

# ── Step 4: Health endpoint ─────────────────────────────────────────────────
print("\nStep 4: Checking /health ...")
h = httpx.get(f"{BASE}/health", timeout=5)
print(f"  /health response : {h.json()}")

print()
if pr.data and mr.data:
    print("ALL CHECKS PASSED - Supabase integration is working end-to-end!")
else:
    print("WARNING: Data not persisted - check uvicorn logs for DB errors")
    sys.exit(1)
