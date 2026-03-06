"""
Quick smoke-test for the Trial Pydantic v2 model.
Run from the `backend/` directory:
    python validate_trial.py
"""
import json
import sys

# ── 1. Import ──────────────────────────────────────────────────────────────────
try:
    from models.trial import Trial
    print("✅  Import OK")
except ImportError as e:
    print(f"❌  Import failed: {e}")
    sys.exit(1)

# ── 2. Valid instantiation ─────────────────────────────────────────────────────
valid_data = {
    "trial_id": "NCT04521234",
    "title": (
        "A Randomised, Double-Blind, Placebo-Controlled Study of "
        "Semaglutide in Adults With Type 2 Diabetes and Chronic Kidney Disease"
    ),
    "phase": "Phase 2",
    "sponsor": "Novo Nordisk A/S",
    "location": "Stanford Medical Center, Palo Alto, CA, USA",
    "start_date": "2024-03-01",
    "end_date": "2026-09-30",
    "criteria_text": (
        "Inclusion Criteria:\n"
        "  - Age 30-75 years\n"
        "  - HbA1c between 7.5% and 11.0%\n\n"
        "Exclusion Criteria:\n"
        "  - End-stage renal disease (eGFR < 15)"
    ),
}

trial = Trial(**valid_data)
print("✅  Valid trial created")
print(json.dumps(trial.model_dump(), indent=2))

# ── 3. Schema introspection ────────────────────────────────────────────────────
schema = Trial.model_json_schema()
print(f"\n✅  JSON schema generated — top-level keys: {list(schema.keys())}")
print(f"   trial_id pattern enforced: {schema['properties']['trial_id'].get('pattern')}")

# ── 4. Validation errors caught correctly ──────────────────────────────────────
from pydantic import ValidationError

bad_cases = [
    ("bad NCT format — too short",  {**valid_data, "trial_id": "NCT123"}),
    ("bad NCT format — no prefix",  {**valid_data, "trial_id": "04521234"}),
    ("missing required field",      {k: v for k, v in valid_data.items() if k != "title"}),
]

for label, bad_data in bad_cases:
    try:
        Trial(**bad_data)
        print(f"❌  Should have failed for: {label}")
    except ValidationError as exc:
        print(f"✅  Validation correctly rejected '{label}': "
              f"{exc.errors()[0]['msg']}")

print("\n🎉  All checks passed!")
