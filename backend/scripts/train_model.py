import os
import requests
import time
from typing import List, Dict
import random
import torch
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader

# Configuration
API_URL = "https://clinicaltrials.gov/api/v2/studies"
MODEL_NAME = "pritamdeka/S-BiomedBERT"  # Medical base model
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "models", "finetuned_trial_model")
BATCH_SIZE = 16
NUM_EPOCHS = 3
MAX_TRIALS_TO_FETCH = 500  # Increased for better accuracy

def fetch_trial_data() -> List[str]:
    print(f"Fetching {MAX_TRIALS_TO_FETCH} completed trials from ClinicalTrials.gov...")
    params = {
        "query.term": "completed",
        "pageSize": 50,
        "format": "json"
    }
    
    texts = []
    next_page_token = None
    fetched = 0
    
    while fetched < MAX_TRIALS_TO_FETCH:
        if next_page_token:
            params["pageToken"] = next_page_token
            
        try:
            response = requests.get(API_URL, params=params)
            response.raise_for_status()
            data = response.json()
            
            studies = data.get("studies", [])
            if not studies:
                break
                
            for study in studies:
                protocol = study.get("protocolSection", {})
                
                # Extract Brief Summary
                desc = protocol.get("descriptionModule", {})
                brief_summary = desc.get("briefSummary", "")
                if brief_summary:
                    texts.append(brief_summary)
                    
                # Extract Eligibility Criteria
                eligibility = protocol.get("eligibilityModule", {})
                criteria_text = eligibility.get("eligibilityCriteria", "")
                if criteria_text:
                    # Split criteria by newlines to get individual rules
                    rules = [r.strip() for r in criteria_text.split('\n') if len(r.strip()) > 20]
                    texts.extend(rules)
            
            fetched += len(studies)
            print(f"Fetched {fetched} trials...")
            
            next_page_token = data.get("nextPageToken")
            if not next_page_token:
                break
                
            time.sleep(0.5)  # Be nice to the API
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching data: {e}")
            break
            
    print(f"Extracted {len(texts)} text snippets for training.")
    return texts

def train_simcse(texts: List[str]):
    """
    Trains using Unsupervised SimCSE (Simple Contrastive Learning of Sentence Embeddings).
    Passes the same sentence twice to the model. Dropout acts as minimal augmentation.
    """
    if not texts:
        print("No texts to train on!")
        return
        
    print(f"Loading base model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    
    # Create InputExamples for SimCSE. 
    # For Unsupervised SimCSE, we just duplicate the text: (text, text)
    train_examples = []
    # Filter out very short texts
    valid_texts = [t for t in texts if len(t.split()) > 5]
    
    # Shuffle and limit if too large for a quick demo run
    random.shuffle(valid_texts)
    # limit to 5000 max examples to keep training time under 5-10 mins on CPU/modest GPU
    valid_texts = valid_texts[:5000]
    
    for text in valid_texts:
        train_examples.append(InputExample(texts=[text, text]))
        
    print(f"Created {len(train_examples)} training examples. Preparing DataLoader...")
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=BATCH_SIZE)
    
    # MultipleNegativesRankingLoss is used for SimCSE.
    # It expects pairs (a, b) and tries to pull them together while pushing away other items in the batch.
    train_loss = losses.MultipleNegativesRankingLoss(model)
    
    print(f"Starting training for {NUM_EPOCHS} epochs...")
    target_device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Training on device: {target_device}")
    
    # Training Loop
    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=NUM_EPOCHS,
        warmup_steps=int(len(train_dataloader) * 0.1),
        show_progress_bar=True
    )
    
    print(f"Training complete. Saving model to {OUTPUT_DIR}")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    model.save(OUTPUT_DIR)
    print("Model saved successfully!")

if __name__ == "__main__":
    print("=== ClinicalTrials.gov ML Model Fine-Tuning ===")
    training_texts = fetch_trial_data()
    train_simcse(training_texts)
