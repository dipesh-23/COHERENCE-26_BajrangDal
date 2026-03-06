from pydantic import BaseModel, Field
from typing import List



class Patient(BaseModel):
    """Represents a patient profile used for clinical trial matching."""

    patient_id: str = Field(
        ...,
        description="Unique identifier for the patient.",
        json_schema_extra={"example": "PT-00123"},
    )
    age: int = Field(
        ...,
        ge=0,
        le=150,
        description="Patient's age in years.",
        json_schema_extra={"example": 54},
    )
    gender: str = Field(
        ...,
        description="Patient's gender (e.g. 'Male', 'Female', 'Other').",
        json_schema_extra={"example": "Male"},
    )
    zip_code: str = Field(
        ...,
        description="Patient's residential ZIP code.",
        json_schema_extra={"example": "94103"},
    )
    diagnoses: List[str] = Field(
        ...,
        description="List of ICD-10 diagnosis codes.",
        json_schema_extra={"example": ["E11.9", "I10", "N18.3"]},
    )
    labs: dict[str, float] = Field(
        ...,
        description="Dictionary of lab test names to their numeric values.",
        json_schema_extra={
            "example": {
                "HbA1c": 8.2,
                "eGFR": 75.0,
                "creatinine": 1.1,
            }
        },
    )
    medications: List[str] = Field(
        ...,
        description="List of current medications the patient is taking.",
        json_schema_extra={
            "example": ["Metformin 500mg", "Lisinopril 10mg", "Atorvastatin 20mg"]
        },
    )
    history_text: str = Field(
        ...,
        description="Free-text narrative of the patient's relevant medical history.",
        json_schema_extra={
            "example": (
                "54-year-old male with a 10-year history of Type 2 diabetes mellitus, "
                "stage 3 chronic kidney disease, and hypertension. Currently managed with "
                "oral hypoglycaemics and ACE inhibitor. No prior cardiovascular events."
            )
        },
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "patient_id": "PT-00123",
                "age": 54,
                "gender": "Male",
                "zip_code": "94103",
                "diagnoses": ["E11.9", "I10", "N18.3"],
                "labs": {
                    "HbA1c": 8.2,
                    "eGFR": 75.0,
                    "creatinine": 1.1,
                },
                "medications": [
                    "Metformin 500mg",
                    "Lisinopril 10mg",
                    "Atorvastatin 20mg",
                ],
                "history_text": (
                    "54-year-old male with a 10-year history of Type 2 diabetes mellitus, "
                    "stage 3 chronic kidney disease, and hypertension. Currently managed with "
                    "oral hypoglycaemics and ACE inhibitor. No prior cardiovascular events."
                ),
            }
        }
    }