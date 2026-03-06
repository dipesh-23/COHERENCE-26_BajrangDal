"""
anonymizer.py — Microsoft Presidio 2.x PHI anonymisation pipeline.

Public API
----------
    anonymize_patient(patient: dict) -> dict
        Takes a full patient JSON dict, scans the `history_text` field for PHI,
        replaces each detected entity with a numbered token (e.g. <NAME_1>),
        and returns the dict with only `history_text` modified.

Detected entity types
---------------------
    PERSON, DATE_TIME, LOCATION, PHONE_NUMBER, EMAIL_ADDRESS,
    US_SSN, US_DRIVER_LICENSE, MEDICAL_LICENSE, URL, IP_ADDRESS

Dependencies
------------
    pip install presidio-analyzer presidio-anonymizer
    python -m spacy download en_core_web_lg   # or en_core_web_sm for lighter model
"""

from __future__ import annotations

import copy
import re
import sys
from typing import Any

# ── Presidio import guard ──────────────────────────────────────────────────────
try:
    from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
    from presidio_analyzer.nlp_engine import NlpEngineProvider
    from presidio_anonymizer import AnonymizerEngine
    from presidio_anonymizer.entities import OperatorConfig
except ImportError:
    print(
        "❌  Presidio libraries not found.\n"
        "    Run: pip install presidio-analyzer presidio-anonymizer\n"
        "    Then: python -m spacy download en_core_web_lg",
        file=sys.stderr,
    )
    raise

# ── PHI entity types to detect ─────────────────────────────────────────────────
PHI_ENTITIES: list[str] = [
    "PERSON",
    "DATE_TIME",
    "LOCATION",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "US_SSN",
    "US_DRIVER_LICENSE",
    "MEDICAL_LICENSE",
    "URL",
    "IP_ADDRESS",
]

# ── Token format: <ENTITY_TYPE_N> e.g. <NAME_1>, <DATE_1>, <LOCATION_2> ───────
# Map from Presidio entity type → friendlier token label
_ENTITY_LABEL: dict[str, str] = {
    "PERSON":             "NAME",
    "DATE_TIME":          "DATE",
    "LOCATION":           "LOCATION",
    "PHONE_NUMBER":       "PHONE",
    "EMAIL_ADDRESS":      "EMAIL",
    "US_SSN":             "SSN",
    "US_DRIVER_LICENSE":  "DL_ID",
    "MEDICAL_LICENSE":    "MED_ID",
    "URL":                "URL",
    "IP_ADDRESS":         "IP",
}

# ── Build Presidio engines once (module-level singleton) ───────────────────────
def _build_engines() -> tuple[AnalyzerEngine, AnonymizerEngine]:
    """
    Initialise the Presidio AnalyzerEngine with the spaCy NLP backend
    and return (analyzer, anonymizer) engines.

    Attempts en_core_web_lg first; falls back to en_core_web_sm if not found.
    """
    from presidio_analyzer import Pattern, PatternRecognizer

    for model in ("en_core_web_lg", "en_core_web_sm"):
        try:
            provider = NlpEngineProvider(nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [{"lang_code": "en", "model_name": model}],
            })
            nlp_engine = provider.create_engine()
            
            # Create a registry and load pre-defined recognizers
            registry = RecognizerRegistry()
            registry.load_predefined_recognizers()
            
            # Add explicit SSN regex to guarantee detection (some spaCy models miss it)
            ssn_pattern = Pattern(
                name="ssn_pattern",
                regex=r"\b\d{3}-\d{2}-\d{4}\b",
                score=0.85,
            )
            ssn_recognizer = PatternRecognizer(
                supported_entity="US_SSN",
                patterns=[ssn_pattern],
                context=["ssn", "social security"],
            )
            registry.add_recognizer(ssn_recognizer)
            
            analyzer = AnalyzerEngine(
                registry=registry,
                nlp_engine=nlp_engine,
                supported_languages=["en"],
            )
            anonymizer = AnonymizerEngine()
            return analyzer, anonymizer
        except OSError:
            continue

    raise RuntimeError(
        "No spaCy model found for Presidio.\n"
        "Run one of:\n"
        "  python -m spacy download en_core_web_lg\n"
        "  python -m spacy download en_core_web_sm"
    )


_analyzer, _anonymizer = _build_engines()


# ── Core anonymisation helpers ─────────────────────────────────────────────────

def _make_operator_configs(results: list) -> dict[str, OperatorConfig]:
    """
    Build per-entity-type OperatorConfig with numbered tokens.

    Example output tokens: <NAME_1>, <DATE_1>, <LOCATION_1>, <NAME_2> …

    Presidio's built-in 'replace' operator only supports a static replacement
    string, so we emit a placeholder here and do the numbering in a post-pass.
    """
    # Use a simple replace with the label so we can number them afterwards
    configs: dict[str, OperatorConfig] = {}
    for result in results:
        label = _ENTITY_LABEL.get(result.entity_type, result.entity_type)
        # Placeholder that our post-pass will number: <<NAME>>, <<DATE>>, …
        configs[result.entity_type] = OperatorConfig(
            "replace", {"new_value": f"<<{label}>>"}
        )
    return configs


def _number_tokens(text: str) -> str:
    """
    Convert <<ENTITY>> placeholders → <ENTITY_N> with per-type counters.

    e.g.  "<<NAME>> … <<DATE>> … <<NAME>>"
          → "<NAME_1> … <DATE_1> … <NAME_2>"
    """
    counters: dict[str, int] = {}

    def _replace(match: re.Match) -> str:
        label = match.group(1)
        counters[label] = counters.get(label, 0) + 1
        return f"<{label}_{counters[label]}>"

    return re.sub(r"<<([A-Z_]+)>>", _replace, text)


# ── Public API ─────────────────────────────────────────────────────────────────

def anonymize_patient(patient: dict[str, Any]) -> dict[str, Any]:
    """
    Anonymise the `history_text` field of a patient dict.

    Parameters
    ----------
    patient : dict
        A dict conforming to the Patient Pydantic model schema.

    Returns
    -------
    dict
        A deep copy of `patient` with `history_text` anonymised.
        All other fields (patient_id, age, diagnoses, labs, …) are untouched.

    Raises
    ------
    KeyError
        If `history_text` is not present in the patient dict.
    ValueError
        If `history_text` is not a string.
    """
    if "history_text" not in patient:
        raise KeyError("'history_text' key not found in patient dict.")
    if not isinstance(patient["history_text"], str):
        raise ValueError(f"'history_text' must be a str, got {type(patient['history_text'])}.")

    original_text: str = patient["history_text"]

    # 1. Detect PHI
    analysis_results = _analyzer.analyze(
        text=original_text,
        entities=PHI_ENTITIES,
        language="en",
    )

    if not analysis_results:
        # No PHI found — return a clean copy unchanged
        return copy.deepcopy(patient)

    # 2. Build operator configs (placeholder tokens)
    operator_configs = _make_operator_configs(analysis_results)

    # 3. Anonymise
    anonymised_result = _anonymizer.anonymize(
        text=original_text,
        analyzer_results=analysis_results,
        operators=operator_configs,
    )

    # 4. Number the placeholder tokens  <<NAME>> → <NAME_1>
    final_text = _number_tokens(anonymised_result.text)

    # 5. Return a deep copy with only history_text replaced
    anonymised_patient = copy.deepcopy(patient)
    anonymised_patient["history_text"] = final_text
    return anonymised_patient


# ── CLI convenience ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    sample = {
        "patient_id": "PT-00001",
        "age": 54,
        "gender": "Male",
        "zip_code": "94103",
        "diagnoses": ["E11.9", "I10"],
        "labs": {"HbA1c": 8.2, "eGFR": 75.0},
        "medications": ["Metformin 500mg"],
        "history_text": (
            "Patient John Smith, DOB 12/03/1970, living in San Francisco, CA. "
            "Referred by Dr. Emily Carter on 2024-01-15. "
            "Contact: john.smith@email.com or (415) 555-0198. "
            "54-year-old male with a 10-year history of Type 2 diabetes mellitus, "
            "hypertension, and stage 3 chronic kidney disease. "
            "Currently managed with Metformin and Lisinopril. "
            "SSN: 123-45-6789."
        ),
    }

    print("=== ORIGINAL history_text ===")
    print(sample["history_text"])

    result = anonymize_patient(sample)

    print("\n=== ANONYMISED history_text ===")
    print(result["history_text"])

    print("\n=== FULL ANONYMISED PATIENT (other fields untouched) ===")
    print(json.dumps(result, indent=2))
