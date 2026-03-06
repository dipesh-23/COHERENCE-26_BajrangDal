from models.patient import Patient
from models.trial import Trial
from modules.scorer import get_scorer

def hard_filter(patient: Patient, trial: Trial) -> tuple[bool, list]:
    reasons = []
    
    # We now use the combined property from your new Trial model
    criteria = trial.full_criteria_text.lower()
    
    # 1. Age Check (Using the structured fields in the Trial model!)
    if patient.age < trial.min_age:
        reasons.append(f"Patient age ({patient.age}) is below minimum ({trial.min_age}).")
    if patient.age > trial.max_age:
        reasons.append(f"Patient age ({patient.age}) is above maximum ({trial.max_age}).")
        
    # 2. Diagnosis Check (Using the structured fields)
    if trial.required_diagnoses:
        # patient.diagnoses is a Dict[str, date], so we look at the keys
        patient_codes = [code.upper() for code in patient.diagnoses.keys()]
        has_required = any(req in patient_codes for req in trial.required_diagnoses)
        if not has_required:
            reasons.append(f"Missing required diagnosis: {', '.join(trial.required_diagnoses)}")

    # 3. Lab Rule Example (Fallback to text check for now)
    if "hba1c > 7" in criteria:
        patient_hba1c = patient.labs.get("HbA1c")
        if patient_hba1c and patient_hba1c.value <= 7.0:
            reasons.append(f"HbA1c is {patient_hba1c.value}%, but trial requires > 7.0%.")

    return (len(reasons) == 0, reasons)


def match_patient_to_trial(patient: Patient, trial: Trial) -> dict:
    eligible, reasons = hard_filter(patient, trial)
    
    if not eligible:
        return {"eligible": False, "score": 0.0, "reasons": reasons}

    scorer = get_scorer()
    # Pass the newly combined text into the NLP Scorer
    score = scorer.compute_score(patient.medical_history, trial.full_criteria_text)
    
    return {"eligible": True, "score": score, "reasons": []}