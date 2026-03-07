from pydantic import BaseModel, Field
import uuid
from typing import List, Dict, Any, Union, Optional

class Patient(BaseModel):
    patient_id: Optional[str] = Field(default_factory=lambda: f"P-{str(uuid.uuid4())[:8].upper()}")
    age: int
    gender: str
    # --- M3/M4 Demographic & Geographic Metadata ---
    zip_code: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None   
    # Diagnoses can be a list ["E11.9"] or a dict {"E11.9": "2023-01-01"}
    diagnoses: Union[List[str], Dict[str, Any]] = Field(default_factory=list)
    
    # Labs mapped as Name -> rich lab object
    # e.g. {"HbA1c": {"value": 8.2, "unit": "%", "observation_date": "2026-02-10"}}
    labs: Dict[str, Any] = Field(default_factory=dict)
    
    medications: List[str] = Field(default_factory=list)
    
    # The free-text notes that Member 1's anonymizer scrubs
    history_text: str = ""

    # ── Location filter fields (sent by frontend GeographyFilter) ──────────────
    filter_zip: Optional[str] = None            # ZIP to filter from (defaults to zip_code)
    filter_radius_miles: Optional[float] = 9999 # 9999 = no limit
    filter_hpsa_only: Optional[bool] = False    # Only return HPSA-designated sites

    @property
    def medical_history(self) -> str:
        """Alias for M3's Semantic Soft Matcher."""
        return self.history_text