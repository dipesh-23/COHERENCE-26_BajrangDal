import { useState, useCallback } from 'react';

export function useTrialEngine() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const matchTrials = useCallback(async (patientId, limit = 5, filters = {}) => {
        setIsLoading(true);
        setError(null);
        try {
            // Simulate network request
            await new Promise(res => setTimeout(res, 1500));

            const mockResult = [
                {
                    "patient_id": patientId,
                    "trial_id": "NCT-2026-001",
                    "trial_name": "EMBARK-T2DM Phase III",
                    "match_score": 87,
                    "confidence": "HIGH",
                    "phase": "Phase III",
                    "sponsor": "NovaBiomed Inc.",
                    "location": "New York, NY",
                    "hpsa_flagged": false,
                    "criteria_breakdown": [
                        { "name": "Age 40-65", "status": "met", "detail": "Age 52 within range" },
                        { "name": "HbA1c >7%", "status": "met", "detail": "8.2% recorded" },
                        { "name": "eGFR ≥60", "status": "verify", "detail": "Confirmation needed" }
                    ],
                    "missing_data": ["eGFR lab confirmation"],
                    "exclusion_flags": [],
                    "recommendation": "Proceed",
                    "narrative_text": "Strong metabolic profile match.",
                    "llm_explanation": "Patient aligns strongly with EMBARK-T2DM criteria based on recent lab results showing elevated HbA1c and matching age demographics. Ensure eGFR is verified before proceeding."
                },
                {
                    "patient_id": patientId,
                    "trial_id": "NCT-2025-442",
                    "trial_name": "Cardio-Metabolic Interventional Study",
                    "match_score": 72,
                    "confidence": "MEDIUM",
                    "phase": "Phase II",
                    "sponsor": "HeartHealth Masters",
                    "location": "Boston, MA",
                    "hpsa_flagged": true,
                    "criteria_breakdown": [
                        { "name": "Age 18+", "status": "met", "detail": "Age 52 within range" },
                        { "name": "Uncontrolled HTN", "status": "met", "detail": "History of Hypertension" }
                    ],
                    "missing_data": ["Recent resting ECG", "Lipid panel"],
                    "exclusion_flags": [],
                    "recommendation": "Review required",
                    "narrative_text": "Moderate match, missing key cardio baseline data.",
                    "llm_explanation": "Requires more cardiovascular screening before full eligibility can be determined. Patient's history of Hypertension makes them a candidate, pending baseline ECG."
                }
            ];
            setIsLoading(false);
            return mockResult;
        } catch (err) {
            setError(err);
            setIsLoading(false);
            return [];
        }
    }, []);

    return { matchTrials, isLoading, error };
}
