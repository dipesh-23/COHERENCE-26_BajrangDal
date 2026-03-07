from curl_cffi import requests
import pandas as pd

def fetch_oncology_trials(num_trials=100):
    print(f"Fetching {num_trials} oncology trials from ClinicalTrials.gov...")
    
    url = "https://clinicaltrials.gov/api/v2/studies"
    
    params = {
        "query.cond": "Cancer OR Oncology OR Solid Tumor OR Melanoma OR Leukemia",
        "filter.overallStatus": "RECRUITING",
        "pageSize": num_trials,
        "fields": "NCTId,BriefTitle,EligibilityCriteria"
    }
    
    trials_data = []
    
    try:
        # The 'impersonate' flag perfectly mimics a real Chrome browser!
        response = requests.get(url, params=params, impersonate="chrome110", timeout=30.0)
        
        if response.status_code == 403:
            print("Still getting 403. Your IP might be temporarily flagged.")
            return
            
        data = response.json()
        studies = data.get("studies", [])
        
        for study in studies:
            protocol = study.get("protocolSection", {})
            
            nct_id = protocol.get("identificationModule", {}).get("nctId", "Unknown")
            title = protocol.get("identificationModule", {}).get("briefTitle", "No Title")
            
            eligibility = protocol.get("eligibilityModule", {})
            criteria_text = eligibility.get("eligibilityCriteria", "")
            
            if criteria_text and len(criteria_text) > 50:
                trials_data.append({
                    "nct_id": nct_id,
                    "title": title,
                    "trial_text": criteria_text.strip()
                })
                
    except Exception as e:
        print(f"Error fetching data: {e}")
        return

    if trials_data:
        df = pd.DataFrame(trials_data)
        df.to_csv("real_oncology_trials_raw.csv", index=False)
        print(f"Successfully saved {len(df)} trials to 'real_oncology_trials_raw.csv'")
    else:
        print("No trials found or extracted.")

if __name__ == "__main__":
    fetch_oncology_trials(num_trials=100)
