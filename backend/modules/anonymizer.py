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
from pathlib import Path
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
    "MRN",            # Medical Record Number — custom recognizer
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
    "MRN":                "MRN",
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
            
            # Add explicit US Address regex for common street address formats
            # e.g., "123 Main St", "456 Oak Avenue Apt 2B"
            address_pattern = Pattern(
                name="address_pattern",
                regex=r"\b\d+\s+[A-Za-z0-9\s.,-]{2,30}\b(?i:\s+(?:st|street|ave|avenue|rd|road|blvd|boulevard|ln|lane|dr|drive|ct|court|way|pl|place|sq|square|ter|terrace|pkwy|parkway|hwy|highway))\b",
                score=0.75,
            )
            address_recognizer = PatternRecognizer(
                supported_entity="LOCATION",  # tokens become <LOCATION_N>
                patterns=[address_pattern],
            )
            registry.add_recognizer(address_recognizer)

            # ── MRN (Medical Record Number) custom recognizer ───────────────
            # Covers: MRN: 1234567 | MRN#1234567 | Medical Record Number: 123
            #         MR# 123456  | Patient ID: 1234567
            mrn_patterns = [
                Pattern(
                    name="mrn_colon",
                    regex=r"(?i)\bMRN\s*[:#]?\s*\d{4,10}\b",
                    score=0.95,
                ),
                Pattern(
                    name="mrn_full_label",
                    regex=r"(?i)\bmedical\s+record\s+(?:number|no\.?|num\.?)\s*[:#]?\s*\d{4,10}\b",
                    score=0.95,
                ),
                Pattern(
                    name="mrn_mr_hash",
                    regex=r"(?i)\bMR#\s*\d{4,10}\b",
                    score=0.90,
                ),
                Pattern(
                    name="mrn_patient_id",
                    regex=r"(?i)\bpatient\s+id\s*[:#]?\s*\d{4,10}\b",
                    score=0.85,
                ),
            ]
            mrn_recognizer = PatternRecognizer(
                supported_entity="MRN",
                patterns=mrn_patterns,
                context=["mrn", "medical record", "patient id", "record number"],
            )
            registry.add_recognizer(mrn_recognizer)
            
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


# ── Audit log ─────────────────────────────────────────────────────────────────
# Resolve path relative to this file: backend/data/audit.log
_AUDIT_LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "audit.log"

# Mapping from Presidio entity type → human-readable field label used in logs
_AUDIT_FIELD_LABEL: dict[str, str] = {
    "PERSON":            "NAME",
    "DATE_TIME":         "DATE",
    "PHONE_NUMBER":      "PHONE",
    "EMAIL_ADDRESS":     "EMAIL",
    "MRN":               "MRN",
    "LOCATION":          "LOCATION",
    "US_SSN":            "SSN",
    "US_DRIVER_LICENSE": "DL_ID",
    "MEDICAL_LICENSE":   "MED_ID",
    "URL":               "URL",
    "IP_ADDRESS":        "IP",
}


def log_audit_event(patient_id: str, fields_scrubbed: list[str]) -> None:
    """
    Append a single audit log entry to backend/data/audit.log.

    Format::
        [2026-03-06 09:00:01] | ACTION: PHI_ANONYMIZED | PATIENT: PT-00101 |
        FIELDS_SCRUBBED: NAME, PHONE | STATUS: SUCCESS

    Fails silently — never crashes the anonymisation pipeline.
    """
    try:
        import datetime
        _AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        fields_str = ", ".join(fields_scrubbed) if fields_scrubbed else "NONE"
        entry = (
            f"[{timestamp}] | ACTION: PHI_ANONYMIZED | PATIENT: {patient_id} | "
            f"FIELDS_SCRUBBED: {fields_str} | STATUS: SUCCESS\n"
        )
        with open(_AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(entry)
    except Exception:
        pass  # Never crash the pipeline due to a logging failure


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
    # Gracefully handle missing, null, or non-string history_text
    if patient.get("history_text") is None or not isinstance(patient.get("history_text"), str) or not patient["history_text"].strip():
        return copy.deepcopy(patient)

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

    # 5. Collect which PHI field types were scrubbed (de-duped, ordered)
    seen: set[str] = set()
    fields_scrubbed: list[str] = []
    for result in analysis_results:
        label = _AUDIT_FIELD_LABEL.get(result.entity_type)
        if label and label not in seen:
            seen.add(label)
            fields_scrubbed.append(label)

    # 6. Write audit log entry
    patient_id = patient.get("patient_id", "UNKNOWN")
    log_audit_event(patient_id, fields_scrubbed)

    # 7. Return a deep copy with only history_text replaced
    anonymised_patient = copy.deepcopy(patient)
    anonymised_patient["history_text"] = final_text
    return anonymised_patient


def parse_trial_pdf(file_path: str) -> dict[str, str]:
    """
    Extract text content from a PDF file using pdfplumber.

    Parameters
    ----------
    file_path : str
        Path to the clinical trial PDF document.

    Returns
    -------
    dict
        A dictionary containing:
        - 'title': A fallback title using the file name.
        - 'criteria_text': The complete extracted text from all pages.
        If the file cannot be opened or parsed, returns empty strings for both.
    """
    import logging
    
    try:
        import pdfplumber
    except ImportError:
        logging.error("pdfplumber is not installed. Run: pip install pdfplumber")
        return {"title": "", "criteria_text": ""}

    extracted_text = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    extracted_text.append(text)
    except FileNotFoundError:
        logging.error(f"PDF file not found at: {file_path}")
        return {"title": "", "criteria_text": ""}
    except Exception as e:
        logging.error(f"Error parsing PDF {file_path}: {e}")
        return {"title": "", "criteria_text": ""}

    full_text = "\n\n".join(extracted_text).strip()
    
    # Extracting a real title from pure text is unreliable, so we use the 
    # filename as a sensible default fallback.
    fallback_title = Path(file_path).stem.replace("_", " ").title() if full_text else ""

    return {
        "title": fallback_title,
        "criteria_text": full_text
    }


def fetch_trial_from_gov(nct_id: str) -> dict[str, str]:
    """
    Fetch and parse clinical trial metadata and eligibility criteria 
    from the ClinicalTrials.gov API v2.

    Parameters
    ----------
    nct_id : str
        The NCT identifier (e.g., 'NCT04521234').

    Returns
    -------
    dict
        A dictionary conforming roughly to the Trial model schema.
        If the trial cannot be found, returns {"error": "Trial not found"}.
    """
    import httpx
    import logging

    url = f"https://clinicaltrials.gov/api/v2/studies/{nct_id}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
    }
    
    try:
        with httpx.Client() as client:
            response = client.get(url, headers=headers, timeout=10.0)
            
        if response.status_code == 404:
            return {"error": "Trial not found"}
        response.raise_for_status()
        
        data = response.json()
        protocol = data.get("protocolSection", {})
        
        # Extract title
        ident = protocol.get("identificationModule", {})
        title = ident.get("officialTitle") or ident.get("briefTitle", "Unknown Title")
        
        # Extract phase
        design = protocol.get("designModule", {})
        phases = design.get("phases", ["N/A"])
        phase = phases[0] if phases else "N/A"
        
        # Extract sponsor
        sponsors = protocol.get("sponsorCollaboratorsModule", {})
        lead_sponsor = sponsors.get("leadSponsor", {})
        sponsor = lead_sponsor.get("name", "Unknown")
        
        # Extract location
        contacts = protocol.get("contactsLocationsModule", {})
        locations = contacts.get("locations", [])
        if locations:
            loc = locations[0]
            city = loc.get("city", "")
            country = loc.get("country", "")
            location_str = f"{city}, {country}".strip(", ")
        else:
            location_str = "Unknown"
            
        if not location_str:
            location_str = "Unknown"
            
        # Extract dates
        status = protocol.get("statusModule", {})
        start_date = status.get("startDateStruct", {}).get("date", "Unknown")
        end_date = status.get("completionDateStruct", {}).get("date", "Unknown")
        
        # Extract criteria
        eligibility = protocol.get("eligibilityModule", {})
        criteria_text = eligibility.get("eligibilityCriteria", "No criteria provided.")
        
        return {
            "trial_id": nct_id,
            "title": title,
            "phase": phase,
            "sponsor": sponsor,
            "location": location_str,
            "start_date": start_date,
            "end_date": end_date,
            "criteria_text": criteria_text
        }
        
    except httpx.HTTPStatusError as e:
        logging.error(f"HTTP error fetching trial {nct_id}: {e}")
        return {"error": "Trial not found"}
    except Exception as e:
        logging.error(f"Error fetching trial {nct_id}: {e}")
        return {"error": "An error occurred while fetching the trial"}


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
