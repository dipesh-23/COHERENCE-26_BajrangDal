import operator
import re
import math
from typing import Dict, Any, List

# Assuming your models are defined in backend/models/
from models.patient import Patient
from models.trial import Trial
from modules.scorer import get_scorer
from modules.drug_interactions import check_drug_interactions

# In-memory audit log for the Hackathon 2026 Fairness Pitch
audit_log = []

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    if None in (lat1, lon1, lat2, lon2):
        return None
    R = 3958.8 # Earth radius in miles
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat/2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon/2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return round(R * c, 1)


def calculate_completion_likelihood(distance_miles, visits_required, telehealth_enabled):
    """
    Heuristic Dropout Predictor.
    Base: 95%. Penalizes for far distance and high visit burden. Rewards telehealth.
    Returns (score: int, reason: str)
    """
    score = 95.0
    reasons = []

    # Distance penalty
    if distance_miles is not None:
        if distance_miles > 150:
            score -= 30
            reasons.append(f"patient lives {distance_miles:.0f} miles from site")
        elif distance_miles > 75:
            score -= 18
            reasons.append(f"patient lives {distance_miles:.0f} miles from site")
        elif distance_miles > 30:
            score -= 8
            reasons.append(f"patient lives {distance_miles:.0f} miles from site")

    # Visit burden penalty
    if visits_required > 40:
        score -= 22
        reasons.append(f"trial requires {visits_required} visits")
    elif visits_required > 20:
        score -= 12
        reasons.append(f"trial requires {visits_required} visits")
    elif visits_required > 10:
        score -= 6
        reasons.append(f"trial requires {visits_required} visits")

    # Telehealth bonus
    if telehealth_enabled:
        score = min(score + 10, 95)
        reasons.append("telehealth option available")

    score = max(10, round(score))
    reason_text = "; ".join(reasons) if reasons else "low dropout risk"
    return score, reason_text

def evaluate_operator(op_str: str, patient_val: float, threshold_val: float) -> bool:
    """Helper to evaluate dynamic math operators from Member 2's parser."""
    ops = {
        ">": operator.gt,
        ">=": operator.ge,
        "<": operator.lt,
        "<=": operator.le,
        "=": operator.eq,
        "==": operator.eq
    }
    op_func = ops.get(op_str)
    if not op_func:
        return False
    return op_func(patient_val, threshold_val)

def check_keyword_in_history(keyword: str, text: str) -> bool:
    """Helper to check if a condition/drug exists in patient free-text."""
    if not text or not keyword:
        return False
    # Simple word-boundary regex check
    pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
    return bool(re.search(pattern, text.lower()))


def hard_filter(patient: Patient, criteria_json: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    M3 Core Engine: Evaluates dynamic CriteriaJSON logic trees.
    Returns structured results with clear reasons for every criterion.
    """
    results = []
    
    # Safely extract logic trees (default to empty lists if missing)
    inclusions = criteria_json.get("inclusion", [])
    exclusions = criteria_json.get("exclusion", [])

    # ---------------------------------------------------------
    # 1. Evaluate INCLUSION Criteria (Must pass all -> AND logic)
    # ---------------------------------------------------------
    for cond in inclusions:
        field = cond.get("field")
        
        if field == "age":
            c_min = cond.get("min", 0)
            c_max = cond.get("max", 120)
            passed = c_min <= patient.age <= c_max
            results.append({
                "name": "Age Requirement",
                "status": "pass" if passed else "fail",
                "detail": f"Age {patient.age} meets trial bounds ({c_min}-{c_max})." if passed else f"Age {patient.age} is outside required bounds ({c_min}-{c_max})."
            })
            
        elif field == "gender":
            req_gender = cond.get("value", "any").lower()
            passed = (req_gender == "any" or patient.gender.lower() == req_gender)
            results.append({
                "name": "Gender",
                "status": "pass" if passed else "fail",
                "detail": f"Patient gender ({patient.gender}) matches requirement." if passed else f"Trial requires {req_gender.title()}."
            })
            
        elif field == "diagnosis":
            req_codes = cond.get("values", [])
            patient_codes = [code.upper() for code in patient.diagnoses.keys()] if hasattr(patient.diagnoses, "keys") else [c.upper() for c in patient.diagnoses]
            passed = any(req in patient_codes for req in req_codes)
            joined_reqs = ", ".join(req_codes)
            results.append({
                "name": f"Diagnosis: {joined_reqs}",
                "status": "pass" if passed else "fail",
                "detail": f"Confirmed {joined_reqs} in patient record." if passed else f"Missing required diagnosis: {joined_reqs}."
            })
            
        elif field == "lab":
            lab_name = cond.get("name")
            patient_lab = patient.labs.get(lab_name)
            
            if not patient_lab:
                # Ethical Safeguard #3: Missing data is flagged, not failed.
                results.append({
                    "name": f"Lab: {lab_name}",
                    "status": "verify",
                    "detail": f"{lab_name} value not present in record—requires manual verification."
                })
            else:
                # Support multiple lab shapes:
                # - plain float: 8.2
                # - dict: {"value": 8.2, ...}
                # - object with .value attribute
                if isinstance(patient_lab, dict):
                    val = patient_lab.get("value")
                elif hasattr(patient_lab, "value"):
                    val = patient_lab.value
                else:
                    val = patient_lab

                passed = evaluate_operator(cond.get("operator"), float(val), float(cond.get("value")))
                results.append({
                    "name": f"Lab: {lab_name}",
                    "status": "pass" if passed else "fail",
                    "detail": f"{lab_name} ({val}) meets {cond.get('operator')} {cond.get('value')} requirement." if passed else f"{lab_name} ({val}) does not meet threshold."
                })

        elif field == "treatment":
            req_drug = cond.get("name", "")
            patient_meds = [m.lower() for m in patient.medications]
            passed = req_drug.lower() in patient_meds or check_keyword_in_history(req_drug, patient.history_text)
            results.append({
                "name": f"Prior Treatment: {req_drug}",
                "status": "pass" if passed else "fail",
                "detail": f"Found evidence of {req_drug} usage." if passed else f"No record of required treatment: {req_drug}."
            })

    # ---------------------------------------------------------
    # 2. Evaluate EXCLUSION Criteria (Any hit fails the patient -> OR logic)
    # ---------------------------------------------------------
    for cond in exclusions:
        field = cond.get("field")
        
        if field == "drug":
            ex_drug = cond.get("name", "")
            patient_meds = [m.lower() for m in patient.medications]
            conflict = ex_drug.lower() in patient_meds or check_keyword_in_history(ex_drug, patient.history_text)
            results.append({
                "name": f"Excluded Drug: {ex_drug}",
                "status": "fail" if conflict else "pass",
                "detail": f"Patient is currently taking excluded drug: {ex_drug}." if conflict else f"No conflict with {ex_drug}."
            })
            
        elif field in ["condition", "other"]:
            ex_cond = cond.get("name") or cond.get("value", "")
            # Look for the condition in the free-text history
            conflict = check_keyword_in_history(ex_cond, patient.history_text)
            results.append({
                "name": f"Excluded Condition/Criteria: {ex_cond}",
                "status": "fail" if conflict else "pass",
                "detail": f"Found evidence of excluded condition: {ex_cond}." if conflict else f"No evidence of {ex_cond}."
            })
            
        elif field == "status" and cond.get("name") == "pregnant":
            conflict = check_keyword_in_history("pregnant", patient.history_text) or check_keyword_in_history("pregnancy", patient.history_text)
            results.append({
                "name": "Exclusion: Pregnancy",
                "status": "fail" if conflict else "pass",
                "detail": "Record indicates active pregnancy." if conflict else "No evidence of pregnancy."
            })

    return results


def match_patient_to_trial(patient: Patient, trial: Trial) -> Dict[str, Any]:
    """
    Standardized /match Response utilizing Member 2's CriteriaJSON.
    Normalizes score to 0-100 and includes site/audit info[cite: 21, 31].
    """
    # 1. Ensure the trial has the parsed criteria logic tree
    criteria_json = getattr(trial, "criteria_json", {})
    if not criteria_json:
        # Fallback if the trial hasn't been processed by the NLP pipeline yet
        return {"eligible": False, "match_score": 0.0, "reasons": ["Trial criteria logic tree missing."]}

    # 2. Run structured dynamic hard filters 
    criteria_breakdown = hard_filter(patient, criteria_json)
    
    # 3. Check eligibility (fails if any mandatory filter is 'fail')
    is_eligible = not any(res["status"] == "fail" for res in criteria_breakdown)
    
    # 4. Calculate Confidence Penalty for missing data [cite: 37]
    missing_fields = [res["name"] for res in criteria_breakdown if res["status"] == "verify"]
    confidence = max(0.1, 1.0 - (len(missing_fields) * 0.15))

    # 5. Semantic Soft Matching (S-BiomedBERT) 
    score = 0.0
    if is_eligible:
        scorer = get_scorer()
        # Fallback to the raw criteria text if the combined full text isn't available
        raw_text = trial.full_criteria_text if hasattr(trial, 'full_criteria_text') else str(criteria_json.get("raw_text", ""))
        semantic_sim = scorer.compute_score(patient.medical_history if hasattr(patient, "medical_history") else patient.history_text, raw_text)
        
        # Normalize to 0-100 and weight by confidence
        score = round((semantic_sim * confidence) * 100, 2)
    else:
        # Ineligible patients still get a PARTIAL score based on criteria proportion passed
        # This shows % alignment even when hard filters fail — avoids all-zero results
        total_criteria = len(criteria_breakdown) or 1
        passed = sum(1 for r in criteria_breakdown if r["status"] == "pass")
        partial_ratio = passed / total_criteria
        # Scale 0–45: ineligible patients cap at 45 to clearly separate from eligible (46+)
        score = round(partial_ratio * 45 * confidence, 2)

    # 6. Site/Geographic Info [cite: 23]
    site = trial.sites[0] if trial.sites else None
    
    distance = None
    if site and site.lat and site.lng and patient.lat and patient.lng:
        distance = haversine_distance(patient.lat, patient.lng, site.lat, site.lng)
    
    site_info = {
        "location": site.facility if site else getattr(trial, "location", "Unknown"),
        "city": site.city if site else "Unknown",
        "state": site.state if site else "Unknown",
        "lat": site.lat if site else None,
        "lng": site.lng if site else None,
        "distance_miles": distance,
        "is_remote": getattr(trial, "is_remote", False),
        "hpsa_bonus": getattr(trial, "is_hpsa_zone", False) # Safeguard #1 
    }

    # 6b. Compute Dropout Predictor Score
    visits_required = getattr(trial, "visits_required", 10)
    telehealth_enabled = getattr(trial, "telehealth_enabled", False)
    completion_likelihood, dropout_reason = calculate_completion_likelihood(
        distance, visits_required, telehealth_enabled
    )

    # 6c. Polypharmacy Safety Check
    investigational_drug = getattr(trial, "investigational_drug", "")
    patient_medications = list(patient.medications) if patient.medications else []
    polypharmacy_flags = check_drug_interactions(investigational_drug, patient_medications)

    # 7. Audit Logging for Fairness Pitch 
    audit_log.append({
        "age_group": "Under 40" if patient.age < 40 else "Over 40",
        "gender": patient.gender,
        "eligible": is_eligible,
        "score": score,
        "hpsa_boosted": site_info["hpsa_bonus"]
    })

    return {
        "trial_id": trial.trial_id,
        "eligible": is_eligible,
        "match_score": score,
        "confidence": round(confidence, 2),
        "criteria_breakdown": criteria_breakdown,
        "missing_data": missing_fields,
        "site_info": site_info,
        "completion_likelihood": completion_likelihood,
        "dropout_reason": dropout_reason,
        "visits_required": visits_required,
        "telehealth_enabled": telehealth_enabled,
        "polypharmacy_flags": polypharmacy_flags,
        "investigational_drug": investigational_drug,
        "llm_explanation": "Match confirmed with data confidence adjustment." if is_eligible else "Ineligible based on hard criteria mismatch."
    }