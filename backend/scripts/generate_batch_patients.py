"""
generate_batch_patients.py  — Generates a 10-patient clinical CSV for batch testing.
Covers all 5 trials in main.py: T2DM, CKD, Asthma, Hypertension (Cardio), Oncology.
Includes positive, partial (verify), and negative (ineligible) cases.
"""
import csv, os

patients = [
    # ── T2DM Trial NCT04521234 (HbA1c > 7.0, E11.9, age 18-75) ──────────────
    {
        "patient_id": "P-DEMO-001", "patient_name": "James Anderson (ANONYMIZED)",
        "age": 52, "gender": "male", "zip_code": "94305",
        "diagnoses_icd10": "E11.9",
        "lab_tests": "HbA1c | eGFR",
        "lab_values": "HbA1c: 8.4% | eGFR: 72 mL/min",
        "medications": "Metformin 1000mg, Atorvastatin 20mg",
        "clinical_history": "52-year-old male with Type 2 Diabetes. HbA1c consistently 8.4%. No prior GLP-1 use. Managed on Metformin.",
        "intended_trial_match": "NCT04521234 - Semaglutide T2DM Phase 3 [POSITIVE MATCH]"
    },
    {
        "patient_id": "P-DEMO-002", "patient_name": "Maria Gutierrez (ANONYMIZED)",
        "age": 68, "gender": "female", "zip_code": "94305",
        "diagnoses_icd10": "E11.9",
        "lab_tests": "HbA1c | eGFR",
        "lab_values": "HbA1c: 7.8% | eGFR: 55 mL/min",
        "medications": "Metformin 500mg, Glipizide 5mg",
        "clinical_history": "68-year-old female with well-managed Type 2 Diabetes. HbA1c 7.8%, slightly above controlled threshold. No renal failure. No semaglutide or liraglutide history.",
        "intended_trial_match": "NCT04521234 - Semaglutide T2DM Phase 3 [PARTIAL - verify eGFR]"
    },
    {
        "patient_id": "P-DEMO-003", "patient_name": "Robert Chen (ANONYMIZED)",
        "age": 82, "gender": "male", "zip_code": "10001",
        "diagnoses_icd10": "E11.9",
        "lab_tests": "HbA1c | eGFR",
        "lab_values": "HbA1c: 9.1% | eGFR: 22 mL/min",
        "medications": "Insulin Glargine, Semaglutide 1mg",
        "clinical_history": "82-year-old male with poorly controlled Type 2 Diabetes and end-stage renal disease. eGFR 22. Currently on semaglutide (prior GLP-1 agonist use).",
        "intended_trial_match": "NCT04521234 - INELIGIBLE - age>75 AND prior GLP-1 use AND ESRD [NEGATIVE TEST]"
    },
    # ── CKD Trial NCT05559999 (N18.3, age 40-80) ──────────────────────────────
    {
        "patient_id": "P-DEMO-004", "patient_name": "Sarah Mitchell (ANONYMIZED)",
        "age": 63, "gender": "female", "zip_code": "94143",
        "diagnoses_icd10": "N18.3",
        "lab_tests": "eGFR | Creatinine",
        "lab_values": "eGFR: 42 mL/min | Creatinine: 1.9 mg/dL",
        "medications": "Lisinopril 10mg, Furosemide 40mg",
        "clinical_history": "63-year-old female with Stage 3 CKD secondary to hypertension. eGFR 42. No diabetes. Currently on ACE inhibitor.",
        "intended_trial_match": "NCT05559999 - CKD ACE Inhibitor Phase 2 [POSITIVE MATCH]"
    },
    {
        "patient_id": "P-DEMO-005", "patient_name": "David Kim (ANONYMIZED)",
        "age": 55, "gender": "male", "zip_code": "94143",
        "diagnoses_icd10": "N18.3",
        "lab_tests": "eGFR | Creatinine",
        "lab_values": "eGFR: 48 mL/min | Creatinine: 1.6 mg/dL",
        "medications": "Losartan 50mg, Amlodipine 5mg",
        "clinical_history": "55-year-old male with Stage 3a CKD and hypertension. Currently managed on ARB therapy. No Type 1 diabetes. Stable renal function over 12 months.",
        "intended_trial_match": "NCT05559999 - CKD ACE Inhibitor Phase 2 [POSITIVE MATCH]"
    },
    # ── Asthma Trial NCT06112233 (J45.909, age 12-65, No COPD, no smokers) ───
    {
        "patient_id": "P-DEMO-006", "patient_name": "Emily Torres (ANONYMIZED)",
        "age": 28, "gender": "female", "zip_code": "10016",
        "diagnoses_icd10": "J45.909",
        "lab_tests": "FEV1",
        "lab_values": "FEV1: 62 %predicted",
        "medications": "Fluticasone inhaler 250mcg BD, Salbutamol 100mcg PRN",
        "clinical_history": "28-year-old non-smoking female with persistent moderate-to-severe asthma since childhood. FEV1 62% predicted. No COPD. Not pregnant.",
        "intended_trial_match": "NCT06112233 - Asthma Inhaler Phase 4 [POSITIVE MATCH]"
    },
    {
        "patient_id": "P-DEMO-007", "patient_name": "Kevin Walsh (ANONYMIZED)",
        "age": 41, "gender": "male", "zip_code": "10016",
        "diagnoses_icd10": "J45.909",
        "lab_tests": "FEV1",
        "lab_values": "FEV1: 55 %predicted",
        "medications": "Budesonide inhaler, cigarettes",
        "clinical_history": "41-year-old male with moderate persistent asthma. Active smoker - currently smokes 10 cigarettes per day. FEV1 55% predicted. Diagnosed with early COPD.",
        "intended_trial_match": "NCT06112233 - INELIGIBLE: active smoker AND COPD [NEGATIVE TEST]"
    },
    # ── Hypertension Trial NCT07884455 (I10, age 50-100) ─────────────────────
    {
        "patient_id": "P-DEMO-008", "patient_name": "Linda Harris (ANONYMIZED)",
        "age": 67, "gender": "female", "zip_code": "77030",
        "diagnoses_icd10": "I10",
        "lab_tests": "BP Systolic | BP Diastolic",
        "lab_values": "BP Systolic: 158 mmHg | BP Diastolic: 95 mmHg",
        "medications": "Amlodipine 10mg, Hydrochlorothiazide 25mg",
        "clinical_history": "67-year-old female with essential hypertension. BP 158/95 on current regimen. No recent MI. No diabetes. Managed by cardiologist at Texas Medical Center.",
        "intended_trial_match": "NCT07884455 - Hypertension Beta-Blocker Study [POSITIVE MATCH]"
    },
    # ── Oncology Trial NCT08991122 (C80.1, age 18-120) ───────────────────────
    {
        "patient_id": "P-DEMO-009", "patient_name": "Frank O'Brien (ANONYMIZED)",
        "age": 58, "gender": "male", "zip_code": "02215",
        "diagnoses_icd10": "C80.1",
        "lab_tests": "PSA | LDH",
        "lab_values": "PSA: 45 ng/mL | LDH: 280 U/L",
        "medications": "Docetaxel 75mg/m2, Prednisone 5mg BD",
        "clinical_history": "58-year-old male with advanced malignant neoplasm (C80.1), unresponsive to two prior lines of chemotherapy. No autoimmune disease. No active brain metastases on latest MRI.",
        "intended_trial_match": "NCT08991122 - Advanced Immunotherapy Solid Tumors Phase 1 [POSITIVE MATCH]"
    },
    {
        "patient_id": "P-DEMO-010", "patient_name": "Priya Sharma (ANONYMIZED)",
        "age": 45, "gender": "female", "zip_code": "02215",
        "diagnoses_icd10": "C80.1",
        "lab_tests": "CEA | CA125",
        "lab_values": "CEA: 38 ng/mL | CA125: 120 U/mL",
        "medications": "Pembrolizumab 200mg Q3W",
        "clinical_history": "45-year-old female with advanced unresectable solid tumor. Active rheumatoid arthritis diagnosis (autoimmune disease). Currently on immunotherapy. Possible brain metastases per imaging.",
        "intended_trial_match": "NCT08991122 - INELIGIBLE: autoimmune disease [NEGATIVE TEST]"
    },
]

out = os.path.join(os.path.dirname(__file__), "..", "tests", "test_patients")
os.makedirs(out, exist_ok=True)

csv_path = os.path.join(out, "batch_10_patients_clinical.csv")
fieldnames = [
    "patient_id", "patient_name", "age", "gender", "zip_code",
    "diagnoses_icd10", "lab_tests", "lab_values",
    "medications", "clinical_history", "intended_trial_match"
]

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for p in patients:
        writer.writerow(p)

print(f"Generated {len(patients)} patients -> {csv_path}")
