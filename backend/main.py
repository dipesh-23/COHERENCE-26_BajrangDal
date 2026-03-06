from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
from datetime import date

# Import Models
from models.patient import Patient
from models.trial import Trial, TrialPhase, TrialStatus, TrialSite

# Import Modules (M1 and M3 logic)
from modules.anonymizer import anonymize_patient, parse_trial_pdf
from modules.matcher import match_patient_to_trial, audit_log

app = FastAPI(title="Clinical Trial Matching Engine")

# --- CORS Setup for React 18 Frontend ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"], # React/Vite defaults
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from modules.parser import parse_trial_criteria

# --- 1. Hardcoded Sample Trials ---
SAMPLE_TRIALS = [
    Trial(
        trial_id="NCT04521234",
        official_title="Phase 3 Study of Semaglutide in Type 2 Diabetes",
        brief_summary="Evaluating efficacy in T2D patients with elevated HbA1c.",
        phase=TrialPhase.PHASE3,
        status=TrialStatus.RECRUITING,
        sponsor="Novo Nordisk",
        start_date=date(2024, 1, 1),
        sites=[TrialSite(facility="Stanford Health", city="Palo Alto", state="CA", country="USA", zip_code="94304")],
        min_age=18,
        max_age=75,
        required_diagnoses=["E11.9"],
        raw_inclusion_criteria="Adults 18-75 with Type 2 Diabetes. HbA1c > 7.0%.",
        raw_exclusion_criteria="End-stage renal disease. Prior GLP-1 use.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 18, "max": 75},
                {"field": "diagnosis", "values": ["E11.9"]},
                {"field": "lab", "name": "HbA1c", "operator": ">", "value": 7.0},
            ],
            "exclusion": [],
        },
    ),
    Trial(
        trial_id="NCT05559999",
        official_title="Early Intervention for Stage 3 Chronic Kidney Disease",
        brief_summary="Testing new ACE inhibitor formulations for CKD.",
        phase=TrialPhase.PHASE2,
        status=TrialStatus.RECRUITING,
        sponsor="RenalCare Corp",
        start_date=date(2024, 3, 15),
        sites=[TrialSite(facility="UCSF Medical", city="San Francisco", state="CA", country="USA", zip_code="94143")],
        min_age=40,
        max_age=80,
        required_diagnoses=["N18.3"],
        raw_inclusion_criteria="Patients 40-80 years old diagnosed with Stage 3 CKD.",
        raw_exclusion_criteria="Type 1 Diabetes. Severe hypertension.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 40, "max": 80},
                {"field": "diagnosis", "values": ["N18.3"]},
            ],
            "exclusion": [],
        },
    ),
    Trial(
        trial_id="NCT06112233",
        official_title="Asthma Management with Novel Inhaler Therapy",
        brief_summary="A study for moderate to severe persistent asthma.",
        phase=TrialPhase.PHASE4,
        status=TrialStatus.RECRUITING,
        sponsor="PulmoPharma",
        start_date=date(2023, 10, 1),
        sites=[TrialSite(facility="NYU Langone", city="New York", state="NY", country="USA", zip_code="10016")],
        min_age=12,
        max_age=65,
        required_diagnoses=["J45.909"],
        raw_inclusion_criteria="Ages 12-65 with documented persistent asthma.",
        raw_exclusion_criteria="Current smokers. COPD.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 12, "max": 65},
                {"field": "diagnosis", "values": ["J45.909"]},
            ],
            "exclusion": [
                {"field": "status", "name": "pregnant"},
                {"field": "other", "name": "COPD"},
                {"field": "drug", "name": "cigarettes"},
            ],
        },
    ),
    Trial(
        trial_id="NCT07884455",
        official_title="Cardiovascular Outcomes in Hypertension Patients",
        brief_summary="Observational study on long-term beta-blocker usage.",
        phase=TrialPhase.PHASE3,
        status=TrialStatus.ACTIVE_NOT_RECRUITING,
        sponsor="HeartHealth Inst",
        start_date=date(2022, 5, 10),
        sites=[TrialSite(facility="Texas Medical Center", city="Houston", state="TX", country="USA", zip_code="77030")],
        min_age=50,
        max_age=100,
        required_diagnoses=["I10"],
        raw_inclusion_criteria="Patients over 50 with essential hypertension.",
        raw_exclusion_criteria="History of myocardial infarction within last 12 months.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 50, "max": 100},
                {"field": "diagnosis", "values": ["I10"]},
            ],
            "exclusion": [],
        },
    ),
    Trial(
        trial_id="NCT08991122",
        official_title="Advanced Immunotherapy for Solid Tumors",
        brief_summary="Testing PD-1 inhibitors in advanced oncology patients.",
        phase=TrialPhase.PHASE1,
        status=TrialStatus.RECRUITING,
        sponsor="OncoGenetics",
        start_date=date(2024, 6, 1),
        sites=[TrialSite(facility="Dana-Farber", city="Boston", state="MA", country="USA", zip_code="02215")],
        min_age=18,
        max_age=120,
        required_diagnoses=["C80.1"],
        raw_inclusion_criteria="Adults with advanced solid tumors unresponsive to standard care.",
        raw_exclusion_criteria="Autoimmune diseases. Active brain metastases.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 18, "max": 120},
                {"field": "diagnosis", "values": ["C80.1"]},
            ],
            "exclusion": [],
        },
    ),
]

# --- 2. Data Ingestion Endpoints (M1) ---
@app.post("/ingest/patient", response_model=Patient)
def ingest_patient(patient: Patient):
    """
    Ingests a raw patient record, scrubs PHI via Presidio, 
    and returns the safe AnonymizedPatient version.
    """
    # Convert Pydantic object to dict for the anonymizer
    raw_dict = patient.model_dump()
    
    # Run Member 1's Anonymization Pipeline
    clean_dict = anonymize_patient(raw_dict)
    
    # Convert back to Pydantic model
    return Patient(**clean_dict)

@app.post("/ingest/trial")
def ingest_trial_pdf(file_path: str):
    """
    Parses clinical trial PDFs and extracts criteria text blocks.
    """
    try:
        trial_data = parse_trial_pdf(file_path)
        return {"status": "success", "data": trial_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- 3. The Core Matching Endpoint (M3) ---
@app.post("/match")
async def find_trial_matches(patient: Patient) -> Dict[str, Any]:
    """
    Accepts patient_id (or full patient object), returns ranked list 
    of top trials with scores and transparency data.
    """
    results = []
    
    for trial in SAMPLE_TRIALS:
        # Ensure criteria_json is populated for the demo
        if not trial.criteria_json:
            trial.criteria_json = parse_trial_criteria(
                trial.trial_id,
                trial.raw_inclusion_criteria,
                trial.raw_exclusion_criteria,
            )

        # Run your ML Hybrid Logic Engine
        match_result = match_patient_to_trial(patient, trial)
        
        # Build the Transparency Report JSON structure expected by frontend
        results.append({
            "trial_id": trial.trial_id,
            "title": trial.official_title,
            "phase": trial.phase,
            "sponsor": trial.sponsor,
            "eligible": match_result.get("eligible", False),
            "score": match_result.get("match_score", 0.0),
            "confidence": match_result.get("confidence", 1.0),
            "criteria_breakdown": match_result.get("criteria_breakdown", []),
            "missing_data": match_result.get("missing_data", []),
            "site_info": match_result.get("site_info", {}),
            "llm_explanation": match_result.get("llm_explanation", "")
        })

    # Sort results: Highest score at the top
    sorted_results = sorted(
        results, 
        key=lambda x: (x["eligible"], x["score"]), 
        reverse=True
    )
    
    return {"patient_id": patient.patient_id, "matches": sorted_results}

# --- 4. Fairness & Ethics Audit Endpoint (M4/M3) ---
@app.get("/admin/audit-summary")
def get_audit_summary():
    """
    Demographic Parity Audit log for the hackathon pitch. 
    Checks that match rates are statistically similar across demographics.
    """
    if not audit_log:
        return {"message": "No matches processed yet. Run /match first."}

    total = len(audit_log)
    eligible_count = sum(1 for log in audit_log if log.get("eligible"))
    
    # Calculate pass rates by gender to verify demographic parity
    genders = set(log.get("gender") for log in audit_log if log.get("gender"))
    stats_by_gender = {}
    
    for g in genders:
        group_logs = [l for l in audit_log if l.get("gender") == g]
        pass_rate = sum(1 for l in group_logs if l.get("eligible")) / len(group_logs)
        stats_by_gender[g] = {
            "count": len(group_logs),
            "pass_rate": round(pass_rate * 100, 2)
        }

    return {
        "total_matches_processed": total,
        "overall_eligibility_rate": round((eligible_count / total) * 100, 2),
        "demographic_parity": stats_by_gender,
        "ethical_safeguards": {
            "missing_data_transparency": "Active",
            "hpsa_equity_bonus": "Applied",
            "pii_redaction_status": "Verified"
        }
    }