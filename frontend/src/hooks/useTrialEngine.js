import { useState, useCallback, useRef } from 'react';

// ── API base ──────────────────────────────────────────────────────────────────
const API_BASE =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
        ? import.meta.env.VITE_API_BASE_URL
        : 'http://localhost:8000';

// ── Initial state shapes ──────────────────────────────────────────────────────
const INIT_LOADING = { upload: null, match: null, report: null, verify: null, feedback: null };
const INIT_ERRORS = { upload: null, match: null, report: null, verify: null, feedback: null };

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
    // toggleDemoMode — flips isDemoMode, updates banner message
    // ══════════════════════════════════════════════════════════════════════════
    const toggleDemoMode = useCallback(() => {
        setIsDemoMode(prev => {
            const next = !prev;
            setDemoModeBanner(
                next
                    ? '⚡ Demo Mode — Connect your backend to use real patient data'
                    : null
            );
            return next;
        });
    }, []);

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
