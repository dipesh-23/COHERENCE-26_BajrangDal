from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Dict, Optional
from datetime import date
from enum import Enum

# 1. Standardized Enums for Trial Metadata
class TrialPhase(str, Enum):
    PHASE1 = "Phase 1"
    PHASE2 = "Phase 2"
    PHASE3 = "Phase 3"
    PHASE4 = "Phase 4"
    EARLY_PHASE1 = "Early Phase 1"
    NA = "N/A"

class TrialStatus(str, Enum):
    RECRUITING = "Recruiting"
    ACTIVE_NOT_RECRUITING = "Active, not recruiting"
    COMPLETED = "Completed"
    TERMINATED = "Terminated"
    WITHDRAWN = "Withdrawn"

# 2. Structured Geographic Information
class TrialSite(BaseModel):
    facility: str
    city: str
    state: Optional[str] = None
    country: str
    zip_code: str = Field(..., pattern=r"^\d{5}$")
    contact_email: Optional[str] = None

# 3. The Master Trial Model
class Trial(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, use_enum_values=True)

    # --- Identifiers & Metadata ---
    trial_id: str = Field(..., pattern=r"^NCT\d{8}$", description="ClinicalTrials.gov NCT ID")
    official_title: str = Field(..., min_length=10)
    brief_summary: str
    phase: TrialPhase
    status: TrialStatus
    sponsor: str
    
    # --- Dates ---
    start_date: date
    primary_completion_date: Optional[date] = None

    # --- Geography ---
    sites: List[TrialSite] = Field(default_factory=list)

    # --- Structured Eligibility (The "Hard Rules") ---
    min_age: int = Field(default=0, ge=0)
    max_age: int = Field(default=120, le=120)
    gender_requirement: str = Field(default="All", description="Male, Female, or All")
    
    # Required ICD-10 codes (Inclusion)
    required_diagnoses: List[str] = Field(default_factory=list)
    
    # Forbidden ICD-10 codes (Exclusion)
    excluded_diagnoses: List[str] = Field(default_factory=list)

    # Structured Lab Thresholds (Inclusion)
    # e.g., {"HbA1c": {"min": 7.0, "max": 10.0, "unit": "%"}}
    lab_requirements: Dict[str, Dict[str, Optional[float]]] = Field(default_factory=dict)

    # --- Narrative Data (The "Original Text") ---
    # We keep the raw text for the AI Scorer/NLP Parser
    raw_inclusion_criteria: str
    raw_exclusion_criteria: str

    @field_validator('required_diagnoses', 'excluded_diagnoses')
    @classmethod
    def format_icd_codes(cls, v):
        return [code.upper().strip() for code in v]

    @property
    def full_criteria_text(self) -> str:
        """Helper to combine text for semantic matching."""
        return f"{self.raw_inclusion_criteria}\n{self.raw_exclusion_criteria}"