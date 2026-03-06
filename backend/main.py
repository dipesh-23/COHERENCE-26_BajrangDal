from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from datetime import date

# Import your "perfect" models
from models.patient import Patient
from models.trial import Trial, TrialPhase, TrialStatus, TrialSite
# Import your matching logic
from modules.matcher import match_patient_to_trial 

app = FastAPI(title="Clinical Trial Matcher API")

# --- CORS Setup for React ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"], # React/Vite defaults
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. Hardcoded Sample Trials ---
# We will use 5 diverse trials to test different matching scenarios
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
        required_diagnoses=["E11.9"], # Type 2 Diabetes
        raw_inclusion_criteria="Adults 18-75 with Type 2 Diabetes. HbA1c > 7.0%.",
        raw_exclusion_criteria="End-stage renal disease. Prior GLP-1 use."
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
        required_diagnoses=["N18.3"], # CKD Stage 3
        raw_inclusion_criteria="Patients 40-80 years old diagnosed with Stage 3 CKD.",
        raw_exclusion_criteria="Type 1 Diabetes. Severe hypertension."
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
        required_diagnoses=["J45.909"], # Unspecified asthma
        raw_inclusion_criteria="Ages 12-65 with documented persistent asthma.",
        raw_exclusion_criteria="Current smokers. COPD."
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
        required_diagnoses=["I10"], # Essential hypertension
        raw_inclusion_criteria="Patients over 50 with essential hypertension.",
        raw_exclusion_criteria="History of myocardial infarction within last 12 months."
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
        required_diagnoses=["C80.1"], # Malignant neoplasm
        raw_inclusion_criteria="Adults with advanced solid tumors unresponsive to standard care.",
        raw_exclusion_criteria="Autoimmune diseases. Active brain metastases."
    )
]

# --- 2. The Core API Endpoint ---
@app.post("/match")
async def find_trial_matches(patient: Patient):
    """
    Receives a validated Patient profile from the frontend,
    runs the matching logic against the 5 sample trials,
    and returns a sorted list of recommendations.
    """
    results = []
    
    for trial in SAMPLE_TRIALS:
        # Run your logic engine (make sure your matcher.py accepts these Pydantic objects)
        match_result = match_patient_to_trial(patient, trial)
        
        results.append({
            "trial_id": trial.trial_id,
            "title": trial.official_title,
            "phase": trial.phase,
            "sponsor": trial.sponsor,
            "eligible": match_result["eligible"],
            "score": match_result["score"],
            "reasons": match_result.get("reasons", [])
        })

    # Sort results so the highest score is at the top of the array
    # If not eligible, push to the bottom by giving a negative sorting weight
    sorted_results = sorted(
        results, 
        key=lambda x: (x["eligible"], x["score"]), 
        reverse=True
    )
    
    return {"patient_id": patient.patient_id, "matches": sorted_results}

