"""
Scorer Module for Semantic Matching
Handles the NLP similarity between patient history and trial criteria.
"""

from sentence_transformers import SentenceTransformer, util
import torch

class ClinicalScorer:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initializes the NLP model. 
        MiniLM is fast and effective for short-to-medium text.
        """
        self.model = SentenceTransformer(model_name)

    def compute_score(self, patient_history: str, trial_criteria: str) -> float:
        """
        Computes the cosine similarity between the patient's narrative 
        and the trial's eligibility text.
        """
        if not patient_history or not trial_criteria:
            return 0.0

        # Encode text into high-dimensional vectors (embeddings)
        embeddings = self.model.encode(
            [patient_history, trial_criteria], 
            convert_to_tensor=True
        )

        # Calculate Cosine Similarity
        # Result is a tensor, we convert to a standard Python float
        similarity = util.cos_sim(embeddings[0], embeddings[1])
        
        # Round to 4 decimal places for a clean UI
        score = float(similarity.item())
        return max(0.0, round(score, 4))

# Global instance for lazy loading (singleton pattern)
_scorer_instance = None

def get_scorer():
    global _scorer_instance
    if _scorer_instance is None:
        _scorer_instance = ClinicalScorer()
    return _scorer_instance