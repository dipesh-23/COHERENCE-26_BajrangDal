from sentence_transformers import SentenceTransformer, util
import torch


class MedicalScorer:
    def __init__(self):
        """
        Try to load the intended biomedical model; if unavailable or gated,
        fall back to a smaller public model. If everything fails, use a dummy scorer.
        """
        self.model = None

        # Preferred model from the build plan
        for model_name in (
            "pritamdeka/S-BiomedBERT",  # may be private/gated
            "sentence-transformers/all-MiniLM-L6-v2",  # fast, public generic model
        ):
            try:
                self.model = SentenceTransformer(model_name)
                break
            except Exception:
                continue

    def compute_score(self, patient_history: str, trial_text: str) -> float:
        """
        Calculates semantic similarity between patient history and trial criteria.
        Returns a float between 0 and 1. 
        """
        if not patient_history or not trial_text:
            return 0.5  # Neutral score for missing text data

        # If no model could be loaded, return a neutral similarity
        if self.model is None:
            return 0.5

        # Generate embeddings 
        embeddings1 = self.model.encode(patient_history, convert_to_tensor=True)
        embeddings2 = self.model.encode(trial_text, convert_to_tensor=True)
        
        # Compute cosine similarity 
        cosine_scores = util.cos_sim(embeddings1, embeddings2)
        
        # Convert tensor to float and ensure it stays in 0-1 range
        return float(torch.clamp(cosine_scores, 0, 1).item())


# Singleton pattern to avoid reloading the model on every API call [cite: 15]
_scorer_instance = None


def get_scorer():
    global _scorer_instance
    if _scorer_instance is None:
        _scorer_instance = MedicalScorer()
    return _scorer_instance