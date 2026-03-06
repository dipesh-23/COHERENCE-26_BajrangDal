import operator
import re
from typing import Dict, Any, List

# Assuming your models are defined in backend/models/
from models.patient import Patient
from models.trial import Trial
from modules.scorer import get_scorer

# In-memory audit log for the Hackathon 2026 Fairness Pitch
audit_log = []

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
                "criterion": "Age Requirement",
                "status": "pass" if passed else "fail",
                "reason": f"Age {patient.age} meets trial bounds ({c_min}-{c_max})." if passed else f"Age {patient.age} is outside required bounds ({c_min}-{c_max})."
            })
            
        elif field == "gender":
            req_gender = cond.get("value", "any").lower()
            passed = (req_gender == "any" or patient.gender.lower() == req_gender)
            results.append({
                "criterion": "Gender",
                "status": "pass" if passed else "fail",
                "reason": f"Patient gender ({patient.gender}) matches requirement." if passed else f"Trial requires {req_gender.title()}."
            })
            
        elif field == "diagnosis":
            req_codes = cond.get("values", [])
            patient_codes = [code.upper() for code in patient.diagnoses.keys()] if hasattr(patient.diagnoses, "keys") else [c.upper() for c in patient.diagnoses]
            passed = any(req in patient_codes for req in req_codes)
            joined_reqs = ", ".join(req_codes)
            results.append({
                "criterion": f"Diagnosis: {joined_reqs}",
                "status": "pass" if passed else "fail",
                "reason": f"Confirmed {joined_reqs} in patient record." if passed else f"Missing required diagnosis: {joined_reqs}."
            })
            
        elif field == "lab":
            lab_name = cond.get("name")
            patient_lab = patient.labs.get(lab_name)
            
            if not patient_lab:
                # Ethical Safeguard #3: Missing data is flagged, not failed.
                results.append({
                    "criterion": f"Lab: {lab_name}",
                    "status": "verify",
                    "reason": f"{lab_name} value not present in record—requires manual verification."
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
                    "criterion": f"Lab: {lab_name}",
                    "status": "pass" if passed else "fail",
                    "reason": f"{lab_name} ({val}) meets {cond.get('operator')} {cond.get('value')} requirement." if passed else f"{lab_name} ({val}) does not meet threshold."
                })

        elif field == "treatment":
            req_drug = cond.get("name", "")
            patient_meds = [m.lower() for m in patient.medications]
            passed = req_drug.lower() in patient_meds or check_keyword_in_history(req_drug, patient.history_text)
            results.append({
                "criterion": f"Prior Treatment: {req_drug}",
                "status": "pass" if passed else "fail",
                "reason": f"Found evidence of {req_drug} usage." if passed else f"No record of required treatment: {req_drug}."
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
                "criterion": f"Excluded Drug: {ex_drug}",
                "status": "fail" if conflict else "pass",
                "reason": f"Patient is currently taking excluded drug: {ex_drug}." if conflict else f"No conflict with {ex_drug}."
            })
            
        elif field in ["condition", "other"]:
            ex_cond = cond.get("name") or cond.get("value", "")
            # Look for the condition in the free-text history
            conflict = check_keyword_in_history(ex_cond, patient.history_text)
            results.append({
                "criterion": f"Excluded Condition/Criteria: {ex_cond}",
                "status": "fail" if conflict else "pass",
                "reason": f"Found evidence of excluded condition: {ex_cond}." if conflict else f"No evidence of {ex_cond}."
            })
            
        elif field == "status" and cond.get("name") == "pregnant":
            conflict = check_keyword_in_history("pregnant", patient.history_text) or check_keyword_in_history("pregnancy", patient.history_text)
            results.append({
                "criterion": "Exclusion: Pregnancy",
                "status": "fail" if conflict else "pass",
                "reason": "Record indicates active pregnancy." if conflict else "No evidence of pregnancy."
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
    missing_fields = [res["criterion"] for res in criteria_breakdown if res["status"] == "verify"]
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

    # 6. Site/Geographic Info [cite: 23]
    site_info = {
        "location": getattr(trial, "location", "Unknown"),
        "is_remote": getattr(trial, "is_remote", False),
        "hpsa_bonus": getattr(trial, "is_hpsa_zone", False) # Safeguard #1 
    }

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
        "llm_explanation": "Match confirmed with data confidence adjustment." if is_eligible else "Ineligible based on hard criteria mismatch."
    }