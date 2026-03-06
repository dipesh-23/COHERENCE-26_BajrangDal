"""
generate.py — Generates 20 realistic fake patient JSON files for T2DM patients.

Usage (run from the backend/ directory):
    python data/sample_patients/generate.py

Output:
    backend/data/sample_patients/patient_001.json ... patient_020.json
"""

import json
import random
import sys
from pathlib import Path

# ── Faker import guard ─────────────────────────────────────────────────────────
try:
    from faker import Faker
except ImportError:
    print("❌  Faker not installed. Run: pip install faker")
    sys.exit(1)

# ── Path setup ─────────────────────────────────────────────────────────────────
# Script lives at backend/data/sample_patients/generate.py
# Add backend/ to sys.path so `models.patient` resolves correctly
SCRIPT_DIR = Path(__file__).resolve().parent          # backend/data/sample_patients/
BACKEND_DIR = SCRIPT_DIR.parent.parent                # backend/
sys.path.insert(0, str(BACKEND_DIR))

from models.patient import Patient  # noqa: E402  (import after path fix)

# ── Configuration ──────────────────────────────────────────────────────────────
RANDOM_SEED = 42
NUM_PATIENTS = 20
OUTPUT_DIR = SCRIPT_DIR

random.seed(RANDOM_SEED)
fake = Faker()
Faker.seed(RANDOM_SEED)

# ── Data palettes ──────────────────────────────────────────────────────────────

# Every patient has T2DM; they may also have common comorbidities
COMORBIDITY_POOL = [
    ("I10",   "hypertension"),
    ("E78.5", "hyperlipidaemia"),
    ("N18.3", "stage 3 chronic kidney disease"),
    ("E66.9", "obesity"),
    ("G47.33","obstructive sleep apnoea"),
    ("I25.10","coronary artery disease"),
    ("E11.65","T2DM with hyperglycaemia"),        # variant DM code
    ("M79.3", "peripheral neuropathy"),
]

METFORMIN_OPTIONS = [
    "Metformin 500mg twice daily",
    "Metformin 1000mg twice daily",
    "Metformin XR 750mg once daily",
]

INSULIN_OPTIONS = [
    "Insulin glargine 20 units nightly",
    "Insulin detemir 18 units nightly",
    "Insulin NPH 22 units nightly",
]

ADJUNCT_MEDS = [
    "Lisinopril 10mg once daily",
    "Amlodipine 5mg once daily",
    "Atorvastatin 20mg nightly",
    "Rosuvastatin 10mg nightly",
    "Aspirin 81mg once daily",
    "Empagliflozin 10mg once daily",
    "Sitagliptin 100mg once daily",
    "Metoprolol succinate 50mg once daily",
    "Furosemide 40mg once daily",
    "Omeprazole 20mg once daily",
]

GENDERS = ["Male", "Female"]

# Creatinine rough inverse of eGFR for realism
def _creatinine_from_egfr(egfr: float) -> float:
    """Approximate creatinine (mg/dL) from eGFR using a simple inverse curve."""
    if egfr >= 80:
        return round(random.uniform(0.7, 1.0), 2)
    elif egfr >= 60:
        return round(random.uniform(1.0, 1.3), 2)
    else:
        return round(random.uniform(1.3, 2.0), 2)


def _history_text(
    age: int,
    gender: str,
    years_dm: int,
    hba1c: float,
    egfr: float,
    comorbidity_labels: list[str],
    medications: list[str],
) -> str:
    """Generate a plain-English clinical narrative."""
    pronoun = "He" if gender == "Male" else "She"
    comorbidities_str = (
        ", ".join(comorbidity_labels) if comorbidity_labels else "no other significant comorbidities"
    )
    glucose_control = (
        "well-controlled" if hba1c < 7.5 else
        "moderately controlled" if hba1c < 9.0 else
        "poorly controlled"
    )
    renal_note = (
        "Renal function is within normal limits."
        if egfr >= 75
        else f"Renal function is mildly to moderately reduced (eGFR {egfr} mL/min/1.73m²)."
    )
    med_str = ", ".join(medications[:3])  # trim to first 3 for readability
    return (
        f"{age}-year-old {gender.lower()} with a {years_dm}-year history of "
        f"Type 2 diabetes mellitus, currently {glucose_control} (HbA1c {hba1c}%). "
        f"Comorbidities include {comorbidities_str}. "
        f"{renal_note} "
        f"Current medications include {med_str}. "
        f"No known drug allergies. "
        f"{pronoun} denies recent hospitalisations or surgical procedures."
    )


# ── Generator ──────────────────────────────────────────────────────────────────

def generate_patient(index: int) -> Patient:
    patient_id = f"PT-{index:05d}"
    age = random.randint(35, 70)
    gender = random.choice(GENDERS)
    zip_code = fake.zipcode()

    # Diagnoses: always T2DM + 1–3 random comorbidities
    selected_comorbidities = random.sample(COMORBIDITY_POOL, k=random.randint(1, 3))
    diagnoses = ["E11.9"] + [c[0] for c in selected_comorbidities]
    comorbidity_labels = [c[1] for c in selected_comorbidities]

    # Labs
    hba1c = round(random.uniform(6.5, 11.0), 1)
    egfr = round(random.uniform(45.0, 90.0), 1)
    creatinine = _creatinine_from_egfr(egfr)
    labs = {
        "HbA1c": hba1c,
        "eGFR": egfr,
        "creatinine": creatinine,
        "fasting_glucose": round(random.uniform(90.0, 280.0), 1),
        "LDL": round(random.uniform(60.0, 180.0), 1),
        "BMI": round(random.uniform(24.0, 42.0), 1),
    }

    # Medications: metformin or insulin (or both), plus 2-4 adjuncts
    primary_meds = []
    choice = random.random()
    if choice < 0.45:
        primary_meds = [random.choice(METFORMIN_OPTIONS)]
    elif choice < 0.75:
        primary_meds = [random.choice(INSULIN_OPTIONS)]
    else:
        # Both metformin + insulin (common in T2DM)
        primary_meds = [
            random.choice(METFORMIN_OPTIONS),
            random.choice(INSULIN_OPTIONS),
        ]
    adjuncts = random.sample(ADJUNCT_MEDS, k=random.randint(2, 4))
    medications = primary_meds + adjuncts

    years_dm = random.randint(1, min(age - 30, 25))
    history_text = _history_text(age, gender, years_dm, hba1c, egfr, comorbidity_labels, medications)

    return Patient(
        patient_id=patient_id,
        age=age,
        gender=gender,
        zip_code=zip_code,
        diagnoses=diagnoses,
        labs=labs,
        medications=medications,
        history_text=history_text,
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📂  Output directory: {OUTPUT_DIR}")
    print(f"🔧  Generating {NUM_PATIENTS} patient files...\n")

    for i in range(1, NUM_PATIENTS + 1):
        patient = generate_patient(i)
        filename = OUTPUT_DIR / f"patient_{i:03d}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(patient.model_dump(), f, indent=2)
        print(f"  ✅  {filename.name}  —  {patient.gender}, age {patient.age}, "
              f"HbA1c {patient.labs['HbA1c']}%, eGFR {patient.labs['eGFR']}")

    print(f"\n🎉  Done! {NUM_PATIENTS} files written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
