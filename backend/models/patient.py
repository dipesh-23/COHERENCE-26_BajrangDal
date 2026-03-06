from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Dict, Optional, Union
from datetime import date
from enum import Enum

# 1. Standardized Enums to prevent string typos
class GenderIdentity(str, Enum):
    MALE = "Male"
    FEMALE = "Female"
    NON_BINARY = "Non-binary"
    TRANSGENDER = "Transgender"
    OTHER = "Other"
    PREFER_NOT_TO_SAY = "Prefer not to say"

class Ethnicity(str, Enum):
    HISPANIC = "Hispanic or Latino"
    NOT_HISPANIC = "Not Hispanic or Latino"
    UNKNOWN = "Unknown"

# 2. Structured Lab Result to handle Units
class LabObservation(BaseModel):
    value: float
    unit: str # e.g., "mg/dL", "mmol/mol"
    observation_date: Optional[date] = None

    @field_validator('unit')
    @classmethod
    def validate_unit(cls, v):
        allowed = ['mg/dL', 'mmol/L', '%', 'g/dL', 'mL/min/1.73m2', 'U/L']
        if v not in allowed:
            # In a real app, you'd use a unit conversion library here
            pass 
        return v

# 3. The Master Patient Model
class Patient(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    # --- Metadata ---
    patient_id: str = Field(..., pattern=r"^[A-Z0-9-]{5,15}$")
    created_at: date = Field(default_factory=date.today)

    # --- Demographics ---
    age: int = Field(..., ge=0, le=120)
    gender: GenderIdentity
    ethnicity: Optional[Ethnicity] = Ethnicity.UNKNOWN
    zip_code: str = Field(..., pattern=r"^\d{5}$")

    # --- Clinical Structured Data ---
    # Using a dict where key is ICD-10 code and value is date of diagnosis
    diagnoses: Dict[str, date] = Field(
        ..., 
        description="Map of ICD-10 codes to the date they were first recorded."
    )
    
    # Using the LabObservation class for better precision
    labs: Dict[str, LabObservation] = Field(
        default_factory=dict,
        description="Latest lab results with units and dates."
    )
    
    medications: List[str] = Field(
        default_factory=list, 
        description="Active medication list (Generic names preferred)."
    )

    # --- Narrative Data (For NLP/Scoring) ---
    medical_history: str = Field(
        ..., 
        min_length=20, 
        description="Comprehensive clinical narrative for semantic similarity matching."
    )

    # --- Validation Logic ---
    @field_validator('diagnoses')
    @classmethod
    def validate_icd10_format(cls, v):
        import re
        pattern = re.compile(r"^[A-Z]\d{2}(\.\d{1,2})?$")
        for code in v.keys():
            if not pattern.match(code):
                raise ValueError(f"Invalid ICD-10 format: {code}")
        return v

    def get_hba1c(self) -> Optional[float]:
        """Helper to safely retrieve common values."""
        return self.labs.get("HbA1c").value if "HbA1c" in self.labs else None