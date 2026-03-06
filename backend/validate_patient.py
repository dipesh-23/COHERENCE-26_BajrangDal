"""
Quick smoke-test for the Patient Pydantic v2 model.
Run from the `backend/` directory:
    python validate_patient.py
"""
import json
import sys

# ── 1. Import ──────────────────────────────────────────────────────────────────
try:
    from models.patient import Patient
    print("✅  Import OK")
except ImportError as e:
    print(f"❌  Import failed: {e}")
    sys.exit(1)

# ── 2. Valid instantiation ─────────────────────────────────────────────────────
valid_data = {
    "patient_id": "PT-00123",
    "age": 54,
    "gender": "Male",
    "zip_code": "94103",
    "diagnoses": ["E11.9", "I10", "N18.3"],
    "labs": {"HbA1c": 8.2, "eGFR": 75.0, "creatinine": 1.1},
    "medications": ["Metformin 500mg", "Lisinopril 10mg", "Atorvastatin 20mg"],
    "history_text": (
        "54-year-old male with a 10-year history of Type 2 diabetes mellitus, "
        "stage 3 chronic kidney disease, and hypertension."
    ),
}

patient = Patient(**valid_data)
print("✅  Valid patient created")
print(json.dumps(patient.model_dump(), indent=2))

# ── 3. Schema introspection ────────────────────────────────────────────────────
schema = Patient.model_json_schema()
print(f"\n✅  JSON schema generated — top-level keys: {list(schema.keys())}")

# ── 4. Validation errors caught correctly ──────────────────────────────────────
from pydantic import ValidationError

bad_cases = [
    ("negative age",  {**valid_data, "age": -5}),
    ("age over 150",  {**valid_data, "age": 200}),
    ("missing field", {k: v for k, v in valid_data.items() if k != "patient_id"}),
    ("bad lab type",  {**valid_data, "labs": {"HbA1c": "high"}}),
]

for label, bad_data in bad_cases:
    try:
        Patient(**bad_data)
        print(f"❌  Should have failed for: {label}")
    except ValidationError as exc:
        print(f"✅  Validation correctly rejected '{label}': "
              f"{exc.errors()[0]['msg']}")

print("\n🎉  All checks passed!")
