"""
Hybrid Clinical Trial Matching Engine

Matches a patient profile against a clinical trial's inclusion criteria
using a combination of:
  1. Structured rule-based matching  (age, gender, ICD-10 codes, lab values)
  2. Weighted scoring per field
  3. Overall eligibility score (0.0 – 1.0) with per-field breakdown

Patient dict schema (expected keys):
    age         : int
    gender      : "male" | "female"
    icd10_codes : list[str]           e.g. ["E11.9", "I10"]
    lab_values  : dict[str, float]    e.g. {"HbA1c": 7.8, "eGFR": 65}
    treatments  : list[str]           e.g. ["metformin"]

Trial inclusion criteria dict schema:
    age_range          : {"min": int|None, "max": int|None}
    gender             : "male" | "female" | "any"
    icd10_codes        : list[str]
    lab_values         : list[{"lab", "operator", "value", "unit"}]
    prior_treatments   : list[str]
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Any
import operator as op_module


# ── Operator helpers ────────────────────────────────────────────────────────
_OPS = {
    ">":  op_module.gt,
    "<":  op_module.lt,
    ">=": op_module.ge,
    "<=": op_module.le,
    "=":  op_module.eq,
}


# ── Per-field weights (must sum to 1.0) ────────────────────────────────────
DEFAULT_WEIGHTS = {
    "age":              0.20,
    "gender":           0.10,
    "icd10_codes":      0.30,
    "lab_values":       0.25,
    "prior_treatments": 0.15,
}


@dataclass
class FieldResult:
    """Detailed result for one matching field."""
    field:       str
    matched:     bool
    weight:      float
    score:       float          # weight * matched
    reason:      str            # human-readable explanation


@dataclass
class MatchResult:
    """Overall result for one patient ↔ trial pair."""
    patient_id:  str
    trial_id:    str
    total_score: float                   # 0.0 – 1.0
    eligible:    bool                    # score >= threshold
    breakdown:   list[FieldResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["breakdown"] = [asdict(f) for f in self.breakdown]
        return d


# ---------------------------------------------------------------------------
# Field matchers
# ---------------------------------------------------------------------------

def _match_age(patient_age: int | None, criteria: dict) -> FieldResult:
    weight = DEFAULT_WEIGHTS["age"]

    if patient_age is None:
        return FieldResult("age", False, weight, 0.0, "Patient age unknown")

    min_age = criteria.get("min")
    max_age = criteria.get("max")

    below_min = min_age is not None and patient_age < min_age
    above_max = max_age is not None and patient_age > max_age

    if below_min:
        return FieldResult("age", False, weight, 0.0,
                           f"Age {patient_age} < required min {min_age}")
    if above_max:
        return FieldResult("age", False, weight, 0.0,
                           f"Age {patient_age} > required max {max_age}")

    return FieldResult("age", True, weight, weight,
                       f"Age {patient_age} within [{min_age}, {max_age}]")


def _match_gender(patient_gender: str | None, required: str) -> FieldResult:
    weight = DEFAULT_WEIGHTS["gender"]

    if required == "any":
        return FieldResult("gender", True, weight, weight,
                           "Trial accepts any gender")

    if patient_gender is None:
        return FieldResult("gender", False, weight, 0.0, "Patient gender unknown")

    matched = patient_gender.lower() == required.lower()
    reason = (f"Patient gender '{patient_gender}' matches '{required}'"
              if matched else
              f"Patient gender '{patient_gender}' ≠ required '{required}'")
    return FieldResult("gender", matched, weight, weight if matched else 0.0, reason)


def _match_icd10(patient_codes: list[str], required_codes: list[str]) -> FieldResult:
    weight = DEFAULT_WEIGHTS["icd10_codes"]

    if not required_codes:
        return FieldResult("icd10_codes", True, weight, weight,
                           "No ICD-10 codes required by trial")

    # Normalise: uppercase, strip whitespace
    p_codes = {c.upper().strip() for c in patient_codes}
    r_codes = [c.upper().strip() for c in required_codes]

    hits   = [c for c in r_codes if c in p_codes]
    misses = [c for c in r_codes if c not in p_codes]

    # Partial credit: proportion of required codes matched
    ratio   = len(hits) / len(r_codes)
    matched = ratio == 1.0

    reason = f"Matched {len(hits)}/{len(r_codes)} ICD codes: hits={hits} misses={misses}"
    return FieldResult("icd10_codes", matched, weight, round(weight * ratio, 4), reason)


def _match_labs(patient_labs: dict[str, float],
                required_labs: list[dict]) -> FieldResult:
    weight = DEFAULT_WEIGHTS["lab_values"]

    if not required_labs:
        return FieldResult("lab_values", True, weight, weight,
                           "No lab requirements")

    results    = []
    all_passed = True

    for req in required_labs:
        lab_name = req["lab"]
        operator = req["operator"]
        threshold = req["value"]
        unit      = req.get("unit", "")

        # Look up patient value (case-insensitive key lookup)
        patient_val = next(
            (v for k, v in patient_labs.items() if k.lower() == lab_name.lower()),
            None,
        )

        if patient_val is None:
            results.append(f"{lab_name}: not found in patient record")
            all_passed = False
            continue

        comparator = _OPS.get(operator)
        if comparator is None:
            results.append(f"{lab_name}: unknown operator '{operator}'")
            continue

        passed = comparator(patient_val, threshold)
        symbol = "✓" if passed else "✗"
        results.append(
            f"{symbol} {lab_name}={patient_val}{unit} {operator} {threshold}{unit}"
        )
        if not passed:
            all_passed = False

    score  = weight if all_passed else (weight * 0.5 if len(results) > 0 else 0.0)
    return FieldResult("lab_values", all_passed, weight, round(score, 4),
                       " | ".join(results))


def _match_treatments(patient_treatments: list[str],
                      required_treatments: list[str]) -> FieldResult:
    weight = DEFAULT_WEIGHTS["prior_treatments"]

    if not required_treatments:
        return FieldResult("prior_treatments", True, weight, weight,
                           "No treatment requirements")

    p_set = {t.lower().strip() for t in patient_treatments}
    r_list = [t.lower().strip() for t in required_treatments]

    hits   = [t for t in r_list if t in p_set]
    misses = [t for t in r_list if t not in p_set]
    ratio  = len(hits) / len(r_list)
    matched = ratio == 1.0

    reason = f"Matched {len(hits)}/{len(r_list)} treatments: hits={hits} misses={misses}"
    return FieldResult("prior_treatments", matched, weight,
                       round(weight * ratio, 4), reason)


# ---------------------------------------------------------------------------
# Main matching function
# ---------------------------------------------------------------------------

def match_patient_to_trial(
    patient:   dict[str, Any],
    trial:     dict[str, Any],
    threshold: float = 0.6,
) -> MatchResult:
    """
    Compute an eligibility score for a patient against a trial's inclusion criteria.

    Parameters
    ----------
    patient : dict
        Keys: age, gender, icd10_codes, lab_values, treatments
    trial : dict
        Keys: trial_id, inclusion_criteria (with age_range, gender,
              icd10_codes, lab_values, prior_treatments)
    threshold : float
        Minimum score (0–1) to be considered eligible. Default 0.6.

    Returns
    -------
    MatchResult
    """
    criteria = trial.get("inclusion_criteria", {})

    field_results = [
        _match_age(patient.get("age"), criteria.get("age_range", {})),
        _match_gender(patient.get("gender"), criteria.get("gender", "any")),
        _match_icd10(patient.get("icd10_codes", []), criteria.get("icd10_codes", [])),
        _match_labs(patient.get("lab_values", {}), criteria.get("lab_values", [])),
        _match_treatments(patient.get("treatments", []),
                          criteria.get("prior_treatments", [])),
    ]

    total = round(sum(f.score for f in field_results), 4)
    eligible = total >= threshold

    return MatchResult(
        patient_id  = patient.get("id", "unknown"),
        trial_id    = trial.get("trial_id", "unknown"),
        total_score = total,
        eligible    = eligible,
        breakdown   = field_results,
    )


def rank_trials(
    patient: dict[str, Any],
    trials:  list[dict[str, Any]],
    threshold: float = 0.6,
) -> list[MatchResult]:
    """
    Match a patient against multiple trials and return ranked results.

    Parameters
    ----------
    patient   : dict — patient profile
    trials    : list of trial dicts
    threshold : float — eligibility cutoff

    Returns
    -------
    list[MatchResult] sorted by total_score descending
    """
    results = [match_patient_to_trial(patient, t, threshold) for t in trials]
    return sorted(results, key=lambda r: r.total_score, reverse=True)


# ---------------------------------------------------------------------------
# Smoke-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json

    # ── Sample patient ───────────────────────────────────────────────────────
    patient = {
        "id":          "patient_001",
        "age":          55,
        "gender":      "male",
        "icd10_codes": ["E11.9", "I10"],
        "lab_values":  {"HbA1c": 7.8, "eGFR": 72},
        "treatments":  ["metformin"],
    }

    # ── Sample trials ────────────────────────────────────────────────────────
    trials = [
        {
            "trial_id": "NCT-001",
            "name":     "Type 2 Diabetes Metformin Study",
            "inclusion_criteria": {
                "age_range":         {"min": 40, "max": 70},
                "gender":            "any",
                "icd10_codes":       ["E11.9"],
                "lab_values":        [{"lab": "HbA1c", "operator": ">", "value": 7.0, "unit": "%"}],
                "prior_treatments":  ["metformin"],
            },
        },
        {
            "trial_id": "NCT-002",
            "name":     "Cardiovascular Risk Reduction Trial",
            "inclusion_criteria": {
                "age_range":         {"min": 50, "max": 80},
                "gender":            "male",
                "icd10_codes":       ["I10", "E11.9", "E78.5"],   # includes dyslipidaemia
                "lab_values":        [{"lab": "eGFR", "operator": ">=", "value": 60, "unit": "mL/min"}],
                "prior_treatments":  [],
            },
        },
        {
            "trial_id": "NCT-003",
            "name":     "Paediatric Asthma Study",
            "inclusion_criteria": {
                "age_range":         {"min": 6, "max": 17},
                "gender":            "any",
                "icd10_codes":       ["J45.9"],
                "lab_values":        [],
                "prior_treatments":  [],
            },
        },
    ]

    print("=" * 60)
    print("MATCHER SMOKE-TEST")
    print("=" * 60)
    print(f"Patient: {patient['id']}  age={patient['age']}  "
          f"gender={patient['gender']}  ICD={patient['icd10_codes']}")
    print()

    ranked = rank_trials(patient, trials)
    for r in ranked:
        print(f"{'✅ ELIGIBLE' if r.eligible else '❌ NOT ELIGIBLE'}  "
              f"[{r.trial_id}]  score={r.total_score:.2f}")
        for f in r.breakdown:
            status = "✓" if f.matched else "✗"
            print(f"    {status} {f.field:<20} score={f.score:.2f}  {f.reason}")
        print()
