import { useState, useCallback, useRef } from 'react';

// ─── API Base URL ─────────────────────────────────────────────────────────────
// Set VITE_API_BASE_URL in your .env file to point to the deployed backend.
// All fetch calls use this base — swapping one env var wires up the real backend.
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8000';

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Used as fallbacks when backend is unreachable. Remove/replace once live.

const MOCK_PATIENT = {
    patient_id: 'P-84921',
    age: 52,
    gender: 'Female',
    zip: '10001',
    diagnoses: ['E11.9 - Type 2 Diabetes', 'I10 - Hypertension'],
    labs: { HbA1c: 8.2, eGFR: 71, Creatinine: 1.1 },
    medications: ['Metformin 1000mg', 'Lisinopril 10mg'],
    history_text: '[REDACTED - PHI removed by Presidio]',
};

const MOCK_RESULTS = [
    {
        patient_id: 'P-84921',
        trial_id: 'NCT-2026-001',
        trial_name: 'EMBARK-T2DM Phase III',
        match_score: 87,
        confidence: 'HIGH',
        phase: 'Phase III',
        sponsor: 'NovaBiomed Inc.',
        location: 'New York, NY',
        hpsa_flagged: false,
        criteria_breakdown: [
            { name: 'Age 40-65', status: 'met', detail: 'Age 52 within range' },
            { name: 'T2DM Diagnosis', status: 'met', detail: 'ICD E11.9 confirmed' },
            { name: 'HbA1c >7%', status: 'met', detail: '8.2% recorded' },
            { name: 'Metformin Use', status: 'met', detail: 'Active prescription' },
            { name: 'eGFR ≥60', status: 'verify', detail: '71 recorded, confirm needed' },
            { name: 'No Insulin', status: 'met', detail: 'Not in medications' },
        ],
        missing_data: ['eGFR lab confirmation'],
        exclusion_flags: [],
        recommendation: 'Proceed',
        narrative_text: 'Strong metabolic profile match.',
        llm_explanation:
            'Patient P-84921 aligns strongly with EMBARK-T2DM criteria. Confirmed T2DM, HbA1c of 8.2% exceeding the 7% threshold, and active Metformin satisfy primary inclusion criteria. eGFR confirmation is a minor gap. Confidence HIGH.',
    },
    {
        patient_id: 'P-84921',
        trial_id: 'NCT-2026-002',
        trial_name: 'CardioGuard Hypertension 2026',
        match_score: 73,
        confidence: 'MEDIUM',
        phase: 'Phase II',
        sponsor: 'HeartPath Therapeutics',
        location: 'Boston, MA',
        hpsa_flagged: true,
        criteria_breakdown: [
            { name: 'Hypertension Dx', status: 'met', detail: 'ICD I10 confirmed' },
            { name: 'Age 45-70', status: 'met', detail: 'Age 52 in range' },
            { name: 'ACE Inhibitor', status: 'met', detail: 'Lisinopril active' },
            { name: 'eGFR ≥45', status: 'met', detail: 'eGFR 71' },
            { name: 'No Beta Blockers', status: 'verify', detail: 'Not listed but unconfirmed' },
            { name: 'BP Reading <160', status: 'verify', detail: 'No recent BP in record' },
        ],
        missing_data: ['Recent BP reading', 'Beta blocker history'],
        exclusion_flags: [],
        recommendation: 'Verify First',
        narrative_text: 'Good hypertension profile, two fields unverified.',
        llm_explanation:
            'Patient presents a solid hypertension profile with confirmed ACE inhibitor use. Two unverified fields reduce confidence to MEDIUM. GP verification of BP and beta blocker history could elevate this to a strong match.',
    },
    {
        patient_id: 'P-84921',
        trial_id: 'NCT-2026-003',
        trial_name: 'MetaboSync Insulin Resistance',
        match_score: 61,
        confidence: 'MEDIUM',
        phase: 'Phase II',
        sponsor: 'GlycoCure Labs',
        location: 'Chicago, IL',
        hpsa_flagged: false,
        criteria_breakdown: [
            { name: 'T2DM Diagnosis', status: 'met', detail: 'Confirmed ICD E11.9' },
            { name: 'BMI 27-40', status: 'verify', detail: 'BMI not in record' },
            { name: 'Age 35-60', status: 'met', detail: 'Age 52 in range' },
            { name: 'HbA1c 7.5-11%', status: 'met', detail: '8.2% in range' },
            { name: 'No GLP-1 Use', status: 'met', detail: 'Not in medications' },
            { name: 'Prior SGLT2', status: 'unmet', detail: 'No SGLT2 inhibitor history' },
        ],
        missing_data: ['BMI value'],
        exclusion_flags: ['No prior SGLT2 inhibitor use'],
        recommendation: 'Verify First',
        narrative_text: 'Partial metabolic match — BMI and SGLT2 gaps.',
        llm_explanation:
            'Patient meets core glycemic criteria but lacks documented SGLT2 inhibitor history which is a key requirement. BMI is absent. Without these data points, confidence is MEDIUM and eligibility cannot be confirmed.',
    },
    {
        patient_id: 'P-84921',
        trial_id: 'NCT-2026-004',
        trial_name: 'RenalGuard CKD Prevention',
        match_score: 45,
        confidence: 'LOW',
        phase: 'Phase I',
        sponsor: 'NephroTech',
        location: 'Houston, TX',
        hpsa_flagged: true,
        criteria_breakdown: [
            { name: 'eGFR 30-60', status: 'unmet', detail: 'eGFR 71 exceeds upper limit' },
            { name: 'Diabetes Dx', status: 'met', detail: 'Confirmed' },
            { name: 'Age 50-75', status: 'met', detail: 'Age 52 in range' },
            { name: 'Creatinine >1.2', status: 'unmet', detail: 'Creatinine 1.1 below threshold' },
            { name: 'No Dialysis', status: 'met', detail: 'None recorded' },
            { name: 'Proteinuria', status: 'verify', detail: 'No urine test in record' },
        ],
        missing_data: ['Urine protein test'],
        exclusion_flags: ['eGFR exceeds upper limit of 60', 'Creatinine below 1.2 threshold'],
        recommendation: 'Not Suitable',
        narrative_text: 'Renal function outside trial thresholds.',
        llm_explanation:
            'Patient does not meet RenalGuard renal function thresholds. Trial targets eGFR 30-60 indicating moderate CKD, while patient has eGFR 71. Creatinine 1.1 also falls below the 1.2 minimum. Not suitable at this time.',
    },
    {
        patient_id: 'P-84921',
        trial_id: 'NCT-2026-005',
        trial_name: 'ImmunoBalance Autoimmune T2DM',
        match_score: 38,
        confidence: 'LOW',
        phase: 'Phase I',
        sponsor: 'ImmunePath Research',
        location: 'Seattle, WA',
        hpsa_flagged: false,
        criteria_breakdown: [
            { name: 'LADA/T1DM Required', status: 'unmet', detail: 'Patient has T2DM not LADA' },
            { name: 'C-Peptide <0.6', status: 'verify', detail: 'C-Peptide not in record' },
            { name: 'Age 18-45', status: 'unmet', detail: 'Patient age 52 exceeds upper limit' },
            { name: 'No Metformin', status: 'unmet', detail: 'Patient actively on Metformin' },
            { name: 'Autoantibodies+', status: 'verify', detail: 'Not tested' },
            { name: 'BMI <32', status: 'verify', detail: 'BMI not recorded' },
        ],
        missing_data: ['C-Peptide level', 'Autoantibody panel', 'BMI'],
        exclusion_flags: [
            'T2DM not LADA/T1DM',
            'Age 52 exceeds 45 limit',
            'Active Metformin excluded',
        ],
        recommendation: 'Not Suitable',
        narrative_text: 'Fundamental diagnosis and age mismatch.',
        llm_explanation:
            'Patient does not align with ImmunoBalance on three fundamental dimensions: diagnosis type (T2DM vs required LADA), age (52 vs max 45), and active Metformin which is an explicit exclusion. Not suitable regardless of unverified fields.',
    },
];

// ─── Initial state shapes ─────────────────────────────────────────────────────
const INITIAL_LOADING = { upload: null, match: null, report: null };
const INITIAL_ERRORS = { upload: null, match: null, report: null };

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTrialEngine() {
    const [patientData, setPatientData] = useState(null);
    const [matchResults, setMatchResults] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(INITIAL_LOADING);
    const [errors, setErrors] = useState(INITIAL_ERRORS);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [demoModeBanner, setDemoModeBanner] = useState(null);

    // Refs for staged upload timers and error-clear timers
    const stageTimers = useRef([]);
    const errTimers = useRef({});

    // ── Helper: set an error with 5s auto-clear ──
    const setError = useCallback((key, message) => {
        clearTimeout(errTimers.current[key]);
        setErrors(prev => ({ ...prev, [key]: message }));
        errTimers.current[key] = setTimeout(() => {
            setErrors(prev => ({ ...prev, [key]: null }));
        }, 5000);
    }, []);

    // ── Helper: update one loading key ──
    const setLoading = useCallback((key, value) => {
        setLoadingStatus(prev => ({ ...prev, [key]: value }));
    }, []);

    // ─────────────────────────────────────────────────────────────────────────────
    // uploadPatient(file: File) → POST /ingest/patient
    // ─────────────────────────────────────────────────────────────────────────────
    const uploadPatient = useCallback((file) => {
        return new Promise((resolve) => {
            // Clear any previous stage timers
            stageTimers.current.forEach(t => clearTimeout(t));
            stageTimers.current = [];

            // Staged status messages
            setLoading('upload', 'Parsing record...');
            stageTimers.current.push(setTimeout(() => setLoading('upload', 'Anonymizing PHI via Presidio...'), 500));
            stageTimers.current.push(setTimeout(() => setLoading('upload', 'Validating schema...'), 1000));

            const reader = new FileReader();
            reader.onload = async (e) => {
                let parsed;
                try {
                    parsed = JSON.parse(e.target.result);
                } catch {
                    setLoading('upload', null);
                    setError('upload', 'Could not parse JSON. Please upload a valid .json file.');
                    resolve(null);
                    return;
                }

                try {
                    // ── BACKEND INTEGRATION: Member 1 → POST /ingest/patient ──────────
                    const res = await fetch(`${API_BASE}/ingest/patient`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(parsed),
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json(); // → AnonymizedPatient
                    // ── END INTEGRATION POINT ─────────────────────────────────────────
                    setPatientData(data);
                    setLoading('upload', null);
                    resolve(data);
                } catch (err) {
                    console.warn('[useTrialEngine] uploadPatient fallback:', err.message);
                    setIsDemoMode(true);
                    setDemoModeBanner('⚡ Backend unreachable — using demo patient data');
                    setPatientData(MOCK_PATIENT);
                    setLoading('upload', null);
                    resolve(MOCK_PATIENT);
                }
            };
            reader.readAsText(file);
        });
    }, [setLoading, setError]);

    // ─────────────────────────────────────────────────────────────────────────────
    // matchTrials(patient_id, top_k, filters) → POST /match
    // ─────────────────────────────────────────────────────────────────────────────
    const matchTrials = useCallback(async (patient_id, top_k = 5, filters = {}) => {
        setLoading('match', 'Finding matching trials...');
        try {
            // ── BACKEND INTEGRATION: Member 3 → POST /match ───────────────────────
            const res = await fetch(`${API_BASE}/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patient_id, top_k, filters }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json(); // → List[MatchResult]
            // ── END INTEGRATION POINT ─────────────────────────────────────────────
            setMatchResults(data);
            setLoading('match', null);
            return data;
        } catch (err) {
            console.warn('[useTrialEngine] matchTrials fallback:', err.message);
            setIsDemoMode(true);
            setDemoModeBanner('⚡ Backend unreachable — showing demo match results');
            setMatchResults(MOCK_RESULTS);
            setLoading('match', null);
            return MOCK_RESULTS;
        }
    }, [setLoading]);

    // ─────────────────────────────────────────────────────────────────────────────
    // getReport(patient_id, trial_id) → GET /report/{patient_id}/{trial_id}
    // ─────────────────────────────────────────────────────────────────────────────
    const getReport = useCallback(async (patient_id, trial_id) => {
        setLoading('report', 'Generating transparency report...');
        try {
            // ── BACKEND INTEGRATION: Member 3 → GET /report/{patient_id}/{trial_id}
            const res = await fetch(`${API_BASE}/report/patientid/${patient_id}/patientid/${trial_id}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json(); // → TransparencyReport
            // ── END INTEGRATION POINT ─────────────────────────────────────────────
            setReportData(data);
            setLoading('report', null);
            return data;
        } catch (err) {
            console.warn('[useTrialEngine] getReport fallback:', err.message);
            // Find a matching mock result to use as the fallback report
            const fallback = MOCK_RESULTS.find(r => r.trial_id === trial_id) || MOCK_RESULTS[0];
            setReportData(fallback);
            setLoading('report', null);
            return fallback;
        }
    }, [setLoading]);

    // ─────────────────────────────────────────────────────────────────────────────
    // toggleDemoMode() — switches demo mode on/off
    // ─────────────────────────────────────────────────────────────────────────────
    const toggleDemoMode = useCallback(() => {
        setIsDemoMode(prev => {
            const next = !prev;
            if (next) {
                setDemoModeBanner('⚡ Demo Mode active — using simulated data');
                setPatientData(MOCK_PATIENT);
                setMatchResults(MOCK_RESULTS);
            } else {
                setDemoModeBanner(null);
            }
            return next;
        });
    }, []);

    // ─────────────────────────────────────────────────────────────────────────────
    // clearAll() — resets all state to defaults
    // ─────────────────────────────────────────────────────────────────────────────
    const clearAll = useCallback(() => {
        stageTimers.current.forEach(t => clearTimeout(t));
        Object.values(errTimers.current).forEach(t => clearTimeout(t));
        stageTimers.current = [];
        errTimers.current = {};

        setPatientData(null);
        setMatchResults([]);
        setReportData(null);
        setLoadingStatus(INITIAL_LOADING);
        setErrors(INITIAL_ERRORS);
        setIsDemoMode(false);
        setDemoModeBanner(null);
    }, []);

    return {
        // Functions
        uploadPatient,
        matchTrials,
        getReport,
        toggleDemoMode,
        clearAll,
        // Data
        patientData,
        matchResults,
        reportData,
        // UI state
        loadingStatus,
        errors,
        isDemoMode,
        demoModeBanner,
    };
}

// Default export for convenience (Dashboard can import either way)
export default useTrialEngine;
