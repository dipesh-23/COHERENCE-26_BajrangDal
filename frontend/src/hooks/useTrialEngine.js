import { useState, useCallback, useRef } from 'react';

// ── API base ──────────────────────────────────────────────────────────────────
const API_BASE =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
        ? import.meta.env.VITE_API_BASE_URL
        : 'http://localhost:8000';

// ── Initial state shapes ──────────────────────────────────────────────────────
const INIT_LOADING = { upload: null, match: null, report: null, verify: null, feedback: null };
const INIT_ERRORS = { upload: null, match: null, report: null, verify: null, feedback: null };

// ── Perfect Hackathon Demo Data ───────────────────────────────────────────────
const DEMO_PATIENT = {
    patient_id: "P-84921",
    age: 62,
    gender: "Female",
    zip: "10029",
    diagnoses: [
        "Type 2 Diabetes Mellitus (ICD E11.9)",
        "Stage 3a Chronic Kidney Disease (ICD N18.31)",
        "Essential Hypertension (ICD I10)"
    ],
    medications: [
        "Metformin 1000mg (twice daily)",
        "Lisinopril 10mg (once daily)",
        "Atorvastatin 40mg (once daily)"
    ],
    labs: {
        HbA1c: 8.4,
        eGFR: 48,
        Creatinine: 1.4
    },
    history_text: "[REDACTED] 62yo F presents with poorly controlled T2DM. Current regimen insufficient. Recent labs show declining renal function. Patient resides in East Harlem (HPSA-designated ZIP 10029). Candidate for advanced therapy escalation."
};

const DEMO_RESULTS = [
    {
        patient_id: "P-84921",
        trial_id: "NCT-2026-EMBARK-001",
        trial_name: "EMBARK-T2DM Phase III",
        match_score: 92,
        confidence: "HIGH",
        phase: "Phase III",
        sponsor: "NovaBiomed Inc.",
        location: "Mount Sinai Hospital, New York, NY",
        distance_string: "4 miles away",
        hpsa_flagged: false,
        criteria_breakdown: [
            {
                name: "Age 45–70",
                status: "met",
                detail: "Patient age 62 falls within the required range of 45 to 70 years."
            },
            {
                name: "T2DM Diagnosis (ICD E11.9)",
                status: "met",
                detail: "Confirmed Type 2 Diabetes Mellitus diagnosis on record."
            },
            {
                name: "HbA1c ≥ 7.5%",
                status: "met",
                detail: "Patient HbA1c of 8.4% exceeds the minimum threshold of 7.5%."
            },
            {
                name: "Active Metformin Use",
                status: "met",
                detail: "Metformin 1000mg is listed as an active medication."
            },
            {
                name: "eGFR ≥ 45 mL/min",
                status: "verify",
                detail: "Patient eGFR is 48 mL/min, marginally above the threshold of 45. Lab confirmation within 30 days required before enrollment."
            },
            {
                name: "No Prior GLP-1 Agonist Use",
                status: "met",
                detail: "No GLP-1 agonist medications found in the patient's medication history."
            }
        ],
        missing_data: ["eGFR lab confirmation within 30 days"],
        exclusion_flags: [],
        recommendation: "Proceed",
        narrative_text: "Patient P-84921 is a strong candidate for the EMBARK-T2DM Phase III trial.",
        llm_explanation: "This 62-year-old female with poorly controlled Type 2 Diabetes (HbA1c 8.4%) and active Metformin therapy aligns precisely with the EMBARK-T2DM primary inclusion profile. Her age of 62 sits comfortably within the 45–70 window, and the absence of prior GLP-1 agonist use makes her an ideal candidate for this investigational agent. The single item requiring verification is her eGFR value of 48 mL/min — while this exceeds the trial threshold of 45, the protocol requires a confirmed lab result dated within 30 days of enrollment. A GP-requested lab confirmation would resolve this and elevate confidence to maximum. Overall clinical profile: STRONG MATCH. Recommend proceeding to enrollment inquiry with renal lab verification."
    },
    {
        patient_id: "P-84921",
        trial_id: "NCT-2026-RENAL-002",
        trial_name: "Renal-Protect Urban Outcomes",
        match_score: 78,
        confidence: "MEDIUM",
        phase: "Phase II",
        sponsor: "Urban Health Consortium",
        location: "Harlem Hospital Center, New York, NY",
        distance_string: "1.2 miles away",
        hpsa_flagged: true,
        criteria_breakdown: [
            {
                name: "Stage 3 CKD (eGFR 30–59)",
                status: "met",
                detail: "Patient eGFR of 48 mL/min places them in Stage 3a CKD, matching this criterion exactly."
            },
            {
                name: "Hypertension Diagnosis",
                status: "met",
                detail: "Essential Hypertension (ICD I10) confirmed on patient record."
            },
            {
                name: "ACE Inhibitor or ARB Use",
                status: "met",
                detail: "Lisinopril 10mg (ACE inhibitor) is an active medication."
            },
            {
                name: "Urban HPSA Resident",
                status: "met",
                detail: "Patient ZIP 10029 (East Harlem) is a federally designated Health Professional Shortage Area."
            },
            {
                name: "No Active Malignancy",
                status: "verify",
                detail: "No cancer history recorded, but formal oncology clearance not documented. Verification recommended."
            },
            {
                name: "Proteinuria Confirmed",
                status: "verify",
                detail: "Urine albumin-to-creatinine ratio (UACR) not present in current record. Required for enrollment."
            }
        ],
        missing_data: [
            "Oncology clearance documentation",
            "Urine albumin-to-creatinine ratio (UACR)"
        ],
        exclusion_flags: [],
        recommendation: "Verify First",
        narrative_text: "Patient shows strong alignment with urban CKD outcomes trial, pending two verification items.",
        llm_explanation: "The Renal-Protect Urban Outcomes trial was specifically designed for patients matching this profile — urban-dwelling individuals with Stage 3 CKD, hypertension, and active renin-angiotensin system blockade. Patient P-84921 satisfies all four primary inclusion criteria. The HPSA designation of her East Harlem ZIP code (10029) also triggers an equity-based priority weighting in our scoring model, reflecting the trial's focus on underserved urban populations. Two items remain unverified: a urine albumin-to-creatinine ratio (UACR) which is standard pre-enrollment renal workup, and a formal oncology clearance statement. Both are routine documentation requests. If verified, this trial could be elevated to HIGH confidence. The geographic proximity of 1.2 miles to Harlem Hospital Center further strengthens the case for patient engagement."
    },
    {
        patient_id: "P-84921",
        trial_id: "NCT-2026-GLP1-003",
        trial_name: "GLP-1 Aggressive Titration Study",
        match_score: 42,
        confidence: "HIGH",
        phase: "Phase II",
        sponsor: "EndoTherapeutics Corp.",
        location: "NYU Langone Medical Center, New York, NY",
        distance_string: "5.8 miles away",
        hpsa_flagged: false,
        criteria_breakdown: [
            {
                name: "Age 40–75",
                status: "met",
                detail: "Patient age 62 is within the acceptable age range."
            },
            {
                name: "T2DM Diagnosis",
                status: "met",
                detail: "Type 2 Diabetes Mellitus confirmed."
            },
            {
                name: "HbA1c ≥ 8.0%",
                status: "met",
                detail: "Patient HbA1c of 8.4% meets the minimum threshold."
            },
            {
                name: "eGFR ≥ 60 mL/min (Safety Threshold)",
                status: "unmet",
                detail: "Patient eGFR of 48 mL/min is BELOW the mandatory safety threshold of 60 mL/min. GLP-1 aggressive titration carries nephrotoxicity risk in patients with eGFR < 60. This is a hard exclusion."
            },
            {
                name: "No Metformin Contraindication",
                status: "met",
                detail: "Patient is actively tolerating Metformin without documented contraindication."
            },
            {
                name: "No Prior GLP-1 Exposure",
                status: "met",
                detail: "No GLP-1 agonist found in medication history."
            }
        ],
        missing_data: [],
        exclusion_flags: [
            "eGFR 48 mL/min is below the mandatory safety threshold of 60 mL/min — nephrotoxicity risk at aggressive GLP-1 titration doses",
            "Stage 3a CKD diagnosis conflicts with protocol safety requirements for renal clearance"
        ],
        recommendation: "Not Suitable",
        narrative_text: "Despite meeting age and glycemic criteria, patient is excluded due to renal safety threshold violation.",
        llm_explanation: "Patient P-84921 meets the glycemic and demographic criteria for the GLP-1 Aggressive Titration Study — her HbA1c of 8.4% and T2DM diagnosis are directly on target. However, the trial protocol contains a hard safety exclusion for patients with eGFR below 60 mL/min due to the nephrotoxicity risk associated with aggressive GLP-1 titration in renally impaired patients. With an eGFR of 48 mL/min, this patient falls into Stage 3a CKD and cannot safely participate under current protocol. This exclusion is binary and cannot be overridden by verification or additional documentation. The rule-based engine flagged this immediately. Recommendation: NOT SUITABLE. However, the EMBARK-T2DM trial (Trial 1) represents a far safer and equally appropriate alternative for this patient's glycemic management needs."
    }
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function authHeaders(token) {
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function parseResponse(res) {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
}

// ═════════════════════════════════════════════════════════════════════════════
// Hook
// ═════════════════════════════════════════════════════════════════════════════
export function useTrialEngine(token = null) {
    // ── Data state ──────────────────────────────────────────────────────────────
    const [patientData, setPatientData] = useState(null);
    const [matchResults, setMatchResults] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(INIT_LOADING);
    const [errors, setErrors] = useState(INIT_ERRORS);
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [demoModeBanner, setDemoModeBanner] = useState(null);

    // ── Timer refs for auto-clearing errors ────────────────────────────────────
    const errTimers = useRef({});

    // ── Error helper — auto-clears after 5 s ───────────────────────────────────
    const setError = useCallback((key, message) => {
        clearTimeout(errTimers.current[key]);
        setErrors(prev => ({ ...prev, [key]: message }));
        errTimers.current[key] = setTimeout(
            () => setErrors(prev => ({ ...prev, [key]: null })),
            5000
        );
    }, []);

    // ── Loading helpers ────────────────────────────────────────────────────────
    const setLoading = useCallback((key, msg) =>
        setLoadingStatus(prev => ({ ...prev, [key]: msg })), []);
    const clearLoading = useCallback((key) =>
        setLoadingStatus(prev => ({ ...prev, [key]: null })), []);

    // ══════════════════════════════════════════════════════════════════════════
    // uploadPatient(file: File) → POST /ingest/patient
    // ══════════════════════════════════════════════════════════════════════════
    const uploadPatient = useCallback(async (file) => {
        if (!file) { setError('upload', 'No file provided.'); return; }

        // Stage 1 — parse
        setLoading('upload', 'Parsing record…');

        let data;
        try {
            const text = await file.text();
            data = JSON.parse(text);
        } catch {
            setError('upload', 'Invalid JSON — could not parse file.');
            clearLoading('upload');
            return;
        }

        // Stage 2 — anonymising (500 ms after start)
        const t1 = setTimeout(() => setLoading('upload', 'Anonymizing PHI via Presidio…'), 500);
        // Stage 3 — validating (1000 ms after start)
        const t2 = setTimeout(() => setLoading('upload', 'Validating schema…'), 1000);

        try {
            const res = await fetch(`${API_BASE}/ingest/patient`, {
                method: 'POST',
                headers: authHeaders(token),
                body: JSON.stringify(data),
            });
            clearTimeout(t1); clearTimeout(t2);
            if (!res.ok) {
                const body = await parseResponse(res);
                throw new Error(body?.detail || body?.message || `Server error (${res.status})`);
            }
            const anon = await parseResponse(res);
            setPatientData(anon);
        } catch (err) {
            clearTimeout(t1); clearTimeout(t2);
            setError('upload', err.message || 'Upload failed.');
        } finally {
            clearLoading('upload');
        }
    }, [token, setError, setLoading, clearLoading]);

    // ══════════════════════════════════════════════════════════════════════════
    // matchTrials(patient_id, top_k, filters) → POST /match
    // ══════════════════════════════════════════════════════════════════════════
    const matchTrials = useCallback(async (patient_id, top_k = 5, filters = {}) => {
        setLoading('match', 'Finding matching trials…');
        try {
            const res = await fetch(`${API_BASE}/match`, {
                method: 'POST',
                headers: authHeaders(token),
                body: JSON.stringify({ patient_id, top_k, filters }),
            });
            if (!res.ok) {
                const body = await parseResponse(res);
                throw new Error(body?.detail || body?.message || `Server error (${res.status})`);
            }
            const results = await parseResponse(res);
            setMatchResults(Array.isArray(results) ? results : []);
        } catch (err) {
            setError('match', err.message || 'Matching failed.');
        } finally {
            clearLoading('match');
        }
    }, [token, setError, setLoading, clearLoading]);

    // ══════════════════════════════════════════════════════════════════════════
    // getReport(patient_id, trial_id) → GET /report/{patient_id}/{trial_id}
    // ══════════════════════════════════════════════════════════════════════════
    const getReport = useCallback(async (patient_id, trial_id) => {
        setLoading('report', 'Generating transparency report…');
        try {
            const res = await fetch(
                `${API_BASE}/report/${encodeURIComponent(patient_id)}/${encodeURIComponent(trial_id)}`,
                { headers: authHeaders(token) }
            );
            if (!res.ok) {
                const body = await parseResponse(res);
                throw new Error(body?.detail || body?.message || `Server error (${res.status})`);
            }
            const report = await parseResponse(res);
            setReportData(report);
        } catch (err) {
            setError('report', err.message || 'Failed to load report.');
        } finally {
            clearLoading('report');
        }
    }, [token, setError, setLoading, clearLoading]);

    // ══════════════════════════════════════════════════════════════════════════
    // verifyField(patient_id, field) → POST /verify/{patient_id}/{field}
    // On success: remove field from missing_data in all matching MatchResults
    // ══════════════════════════════════════════════════════════════════════════
    const verifyField = useCallback(async (patient_id, field) => {
        setLoading('verify', 'Marking field as verified…');
        try {
            const res = await fetch(
                `${API_BASE}/verify/${encodeURIComponent(patient_id)}/${encodeURIComponent(field)}`,
                {
                    method: 'POST',
                    headers: authHeaders(token),
                }
            );
            if (!res.ok) {
                const body = await parseResponse(res);
                throw new Error(body?.detail || body?.message || `Server error (${res.status})`);
            }
            // Patch matchResults — strip verified field from missing_data
            setMatchResults(prev =>
                prev.map(r =>
                    r.patient_id === patient_id
                        ? { ...r, missing_data: (r.missing_data || []).filter(d => d !== field) }
                        : r
                )
            );
        } catch (err) {
            setError('verify', err.message || 'Verification failed.');
        } finally {
            clearLoading('verify');
        }
    }, [token, setError, setLoading, clearLoading]);

    // ══════════════════════════════════════════════════════════════════════════
    // submitFeedback → POST /feedback
    // ══════════════════════════════════════════════════════════════════════════
    const submitFeedback = useCallback(async (trial_id, patient_id, helpful, role) => {
        setLoading('feedback', 'Submitting feedback…');
        try {
            const res = await fetch(`${API_BASE}/feedback`, {
                method: 'POST',
                headers: authHeaders(token),
                body: JSON.stringify({
                    trial_id,
                    patient_id,
                    helpful,
                    role,
                    timestamp: new Date().toISOString(),
                }),
            });
            if (!res.ok) {
                const body = await parseResponse(res);
                throw new Error(body?.detail || body?.message || `Server error (${res.status})`);
            }
            // Success — no data state change needed
        } catch (err) {
            setError('feedback', err.message || 'Feedback submission failed.');
        } finally {
            clearLoading('feedback');
        }
    }, [token, setError, setLoading, clearLoading]);

    // ══════════════════════════════════════════════════════════════════════════
    // loadDemoData — Stage simulated loading process and set mock state
    // ══════════════════════════════════════════════════════════════════════════
    const loadDemoData = useCallback(() => {
        // Simulate staged loading experience even in demo mode
        setLoadingStatus(prev => ({ ...prev, upload: 'Parsing record...' }));
        setTimeout(() => {
            setLoadingStatus(prev => ({ ...prev, upload: 'Anonymizing PHI via Presidio...' }));
        }, 600);
        setTimeout(() => {
            setLoadingStatus(prev => ({ ...prev, upload: 'Validating schema...' }));
        }, 1200);
        setTimeout(() => {
            setPatientData(DEMO_PATIENT);
            setLoadingStatus(prev => ({ ...prev, upload: null }));
        }, 1800);

        // Simulate match loading after patient loads
        setTimeout(() => {
            setLoadingStatus(prev => ({ ...prev, match: 'Finding matching trials...' }));
        }, 2000);
        setTimeout(() => {
            setMatchResults(DEMO_RESULTS);
            setLoadingStatus(prev => ({ ...prev, match: null }));
        }, 3200);
    }, []);

    // ══════════════════════════════════════════════════════════════════════════
    // toggleDemoMode — flips isDemoMode, updates banner message, and loads data
    // ══════════════════════════════════════════════════════════════════════════
    const toggleDemoMode = useCallback(() => {
        setIsDemoMode(prev => {
            const next = !prev;
            if (next) {
                loadDemoData();
                setDemoModeBanner('⚡ Demo Mode — Using simulated patient data');
            } else {
                // Must be inside the setIsDemoMode callback or wrapped properly?
                // Actually, clearAll is outside, but it's safe to call here since it sets other state.
                setPatientData(null);
                setMatchResults([]);
                setReportData(null);
                setLoadingStatus(INIT_LOADING);
                setErrors(INIT_ERRORS);
                setDemoModeBanner(null);
            }
            return next;
        });
    }, [loadDemoData]);

    // ══════════════════════════════════════════════════════════════════════════
    // clearAll — resets all state to initial
    // ══════════════════════════════════════════════════════════════════════════
    const clearAll = useCallback(() => {
        // Cancel any pending error-clear timers
        Object.values(errTimers.current).forEach(clearTimeout);
        errTimers.current = {};
        setPatientData(null);
        setMatchResults([]);
        setReportData(null);
        setLoadingStatus(INIT_LOADING);
        setErrors(INIT_ERRORS);
        setIsDemoMode(false);
        setDemoModeBanner(null);
    }, []);

    // ── Return object ───────────────────────────────────────────────────────────
    return {
        // Actions
        uploadPatient,
        matchTrials,
        getReport,
        verifyField,
        submitFeedback,
        toggleDemoMode,
        clearAll,
        // State
        patientData,
        matchResults,
        reportData,
        loadingStatus,
        errors,
        isDemoMode,
        demoModeBanner,
    };
}

// Named export above + default export below (both required)
export default useTrialEngine;
