from pydantic import BaseModel, Field
from typing import List, Dict, Any, Union

class Patient(BaseModel):
    patient_id: str
    age: int
    gender: str
    zip_code: str
    
    # Diagnoses can be a list ["E11.9"] or a dict {"E11.9": "2023-01-01"}
    diagnoses: Union[List[str], Dict[str, Any]] = Field(default_factory=list)
    
    # Labs mapped as Name -> rich lab object
    # e.g. {"HbA1c": {"value": 8.2, "unit": "%", "observation_date": "2026-02-10"}}
    labs: Dict[str, Any] = Field(default_factory=dict)
    
    medications: List[str] = Field(default_factory=list)
    
    # The free-text notes that Member 1's anonymizer scrubs
    history_text: str = ""

    @property
    def medical_history(self) -> str:
        """Alias for M3's Semantic Soft Matcher."""
        return self.history_text