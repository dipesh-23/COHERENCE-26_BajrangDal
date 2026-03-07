import sys
import os

# Add the backend root to the Python path so we can import our modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from modules.scorer import get_scorer

def evaluate_model():
    print("=== Model Evaluation with Synthetic Dataset ===\n")
    
    # Initialize our fine-tuned scorer (handles fallback internally)
    scorer = get_scorer()
    
    # The synthetic dataset:
    # We define a few distinct trials. For each trial, we have:
    # 1. A "Positive Match" patient who meets the criteria.
    # 2. A "Negative Match" patient who fails a key exclusion or inclusion logic.
    # The scorer outputs a cosine similarity [0, 1].
    # A perfect model should score the Positive Match significantly higher than the Negative Match.
    
    evaluation_set = [
        {
            "trial_id": "TRIAL-001 (Oncology - Breast Cancer)",
            "criteria": "Inclusion: Female patients aged 18-65. Confirmed diagnosis of triple-negative breast cancer (TNBC). Must have received at least one prior line of chemotherapy. Exclusion: Presence of brain metastases.",
            "patients": [
                {
                    "label": "Positive Match",
                    "history": "45-year-old female. Diagnosed with triple-negative breast cancer 2 years ago. Previous treatment includes doxorubicin and cyclophosphamide. recent MRI shows no evidence of brain metastases.",
                    "expected_higher": True
                },
                {
                    "label": "Negative Match (Fails Exclusion)",
                    "history": "50-year-old female with triple-negative breast cancer. History of paclitaxel therapy. Patient recently developed severe headaches; imaging confirmed new active brain metastases.",
                    "expected_higher": False
                }
            ]
        },
        {
            "trial_id": "TRIAL-002 (Cardiology - Heart Failure)",
            "criteria": "Inclusion: Adults over 40. Documented heart failure with reduced ejection fraction (HFrEF) < 40%. Currently taking an ACE inhibitor or ARB. Exclusion: Recent myocardial infarction within the last 3 months.",
            "patients": [
                {
                    "label": "Positive Match",
                    "history": "62-year-old male with chronic heart failure. Latest echocardiogram shows LVEF of 35%. Current medications include lisinopril 20mg daily and metoprolol. No recent hospitalizations for acute coronary syndrome.",
                    "expected_higher": True
                },
                {
                    "label": "Negative Match (Fails Inclusion - wrong EF)",
                    "history": "58-year-old male. History of heart failure with preserved ejection fraction (HFpEF). Echocardiogram shows LVEF of 55%. Currently managed on valsartan.",
                    "expected_higher": False
                }
            ]
        },
         {
            "trial_id": "TRIAL-003 (Endocrinology - T2DM)",
            "criteria": "Inclusion: Type 2 Diabetes Mellitus. HbA1c between 7.5% and 10.0%. BMI >= 25. Exclusion: Use of GLP-1 receptor agonists within the last 6 months. eGFR < 45 mL/min.",
            "patients": [
                {
                    "label": "Positive Match",
                    "history": "Patient is a 55yo with Type 2 Diabetes. Current HbA1c is 8.2%. BMI is 29. Medications include Metformin 1000mg BID. Renal function is stable with eGFR of 65. No history of Ozempic or Wegovy use.",
                    "expected_higher": True
                },
                {
                    "label": "Negative Match (Fails Exclusion - GLP1)",
                    "history": "60yo female patient with uncontrolled Type 2 Diabetes. HbA1c 8.8%, BMI 32. Has been taking semaglutide (Ozempic) 1mg weekly for the past 2 months. eGFR is 70.",
                    "expected_higher": False
                }
            ]
        }
    ]
    
    correct_rankings = 0
    total_trials = len(evaluation_set)
    margin_sum = 0.0
    
    for trial in evaluation_set:
        print(f"Trial: {trial['trial_id']}")
        print(f"Criteria: {trial['criteria']}\n")
        
        pos_score = 0.0
        neg_score = 0.0
        
        for p in trial['patients']:
            score = scorer.compute_score(p["history"], trial["criteria"])
            
            # Format to 3 decimal places
            print(f"[{p['label']}] Score: {score:.3f}")
            print(f"  History: {p['history']}")
            
            if p["expected_higher"]:
                pos_score = score
            else:
                neg_score = score
                
        # Evaluate if the model correctly ranked the positive patient higher than the negative patient
        if pos_score > neg_score:
            print("=> [Correct Ranking] Positive Match scored higher")
            correct_rankings += 1
            margin_sum += (pos_score - neg_score)
        else:
            print("=> [Incorrect Ranking] Negative Match scored higher or equal")
            
        print("-" * 60)
        
    accuracy = (correct_rankings / total_trials) * 100
    avg_margin = margin_sum / total_trials if total_trials > 0 else 0
    
    print("\n=== Evaluation Results ===")
    print(f"Total Trials Tested: {total_trials}")
    print(f"Ranking Accuracy:    {accuracy:.1f}%")
    print(f"Average Margin:      +{avg_margin:.3f} (Confidence gap between Positive & Negative)")
    
    if accuracy >= 100:
        print("Model exhibits PERFECT distinction on this dataset.")
    elif accuracy >= 66:
        print("Model shows GOOD distinction, but struggles with nuanced exclusions.")
    else:
        print("Model requires further fine-tuning. It struggles to distinguish matches.")

if __name__ == "__main__":
    evaluate_model()
