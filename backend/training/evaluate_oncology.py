import pandas as pd
from sentence_transformers import SentenceTransformer, util
import os

def evaluate_model():
    print("Loading raw trials data for evaluation...")
    try:
        df = pd.read_csv("real_oncology_trials_raw.csv")
    except FileNotFoundError:
        print("Data file not found. Please run fetch_trials_cffi.py first.")
        return

    print("Loading fine-tuned Oncology model...")
    model_path = os.path.join("..", "models", "finetuned_trial_model")
    if not os.path.exists(model_path):
         print(f"Model not found at {model_path}. Please run train_oncology.py first.")
         return
         
    model = SentenceTransformer(model_path)

    # We will test on a small subset (e.g., the first 20 trials) to save time
    test_df = df.head(20)
    
    correct_predictions = 0
    total_predictions = 0
    
    print("\n--- Model Evaluation ---")
    
    avg_positive_score = 0
    avg_negative_score = 0
    avg_random_score = 0

    for i, row in test_df.iterrows():
        trial_text = row['trial_text']
        
        # 1. Positive Patient (Should have HIGH score)
        patient_good = f"Patient has {row['title']}. " + trial_text.split("Exclusion")[0]
        
        # 2. Negative Patient (Should have LOW score)
        if "Exclusion" in trial_text:
            exclusions = trial_text.split("Exclusion")[1]
            patient_bad = f"Patient has {row['title']} but also has {exclusions[:100]}"
        else:
            patient_bad = f"Patient has {row['title']} but is not eligible due to other constraints."
            
        # 3. Random Patient (Should have VERY LOW score)
        other_row = df.iloc[(i + 1) % len(df)]
        patient_random = f"Patient has {other_row['title']}."
        
        # Calculate embeddings
        trial_emb = model.encode(trial_text, convert_to_tensor=True)
        good_emb = model.encode(patient_good, convert_to_tensor=True)
        bad_emb = model.encode(patient_bad, convert_to_tensor=True)
        random_emb = model.encode(patient_random, convert_to_tensor=True)
        
        # Calculate similarities
        score_good = util.cos_sim(trial_emb, good_emb).item()
        score_bad = util.cos_sim(trial_emb, bad_emb).item()
        score_random = util.cos_sim(trial_emb, random_emb).item()
        
        avg_positive_score += score_good
        avg_negative_score += score_bad
        avg_random_score += score_random
        
        total_predictions += 1
        
        # A successful model should rank the positive patient higher than the negative and random ones.
        if score_good > score_bad and score_good > score_random:
            correct_predictions += 1
            
    # Calculate stats
    avg_positive_score /= total_predictions
    avg_negative_score /= total_predictions
    avg_random_score /= total_predictions
    accuracy = (correct_predictions / total_predictions) * 100
    
    print(f"Tested on {total_predictions} complex Oncology trial scenarios.")
    print(f"1. Average Match Score (Perfect Candidates): {avg_positive_score:.2f} (Target: >0.80)")
    # We want the model to penalize exclusions, so we want to see a drop in score
    print(f"2. Average Match Score (Patients w/ Exclusions): {avg_negative_score:.2f} (Target: Lower is better)")
    print(f"3. Average Match Score (Wrong Disease/Trial): {avg_random_score:.2f} (Target: Lowest)")
    print("-" * 25)
    print(f"Overall Discrimination Accuracy: {accuracy:.1f}%")
    if accuracy > 80:
        print("✅ The model has successfully learned to distinguish Oncology criteria nuances!")
    else:
        print("⚠️ The model might need more training data or epochs.")

if __name__ == "__main__":
    evaluate_model()
