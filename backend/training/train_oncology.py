import pandas as pd
from sentence_transformers import SentenceTransformer, InputExample, losses
from torch.utils.data import DataLoader
import os
import random

def create_training_pairs(df):
    """
    Creates positive and negative matches from the raw trial data
    to teach the model what a good vs bad match looks like.
    """
    examples = []
    
    for i, row in df.iterrows():
        trial_text = row['trial_text']
        
        # 1. Positive Match (1.0)
        # Create a synthetic patient that perfectly matches this trial
        # We just grab the inclusion criteria string
        patient_good = f"Patient has {row['title']}. " + trial_text.split("Exclusion")[0]
        examples.append(InputExample(texts=[patient_good, trial_text], label=1.0))
        
        # 2. Negative Match (0.0 or 0.1)
        # Create a synthetic patient that triggers the exclusion criteria
        if "Exclusion" in trial_text:
            exclusions = trial_text.split("Exclusion")[1]
            patient_bad = f"Patient has {row['title']} but also has {exclusions[:100]}"
            examples.append(InputExample(texts=[patient_bad, trial_text], label=0.1))
            
        # 3. Random Mismatch (0.0)
        # Compare this trial with a completely different patient
        other_row = df.iloc[(i + 1) % len(df)]
        patient_random = f"Patient has {other_row['title']}."
        examples.append(InputExample(texts=[patient_random, trial_text], label=0.0))
        
    return examples

def train_model():
    print("Loading raw trials data...")
    df = pd.read_csv("real_oncology_trials_raw.csv")
    
    print("Generating training pairs...")
    train_examples = create_training_pairs(df)
    
    print(f"Generated {len(train_examples)} training pairs.")
    
    print("Loading base MiniLM model...")
    # Using a fast, public baseline model that we will fine-tune for oncology
    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    model = SentenceTransformer(model_name)
    
    # Create DataLoader
    train_dataloader = DataLoader(train_examples, shuffle=True, batch_size=8)
    
    # We use CosineSimilarityLoss since we want our model's 
    # cosine_similarity() output in scorer.py to match our labels (0.0 to 1.0)
    train_loss = losses.CosineSimilarityLoss(model)
    
    print("Starting fine-tuning...")
    model.fit(
        train_objectives=[(train_dataloader, train_loss)],
        epochs=3, # 3 epochs is usually enough for fine-tuning
        warmup_steps=10,
        show_progress_bar=True
    )
    
    # Save to the specific directory expected by backend/modules/scorer.py
    save_path = os.path.join("..", "models", "finetuned_trial_model")
    os.makedirs(save_path, exist_ok=True)
    
    print(f"Saving fine-tuned model to {save_path}...")
    model.save(save_path)
    print("Training complete! The backend will automatically use this model on next restart.")

if __name__ == "__main__":
    train_model()
