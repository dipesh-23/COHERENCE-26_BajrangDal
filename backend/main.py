import streamlit as st
from modules.matcher import match_patient_to_trial

st.set_page_config(page_title="Clinical Trial Matcher", page_icon="🧬", layout="wide")

st.title("🧬 AI Clinical Trial Matching System")
st.markdown("Match a patient profile with a clinical trial using rule filtering + AI similarity.")

# Layout
col1, col2 = st.columns(2)

# -------------------------
# Patient Input
# -------------------------

with col1:
    st.header("Patient Profile")

    patient_id = st.text_input("Patient ID", "PT-00123")
    age = st.number_input("Age", min_value=0, max_value=120, value=54)

    gender = st.selectbox(
        "Gender",
        ["Male", "Female", "Other"]
    )

    zip_code = st.text_input("ZIP Code", "94103")

    diagnoses = st.text_input(
        "Diagnoses (ICD-10 codes, comma separated)",
        "E11.9,I10,N18.3"
    )

    medications = st.text_input(
        "Current Medications (comma separated)",
        "Metformin 500mg,Lisinopril 10mg,Atorvastatin 20mg"
    )

    history_text = st.text_area(
        "Patient Medical History",
        """54-year-old male with a 10-year history of Type 2 diabetes mellitus,
stage 3 chronic kidney disease, and hypertension. Currently managed with
oral hypoglycaemics and ACE inhibitor. No prior cardiovascular events."""
    )

# -------------------------
# Trial Input
# -------------------------

with col2:
    st.header("Clinical Trial")

    trial_id = st.text_input("Trial ID", "NCT04521234")

    title = st.text_input(
        "Trial Title",
        "Semaglutide Study for Type 2 Diabetes with Chronic Kidney Disease"
    )

    phase = st.selectbox(
        "Trial Phase",
        ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]
    )

    sponsor = st.text_input("Sponsor", "Novo Nordisk")

    location = st.text_input(
        "Trial Location",
        "Palo Alto, CA"
    )

    start_date = st.date_input("Start Date")
    end_date = st.date_input("End Date")

    criteria_text = st.text_area(
        "Eligibility Criteria",
        """Inclusion Criteria:
- Age 30–75 years
- Diagnosed with Type 2 Diabetes Mellitus (ICD-10: E11.9)
- HbA1c between 7.5% and 11.0%

Exclusion Criteria:
- Prior GLP-1 receptor agonist therapy
- End-stage renal disease
- Active malignancy within last 5 years"""
    )

# -------------------------
# Match Button
# -------------------------

st.divider()

if st.button("🔎 Find Match", use_container_width=True):

    patient_data = {
        "patient_id": patient_id,
        "age": age,
        "gender": gender,
        "zip_code": zip_code,
        "diagnoses": [d.strip() for d in diagnoses.split(",")],
        "labs": {},
        "medications": [m.strip() for m in medications.split(",")],
        "history_text": history_text,
    }

    trial_data = {
        "trial_id": trial_id,
        "title": title,
        "phase": phase,
        "sponsor": sponsor,
        "location": location,
        "start_date": str(start_date),
        "end_date": str(end_date),
        "criteria_text": criteria_text,
    }

    result = match_patient_to_trial(patient_data, trial_data)

    if result["eligible"]:
        st.success("✅ Patient is eligible for the trial")
        st.metric("AI Similarity Score", f"{result['score']:.2f}")
        st.progress(result["score"])
    else:
        st.error("❌ Patient is NOT eligible")
        for reason in result["reasons"]:
            st.warning(f"Failed Rule: {reason}")