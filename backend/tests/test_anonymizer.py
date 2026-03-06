import io
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from modules.anonymizer import anonymize_patient, fetch_trial_from_gov
from main import app

client = TestClient(app)


# ── Existing tests ─────────────────────────────────────────────────────────────

def test_anonymize_name():
    """Verify a patient dict with a name in history_text comes back with <NAME_1> instead."""
    patient = {
        "patient_id": "P001",
        "history_text": "Patient Jane Doe was seen today.",
        "diagnoses": ["E11.9"]
    }
    result = anonymize_patient(patient)
    assert "<NAME_1>" in result["history_text"]
    assert "Jane Doe" not in result["history_text"]


def test_anonymize_phone():
    """Verify a phone number in history_text is replaced with a token."""
    patient = {
        "patient_id": "P002",
        "history_text": "Please call her at 555-123-4567 regarding the lab results.",
    }
    result = anonymize_patient(patient)
    assert "<PHONE_1>" in result["history_text"]
    assert "555-123-4567" not in result["history_text"]


def test_medical_fields_untouched():
    """Verify the medical fields (diagnoses, labs, medications) are NOT changed."""
    patient = {
        "patient_id": "P003",
        "diagnoses": ["E11.9", "I10"],
        "labs": {"HbA1c": 8.0, "eGFR": 65},
        "medications": ["Metformin 500mg"],
        "history_text": "Patient Jane has diabetes and hypertension. Call 555-123-0100."
    }
    result = anonymize_patient(patient)
    assert result["diagnoses"] == ["E11.9", "I10"]
    assert result["labs"] == {"HbA1c": 8.0, "eGFR": 65}
    assert result["medications"] == ["Metformin 500mg"]
    assert result["patient_id"] == "P003"
    assert "<NAME_1>" in result["history_text"]
    assert "<PHONE_1>" in result["history_text"]


def test_graceful_missing_or_empty_history():
    """Verify the function doesn't crash when history_text is empty or null."""
    res_empty = anonymize_patient({"age": 30, "history_text": "   "})
    assert res_empty["history_text"] == "   "

    res_null = anonymize_patient({"age": 40, "history_text": None})
    assert res_null["history_text"] is None

    res_missing = anonymize_patient({"age": 50})
    assert "history_text" not in res_missing


# ── New tests ──────────────────────────────────────────────────────────────────

def test_mrn_stripped():
    """MRN patterns should be replaced with <MRN_1> token."""
    patient = {
        "patient_id": "P010",
        "history_text": "Patient John Smith MRN: 7654321, Type 2 Diabetes.",
    }
    result = anonymize_patient(patient)

    assert "<MRN_1>" in result["history_text"], "Expected <MRN_1> in output"
    assert "7654321" not in result["history_text"], "Raw MRN number should be gone"


def test_audit_log_created():
    """Running anonymize_patient() should create/append to audit.log with the patient_id."""
    AUDIT_LOG = Path(__file__).resolve().parent.parent / "data" / "audit.log"

    patient = {
        "patient_id": "AUDIT-TEST-001",
        "history_text": "Patient Bob Brown MRN: 9990001, phone 212-555-0199.",
    }
    anonymize_patient(patient)

    # File must exist
    assert AUDIT_LOG.exists(), "audit.log was not created"

    content = AUDIT_LOG.read_text(encoding="utf-8")

    # Patient ID must appear in the log
    assert "AUDIT-TEST-001" in content, "patient_id missing from audit.log"
    # Audit action must be present
    assert "PHI_ANONYMIZED" in content, "PHI_ANONYMIZED action missing from audit.log"


def test_fetch_trial_from_gov():
    """Fetching a known NCT ID from ClinicalTrials.gov should return a valid trial dict.
    
    Skips automatically if the API is unreachable (CI / network-less environments).
    """
    result = fetch_trial_from_gov("NCT04521234")

    # Skip test gracefully if the API is down or blocked (e.g. CI, no internet)
    if "error" in result:
        pytest.skip(f"ClinicalTrials.gov API unavailable: {result['error']}")

    # Required keys must be present
    for key in ("trial_id", "title", "criteria_text"):
        assert key in result, f"Missing key: {key}"

    # NCT ID should echo back correctly
    assert result["trial_id"] == "NCT04521234"

    # Criteria text must not be empty
    assert result["criteria_text"].strip() != "", "criteria_text should not be empty"


def test_bulk_upload():
    """POST /ingest/patients/bulk should process all rows and anonymise history_text."""
    csv_content = (
        "patient_id,age,gender,zip_code,diagnoses,medications,HbA1c,eGFR,creatinine,history_text\n"
        "BLK-001,52,Male,10001,E11.9,Metformin 500mg,8.1,72.0,1.0,"
        "Patient Tom Adams MRN: 1234001 phone 212-555-0101.\n"
        "BLK-002,60,Female,94103,E11.9|I10,Insulin 20 units,9.2,58.0,1.4,"
        "Jane Roe DOB 01/01/1964 email jane@test.com.\n"
        "BLK-003,45,Male,60601,E11.9,Metformin 1000mg,7.4,85.0,0.9,"
        "Patient Mike Lee MR# 5550002 lives at 789 Pine Street.\n"
    )

    response = client.post(
        "/ingest/patients/bulk",
        files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )

    assert response.status_code == 200, f"Unexpected status: {response.json()}"
    body = response.json()

    assert body["total_uploaded"] == 3, "Expected 3 rows uploaded"
    assert body["failed"] == 0, f"Expected 0 failures, got {body['failed']}"
    assert len(body["patients"]) == 3

    # All history_text fields must be anonymised (no raw MRNs/names)
    for patient in body["patients"]:
        text = patient["history_text"]
        assert "MRN" not in text or "<MRN_" in text, "Raw MRN found in anonymised output"

