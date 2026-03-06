import pytest
from modules.anonymizer import anonymize_patient

def test_anonymize_name():
    """Verify a patient dict with a name in history_text comes back with <NAME_1> instead."""
    patient = {
        "patient_id": "P001",
        "history_text": "Patient Jane Doe was seen today.",
        "diagnoses": ["E11.9"]
    }
    result = anonymize_patient(patient)
    
    # Assert name token is injected
    assert "<NAME_1>" in result["history_text"]
    # Assert original name is gone
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
    
    # Medical fields should be completely unchanged
    assert result["diagnoses"] == ["E11.9", "I10"]
    assert result["labs"] == {"HbA1c": 8.0, "eGFR": 65}
    assert result["medications"] == ["Metformin 500mg"]
    assert result["patient_id"] == "P003"
    
    # Text should still be anonymised
    assert "<NAME_1>" in result["history_text"]
    assert "<PHONE_1>" in result["history_text"]


def test_graceful_missing_or_empty_history():
    """Verify the function doesn't crash when history_text is empty or null."""
    # Test Empty String
    patient_empty = {
        "age": 30,
        "history_text": "   "  # Whitespace only
    }
    res_empty = anonymize_patient(patient_empty)
    assert res_empty["history_text"] == "   "
    assert res_empty["age"] == 30
    
    # Test Null (None)
    patient_null = {
        "age": 40,
        "history_text": None
    }
    res_null = anonymize_patient(patient_null)
    assert res_null["history_text"] is None
    assert res_null["age"] == 40
    
    # Test Missing Key Completely
    patient_missing = {
        "age": 50
    }
    res_missing = anonymize_patient(patient_missing)
    assert "history_text" not in res_missing
    assert res_missing["age"] == 50
