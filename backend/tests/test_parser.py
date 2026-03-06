import pytest
from fastapi.testclient import TestClient

# Import the FastAPI app instance from backend/main.py
from backend.main import app

# Create a test client using the FastAPI app
client = TestClient(app)

def test_parse_criteria_endpoint():
    """
    Posts a sample inclusion/exclusion text to /parse/criteria
    and asserts the response structure matches CriteriaJSON.
    """
    
    # ── Test Payload ──────────────────────────────────────────────────────────
    payload = {
        "trial_id": "NCT99999999",
        "raw_inclusion_text": (
            "Patients aged 18 to 65 years with Type 2 Diabetes (ICD-10: E11.9). "
            "HbA1c > 7.0%. Prior treatment with metformin."
        ),
        "raw_exclusion_text": (
            "Current use of insulin. Pregnant women. "
            "History of myocardial infarction within the last 6 months. "
            "eGFR < 45 mL/min."
        )
    }

    # ── Send POST Request ─────────────────────────────────────────────────────
    response = client.post("/parse/criteria", json=payload)
    
    # ── Assertions ────────────────────────────────────────────────────────────
    # 1. Assert successful HTTP status
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    
    data = response.json()
    
    # 2. Assert all required CriteriaJSON keys exist
    expected_keys = ["trial_id", "inclusion", "exclusion", "logic", "thresholds", "raw_text"]
    for key in expected_keys:
        assert key in data, f"Response missing required key: '{key}'"
        
    # 3. Assert Trial ID matches input
    assert data["trial_id"] == "NCT99999999"
    
    # 4. Assert logic operators were properly set
    assert data["logic"]["inclusion_operator"] == "AND"
    assert data["logic"]["exclusion_operator"] == "OR"
    
    # 5. Assert extraction actually happened (at least one condition in each)
    assert len(data["inclusion"]) > 0, "No inclusion criteria extracted!"
    assert len(data["exclusion"]) > 0, "No exclusion criteria extracted!"
    
    # 6. Check a specific extraction happened correctly
    drugs_excluded = [cond.get("name") for cond in data["exclusion"] if cond.get("field") == "drug"]
    assert "insulin" in drugs_excluded or "insulin therapy" in drugs_excluded, "Failed to extract 'insulin' as excluded drug."
