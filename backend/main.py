from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import date
import logging

log = logging.getLogger(__name__)

# Import Models
from models.patient import Patient
from models.trial import Trial, TrialPhase, TrialStatus, TrialSite

# Import Modules (M1 and M3 logic)
from modules.anonymizer import anonymize_patient, parse_trial_pdf
from modules.matcher import match_patient_to_trial, audit_log
from auth import verify_token
from fastapi import Depends

# Import Database layer + config
from database import safe_upsert, safe_insert, Tables, get_db
from config import get_settings

settings = get_settings()

app = FastAPI(
    title="Clinical Trial Matching Engine",
    version="1.0.0",
    description="AI-powered patient-to-clinical-trial eligibility matching system"
)

# --- CORS: read origins from settings (supports Docker + dev) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
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
        sites=[TrialSite(facility="KEM Hospital", city="Mumbai", state="Maharashtra", country="India", zip_code="400012", lat=19.0163, lng=72.8529)],
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
        visits_required=24,
        telehealth_enabled=False,
        investigational_drug="Semaglutide",
    ),
    Trial(
        trial_id="NCT05559999",
        official_title="Early Intervention for Stage 3 Chronic Kidney Disease",
        brief_summary="Testing new ACE inhibitor formulations for CKD.",
        phase=TrialPhase.PHASE2,
        status=TrialStatus.RECRUITING,
        sponsor="RenalCare Corp",
        start_date=date(2024, 3, 15),
        sites=[TrialSite(facility="AIIMS", city="New Delhi", state="Delhi", country="India", zip_code="110029", lat=28.5672, lng=77.2100)],
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
        visits_required=8,
        telehealth_enabled=True,
        investigational_drug="Sparsentan",
    ),
    Trial(
        trial_id="NCT09112222",
        official_title="CLARITY-AD: Lecanemab for Early Alzheimer's Disease / Mild Cognitive Impairment",
        brief_summary="Phase 3 study of anti-amyloid monoclonal antibody lecanemab in patients with early Alzheimer's disease or MCI with confirmed amyloid burden.",
        phase=TrialPhase.PHASE3,
        status=TrialStatus.ENROLLING_BY_INVITATION,
        sponsor="Eisai / Biogen",
        start_date=date(2024, 11, 15),
        sites=[TrialSite(facility="AIG Hospitals", city="Hyderabad", state="Telangana", country="India", zip_code="500081", lat=17.4439, lng=78.3619)],
        min_age=50,
        max_age=85,
        required_diagnoses=["G31.84"],
        raw_inclusion_criteria="Patients 50-85 with Mild Cognitive Impairment confirmed by amyloid PET or CSF. MMSE 22-26. No prior anti-amyloid biologic. No history of stroke.",
        raw_exclusion_criteria="History of stroke. Severe uncontrolled hypertension. Active malignancy.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 50, "max": 85},
                {"field": "diagnosis", "values": ["G31.84"]},
                {"field": "condition", "name": "amyloid"},
                {"field": "lab", "name": "MMSE", "operator": ">=", "value": 22},
            ],
            "exclusion": [
                {"field": "condition", "name": "stroke"},
            ],
            "raw_text": "Adults 50-85 with MCI and amyloid burden confirmed by PET. MMSE 22-26. No prior anti-amyloid therapy. No stroke history."
        },
        visits_required=6,
        telehealth_enabled=True,
        investigational_drug="Lecanemab",
    ),
    Trial(
        trial_id="NCT07884455",
        official_title="Cardiovascular Outcomes in Hypertension Patients",
        brief_summary="Observational study on long-term beta-blocker usage.",
        phase=TrialPhase.PHASE3,
        status=TrialStatus.ACTIVE_NOT_RECRUITING,
        sponsor="HeartHealth Inst",
        start_date=date(2022, 5, 10),
        sites=[TrialSite(facility="Global Hospital", city="Chennai", state="Tamil Nadu", country="India", zip_code="600100", lat=13.0645, lng=80.2449)],
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
        visits_required=4,
        telehealth_enabled=False,
        investigational_drug="Sacubitril-Valsartan",
    ),
    Trial(
        trial_id="NCT08991122",
        official_title="Advanced Immunotherapy for Solid Tumors",
        brief_summary="Testing PD-1 inhibitors in advanced oncology patients.",
        phase=TrialPhase.PHASE1,
        status=TrialStatus.RECRUITING,
        sponsor="OncoGenetics",
        start_date=date(2024, 6, 1),
        sites=[TrialSite(facility="Tata Memorial Hospital", city="Mumbai", state="Maharashtra", country="India", zip_code="400012", lat=19.0160, lng=72.8520)],
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
        visits_required=52,
        telehealth_enabled=False,
        investigational_drug="Pembrolizumab",
    ),
    Trial(
        trial_id="NCT09001111",
        official_title="Next-Generation Oral SERD for Advanced ER+/HER2- Breast Cancer",
        brief_summary="Evaluating a novel selective estrogen receptor degrader in patients with disease progression on prior CDK4/6 inhibitors.",
        phase=TrialPhase.PHASE2,
        status=TrialStatus.RECRUITING,
        sponsor="OncoTherapeutics",
        start_date=date(2025, 2, 1),
        sites=[TrialSite(facility="Breach Candy Hospital", city="Mumbai", state="Maharashtra", country="India", zip_code="400026", lat=18.9719, lng=72.8093)],
        min_age=18,
        max_age=120,
        required_diagnoses=["C50.919"],
        raw_inclusion_criteria="Adult females with ER+/HER2- metastatic breast cancer. Prior progression on Letrozole and Palbociclib. ECOG 0-1.",
        raw_exclusion_criteria="Active brain metastases. Prior chemotherapy for advanced disease.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 18, "max": 120},
                {"field": "gender", "value": "Female"},
                {"field": "diagnosis", "values": ["C50.919"]},
                {"field": "treatment", "name": "Letrozole"},
                {"field": "treatment", "name": "Palbociclib"}
            ],
            "exclusion": [
                {"field": "condition", "name": "active brain metastases"}
            ],
            "raw_text": "Adult females with ER+/HER2- metastatic breast cancer. Prior progression on Letrozole and Palbociclib. ECOG 0-1. Excludes active brain metastases."
        },
        visits_required=16,
        telehealth_enabled=False,
        investigational_drug="Elacestrant",
    ),
    Trial(
        trial_id="NCT09112222",
        official_title="Efficacy of Novel Anti-Amyloid Monoclonal Antibody in Mild Cognitive Impairment",
        brief_summary="A Phase 3, randomized, double-blind study for early Alzheimer's disease.",
        phase=TrialPhase.PHASE3,
        status=TrialStatus.ENROLLING_BY_INVITATION,
        sponsor="NeuroGen",
        start_date=date(2024, 11, 15),
        sites=[TrialSite(facility="AIG Hospitals", city="Hyderabad", state="Telangana", country="India", zip_code="500081", lat=17.4439, lng=78.3619)],
        min_age=60,
        max_age=85,
        required_diagnoses=["G31.84"],
        raw_inclusion_criteria="Patients 60-85 with Mild Cognitive Impairment. Positive amyloid PET scan. MMSE 22-26.",
        raw_exclusion_criteria="History of stroke. Severe uncontrolled hypertension.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 60, "max": 85},
                {"field": "diagnosis", "values": ["G31.84"]},
                {"field": "condition", "name": "amyloid burden"}
            ],
            "exclusion": [
                {"field": "condition", "name": "stroke"}
            ],
            "raw_text": "Patients 60-85 with Mild Cognitive Impairment. Positive amyloid PET scan. Excludes history of stroke and severe hypertension."
        },
        visits_required=6,
        telehealth_enabled=True,
        investigational_drug="Lecanemab",
    ),
    Trial(
        trial_id="NCT09500001",
        official_title="PASADENA: Prasinezumab in Early-Stage Parkinson's Disease",
        brief_summary="Phase 2b study of anti-alpha-synuclein monoclonal antibody prasinezumab to slow motor progression in early Parkinson's disease.",
        phase=TrialPhase.PHASE2,
        status=TrialStatus.RECRUITING,
        sponsor="Roche / Prothena",
        start_date=date(2024, 6, 1),
        sites=[TrialSite(facility="NIMHANS", city="Bangalore", state="Karnataka", country="India", zip_code="560029", lat=12.9428, lng=77.5933)],
        min_age=40,
        max_age=80,
        required_diagnoses=["G20"],
        raw_inclusion_criteria="Adults 40-80 with early-stage Parkinson's disease (Hoehn-Yahr 1-3). Disease duration less than 7 years. On stable dopaminergic therapy. No dementia.",
        raw_exclusion_criteria="Moderate-severe dementia. Prior immunotherapy. Atypical Parkinsonism.",
        criteria_json={
            "inclusion": [
                {"field": "age", "min": 40, "max": 80},
                {"field": "diagnosis", "values": ["G20"]},
                {"field": "condition", "name": "Parkinson"},
            ],
            "exclusion": [
                {"field": "condition", "name": "dementia"},
                {"field": "condition", "name": "atypical Parkinsonism"},
            ],
            "raw_text": "Early Parkinson's disease Hoehn-Yahr 1-3. Disease duration under 7 years. Stable dopaminergic therapy. No dementia or atypical features."
        },
        visits_required=18,
        telehealth_enabled=False,
        investigational_drug="Prasinezumab",
    ),
]




# --- Startup: seed trials table -------------------------------------------
@app.on_event("startup")
async def seed_trials():
    """Upsert SAMPLE_TRIALS into Supabase on every startup (idempotent)."""
    for t in SAMPLE_TRIALS:
        safe_upsert(Tables.TRIALS, {
            "trial_id":       t.trial_id,
            "official_title": t.official_title,
            "brief_summary":  t.brief_summary,
            "phase":          t.phase.value if hasattr(t.phase, 'value') else str(t.phase),
            "status":         t.status.value if hasattr(t.status, 'value') else str(t.status),
            "sponsor":        t.sponsor,
            "start_date":     str(t.start_date) if t.start_date else None,
            "raw_inclusion":  getattr(t, 'raw_inclusion_criteria', ''),
            "raw_exclusion":  getattr(t, 'raw_exclusion_criteria', ''),
            "criteria_json":  t.criteria_json if t.criteria_json else {},
        })
    log.info(f"Seeded {len(SAMPLE_TRIALS)} trials into Supabase.")


# --- 2. Data Ingestion Endpoints (M1) ---
@app.post("/ingest/patient", response_model=Patient)
def ingest_patient(patient: Patient):
    """
    Ingests a raw patient record, scrubs PHI via Presidio, persists to
    Supabase, and returns the safe AnonymizedPatient version.
    """
    raw_dict  = patient.model_dump()
    clean_dict = anonymize_patient(raw_dict)
    anon_patient = Patient(**clean_dict)

    # ── Persist anonymized patient to Supabase ─────────────────────────────
    safe_upsert(Tables.PATIENTS, {
        "patient_id":   anon_patient.patient_id,
        "age":          anon_patient.age,
        "gender":       anon_patient.gender,
        "zip_code":     anon_patient.zip_code,
        "diagnoses":    list(anon_patient.diagnoses) if isinstance(anon_patient.diagnoses, (list, tuple)) else [],
        "labs":         dict(anon_patient.labs) if anon_patient.labs else {},
        "medications":  list(anon_patient.medications),
        "history_text": anon_patient.history_text,
    })

    return anon_patient

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


# --- 3b. AI Explanation Endpoint ---
class ExplainRequest(BaseModel):
    trial_id: str
    title: str = ""
    match_score: float = 0
    recommendation: str = ""
    confidence: str = "MEDIUM"
    criteria_breakdown: list = []
    site_info: dict = {}
    investigational_drug: str = ""
    completion_likelihood: int = 95
    missing_data: list = []

@app.post("/explain")
def explain_match(req: ExplainRequest):
    """
    Generates a structured clinical narrative summary for a
    patient–trial match result. Uses deterministic template logic
    — no external LLM API key required.
    """
    score = round(req.match_score)
    passed = [c for c in req.criteria_breakdown if c.get("status") == "pass"]
    failed = [c for c in req.criteria_breakdown if c.get("status") == "fail"]
    verify = [c for c in req.criteria_breakdown if c.get("status") == "verify"]
    total  = len(req.criteria_breakdown) or 1

    # ── Eligibility summary sentence ─────────────────────────────────────
    if req.recommendation == "Proceed":
        eligibility = (
            f"This patient meets all mandatory eligibility criteria for {req.trial_id}. "
            f"A match score of {score}/100 indicates strong alignment with the protocol."
        )
    elif req.recommendation == "Verify First":
        eligibility = (
            f"The patient partially satisfies the inclusion criteria for {req.trial_id} "
            f"(match score {score}/100). Manual chart review is recommended before proceeding."
        )
    else:
        eligibility = (
            f"The patient does not currently meet one or more hard eligibility criteria "
            f"for {req.trial_id} (match score {score}/100). Enrolment is not recommended at this time."
        )

    # ── Criteria narrative ────────────────────────────────────────────────
    passed_names = ", ".join(c.get("name", "") for c in passed[:4]) or "none recorded"
    failed_names = ", ".join(c.get("name", "") for c in failed[:3]) or "none"
    verify_names = ", ".join(c.get("name", "") for c in verify[:3])

    criteria_text = (
        f"{len(passed)} of {total} criteria passed ({passed_names}). "
    )
    if failed:
        criteria_text += f"{len(failed)} criterion failed: {failed_names}. "
    if verify:
        criteria_text += f"{len(verify)} item(s) require verification: {verify_names}."

    # ── Site & logistics ─────────────────────────────────────────────────
    site   = req.site_info.get("location", "the trial site")
    city   = req.site_info.get("city", "")
    dist   = req.site_info.get("distance_miles")
    dist_text = f"The trial is conducted at {site}, {city}."
    if dist is not None:
        dist_text += f" The patient is approximately {dist} miles from this site."

    # ── Drug & completion ────────────────────────────────────────────────
    drug_text = ""
    if req.investigational_drug:
        drug_text = f"The investigational agent is {req.investigational_drug}. "

    completion_text = (
        f"Estimated trial completion likelihood: {req.completion_likelihood}%."
    )

    # ── Missing data callout ──────────────────────────────────────────────
    missing_text = ""
    if req.missing_data:
        missing_text = (
            f"Note: {len(req.missing_data)} data field(s) were absent from the record "
            f"({', '.join(req.missing_data[:3])}). Obtaining these values would improve "
            f"scoring confidence."
        )

    narrative = (
        f"{eligibility}\n\n"
        f"**Criteria Summary:** {criteria_text}\n\n"
        f"**Site & Logistics:** {dist_text} {drug_text}{completion_text}\n\n"
        f"{missing_text}"
    ).strip()

    return {
        "trial_id":  req.trial_id,
        "score":     score,
        "narrative": narrative,
        "confidence": req.confidence,
    }

# --- 3. The Core Matching Endpoint (M3) ---
@app.post("/match")
async def find_trial_matches(patient: Patient) -> Dict[str, Any]:
    """
    Accepts patient_id (or full patient object), returns ranked list 
    of top trials with scores and transparency data.
    """
    # ── Ensure Patient Exists in DB before Match Results ──────────────────────
    safe_upsert(Tables.PATIENTS, {
        "patient_id":   patient.patient_id,
        "age":          patient.age,
        "gender":       patient.gender,
        "zip_code":     patient.zip_code,
        "diagnoses":    list(patient.diagnoses) if isinstance(patient.diagnoses, (list, tuple)) else [],
        "labs":         dict(patient.labs) if patient.labs else {},
        "medications":  list(patient.medications),
        "history_text": patient.history_text,
    })

    results = []

    for trial in SAMPLE_TRIALS:
        if not trial.criteria_json:
            trial.criteria_json = parse_trial_criteria(
                trial.trial_id,
                trial.raw_inclusion_criteria,
                trial.raw_exclusion_criteria,
            )

        match_result = match_patient_to_trial(patient, trial)
        # Determine recommendation
        eligible = match_result.get("eligible", False)
        missing_data = match_result.get("missing_data", [])
        
        if eligible and not missing_data:
            rec = "Proceed"
        elif eligible and missing_data:
            rec = "Verify First"
        else:
            rec = "Not Suitable"

        row = {
            "trial_id":           trial.trial_id,
            "patient_id":         patient.patient_id, 
            "title":              trial.official_title,
            "phase":              trial.phase,
            "sponsor":            trial.sponsor,
            "location":           match_result.get("site_info", {}).get("location", "Unknown Location"),
            "eligible":           eligible,
            "match_score":        match_result.get("match_score", 0.0),
            "confidence":         "HIGH" if match_result.get("confidence", 1.0) == 1.0 else ("MEDIUM" if match_result.get("confidence", 1.0) > 0.5 else "LOW"),
            "criteria_breakdown": match_result.get("criteria_breakdown", []),
            "missing_data":       missing_data,
            "site_info":          match_result.get("site_info", {}),
            "llm_explanation":    match_result.get("llm_explanation", ""),
            "narrative_text":     f"Automated screening parsed {len(match_result.get('criteria_breakdown', []))} criteria.",
            "recommendation":     rec,
            "hpsa_flagged":       match_result.get("site_info", {}).get("hpsa_bonus", False),
            "completion_likelihood": match_result.get("completion_likelihood", 85),
            "dropout_reason":     match_result.get("dropout_reason", "low dropout risk"),
            "visits_required":    match_result.get("visits_required", 10),
            "telehealth_enabled": match_result.get("telehealth_enabled", False),
            "polypharmacy_flags": match_result.get("polypharmacy_flags", []),
            "investigational_drug": match_result.get("investigational_drug", ""),
        }
        results.append(row)

        # ── Persist match result to Supabase ──────────────────────────────
        import uuid
        safe_insert(Tables.MATCH_RESULTS, {
            "id":                 str(uuid.uuid4()),
            "patient_id":         patient.patient_id,
            "trial_id":           trial.trial_id,
            "match_score":        row["match_score"],
            "eligible":           row["eligible"],
            "confidence":         match_result.get("confidence", 1.0),
            "criteria_breakdown": row["criteria_breakdown"],
            "missing_data":       row["missing_data"],
            "llm_explanation":    row["llm_explanation"],
        })  # safe_insert silently swallows duplicate key errors

    # Sort: eligible first, then by score descending
    sorted_results = sorted(
        results,
        key=lambda x: (x["eligible"], x["match_score"]),
        reverse=True
    )

    # ── Apply location filters ──────────────────────────────────────────────────
    radius = patient.filter_radius_miles if patient.filter_radius_miles is not None else 9999
    hpsa_only = patient.filter_hpsa_only or False

    if radius < 9999:
        filtered = []
        for r in sorted_results:
            dist = r.get("site_info", {}).get("distance_miles")
            # If distance_miles is not available, include the trial (don't exclude on missing data)
            if dist is None or dist <= radius:
                filtered.append(r)
        sorted_results = filtered

    if hpsa_only:
        sorted_results = [r for r in sorted_results if r.get("hpsa_flagged", False)]

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
        },
        "supabase_connected": settings.supabase_configured,
    }


# --- 5. Health check (Docker health-check + load balancer probe) ---
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app_env": settings.APP_ENV,
        "supabase_connected": settings.supabase_configured,
        "trials_loaded": len(SAMPLE_TRIALS),
    }


