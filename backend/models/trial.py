from pydantic import BaseModel, Field


class Trial(BaseModel):
    """Represents a clinical trial used for patient matching."""

    trial_id: str = Field(
        ...,
        description="ClinicalTrials.gov identifier in NCT format.",
        pattern=r"^NCT\d{8}$",
        json_schema_extra={"example": "NCT04521234"},
    )
    title: str = Field(
        ...,
        description="Full official title of the clinical trial.",
        json_schema_extra={
            "example": (
                "A Randomised, Double-Blind, Placebo-Controlled Study of "
                "Semaglutide in Adults With Type 2 Diabetes and Chronic Kidney Disease"
            )
        },
    )
    phase: str = Field(
        ...,
        description="Trial phase (e.g. 'Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'N/A').",
        json_schema_extra={"example": "Phase 2"},
    )
    sponsor: str = Field(
        ...,
        description="Name of the primary sponsor organisation.",
        json_schema_extra={"example": "Novo Nordisk A/S"},
    )
    location: str = Field(
        ...,
        description="Primary site or city/country where the trial is conducted.",
        json_schema_extra={"example": "Stanford Medical Center, Palo Alto, CA, USA"},
    )
    start_date: str = Field(
        ...,
        description="Trial start date in YYYY-MM-DD format.",
        json_schema_extra={"example": "2024-03-01"},
    )
    end_date: str = Field(
        ...,
        description="Estimated or actual trial end date in YYYY-MM-DD format.",
        json_schema_extra={"example": "2026-09-30"},
    )
    criteria_text: str = Field(
        ...,
        description=(
            "Raw eligibility criteria text as published on ClinicalTrials.gov, "
            "covering both inclusion and exclusion criteria."
        ),
        json_schema_extra={
            "example": (
                "Inclusion Criteria:\n"
                "  - Age 30–75 years\n"
                "  - Diagnosed with Type 2 Diabetes Mellitus (ICD-10: E11.9)\n"
                "  - HbA1c between 7.5% and 11.0%\n"
                "  - eGFR 25–60 mL/min/1.73m²\n\n"
                "Exclusion Criteria:\n"
                "  - Prior use of GLP-1 receptor agonists within 90 days\n"
                "  - End-stage renal disease (eGFR < 15)\n"
                "  - Active malignancy within the last 5 years"
            )
        },
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "trial_id": "NCT04521234",
                "title": (
                    "A Randomised, Double-Blind, Placebo-Controlled Study of "
                    "Semaglutide in Adults With Type 2 Diabetes and Chronic Kidney Disease"
                ),
                "phase": "Phase 2",
                "sponsor": "Novo Nordisk A/S",
                "location": "Stanford Medical Center, Palo Alto, CA, USA",
                "start_date": "2024-03-01",
                "end_date": "2026-09-30",
                "criteria_text": (
                    "Inclusion Criteria:\n"
                    "  - Age 30–75 years\n"
                    "  - Diagnosed with Type 2 Diabetes Mellitus (ICD-10: E11.9)\n"
                    "  - HbA1c between 7.5% and 11.0%\n"
                    "  - eGFR 25–60 mL/min/1.73m²\n\n"
                    "Exclusion Criteria:\n"
                    "  - Prior use of GLP-1 receptor agonists within 90 days\n"
                    "  - End-stage renal disease (eGFR < 15)\n"
                    "  - Active malignancy within the last 5 years"
                ),
            }
        }
    }
