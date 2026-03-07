import json
import csv
import os

patients = [
    {
        "patient_id": "P-DEMO-001",
        "display_name": "John Carter (ANONYMIZED)",
        "age": 52,
        "gender": "male",
        "zip_code": "94305",
        "diagnoses": ["E11.9"],
        "labs": {
            "HbA1c": {"value": 8.4, "unit": "%", "observation_date": "2026-02-15"},
            "eGFR": {"value": 72, "unit": "mL/min", "observation_date": "2026-02-15"}
        },
        "medications": ["Metformin 1000mg", "Atorvastatin 20mg"],
        "history_text": "52-year-old male with Type 2 Diabetes diagnosed in 2019. HbA1c is consistently elevated at 8.4%. No prior GLP-1 agonist use. No renal complications. Managed on Metformin.",
        "intended_trial": "NCT04521234 - Phase 3 Study of Semaglutide in Type 2 Diabetes"
    },
    {
        "patient_id": "P-DEMO-002",
        "display_name": "Sarah Mitchell (ANONYMIZED)",
        "age": 63,
        "gender": "female",
        "zip_code": "94143",
        "diagnoses": ["N18.3"],
        "labs": {
            "eGFR": {"value": 42, "unit": "mL/min", "observation_date": "2026-01-22"},
            "Creatinine": {"value": 1.9, "unit": "mg/dL", "observation_date": "2026-01-22"}
        },
        "medications": ["Lisinopril 10mg", "Furosemide 40mg"],
        "history_text": "63-year-old female with Stage 3 CKD secondary to hypertension. eGFR is 42. No diabetes. Currently on ACE inhibitor. Managed at UCSF nephrology clinic.",
        "intended_trial": "NCT05559999 - Early Intervention for Stage 3 Chronic Kidney Disease"
    },
    {
        "patient_id": "P-DEMO-003",
        "display_name": "Emily Torres (ANONYMIZED)",
        "age": 28,
        "gender": "female",
        "zip_code": "10016",
        "diagnoses": ["J45.909"],
        "labs": {
            "FEV1": {"value": 62, "unit": "% predicted", "observation_date": "2026-03-01"}
        },
        "medications": ["Fluticasone inhaler 250mcg BD", "Salbutamol 100mcg PRN"],
        "history_text": "28-year-old non-smoking female with persistent moderate-to-severe asthma since childhood. FEV1 at 62% predicted. No COPD. Not pregnant. Not a current smoker.",
        "intended_trial": "NCT06112233 - Asthma Management with Novel Inhaler Therapy"
    },
    {
        "patient_id": "P-DEMO-004",
        "display_name": "David Kim (ANONYMIZED) [NEGATIVE CASE]",
        "age": 82,
        "gender": "male",
        "zip_code": "94305",
        "diagnoses": ["E11.9"],
        "labs": {
            "HbA1c": {"value": 9.1, "unit": "%", "observation_date": "2026-02-28"},
            "eGFR": {"value": 25, "unit": "mL/min", "observation_date": "2026-02-28"}
        },
        "medications": ["Insulin Glargine", "Metformin 500mg"],
        "history_text": "82-year-old male with poorly controlled Type 2 Diabetes and end-stage renal disease. eGFR is 25. HbA1c 9.1%. Prior use of semaglutide (Ozempic) discontinued due to GI side effects.",
        "intended_trial": "NONE - fails age (82 > 75) and exclusion criteria (ESRD, prior GLP-1 use) for NCT04521234"
    }
]

# Output folder
out = os.path.join(os.path.dirname(__file__), "..", "tests", "test_patients")
os.makedirs(out, exist_ok=True)

# Write individual JSON files (API-ready: without display_name and intended_trial)
for p in patients:
    pid = p["patient_id"]
    payload = {k: v for k, v in p.items() if k not in ["display_name", "intended_trial"]}
    json_path = os.path.join(out, f"{pid}.json")
    with open(json_path, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"Written: {json_path}")

# Write master CSV in clinical report format
csv_path = os.path.join(out, "all_test_patients_clinical_report.csv")
with open(csv_path, "w", newline="", encoding="utf-8") as csvfile:
    fieldnames = [
        "patient_id",
        "patient_name",
        "age",
        "gender",
        "zip_code",
        "diagnoses_icd10",
        "lab_tests",
        "lab_values",
        "medications",
        "clinical_history",
        "intended_trial_match"
    ]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()

    for p in patients:
        lab_tests = " | ".join(p["labs"].keys())
        lab_vals  = " | ".join([f"{k}: {v['value']} {v['unit']}" for k, v in p["labs"].items()])
        writer.writerow({
            "patient_id":          p["patient_id"],
            "patient_name":        p["display_name"],
            "age":                 p["age"],
            "gender":              p["gender"],
            "zip_code":            p["zip_code"],
            "diagnoses_icd10":     ", ".join(p["diagnoses"]),
            "lab_tests":           lab_tests,
            "lab_values":          lab_vals,
            "medications":         ", ".join(p["medications"]),
            "clinical_history":    p["history_text"],
            "intended_trial_match": p["intended_trial"]
        })

print(f"\nCSV written: {csv_path}")
print("\nAll test files generated:")
for f in sorted(os.listdir(out)):
    print(f"  - {f}")
