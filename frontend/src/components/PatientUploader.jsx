import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─── API Config ────────────────────────────────────────────────────────────────
// TODO: replace with real base URL once backend is deployed
// e.g. const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_BASE = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Demo fallback patient (used if backend is unavailable) ───────────────────
const DEMO_PATIENT = {
    patient_id: "P-DEMO-001",
    age: 52,
    gender: "Female",
    zip: "10001",
    diagnoses: ["E11.9 - Type 2 Diabetes", "I10 - Hypertension"],
    labs: { HbA1c: 8.2, eGFR: 71, Creatinine: 1.1 },
    medications: ["Metformin 1000mg", "Lisinopril 10mg"],
    history_text: "[REDACTED - PHI removed by Presidio]"
};

// ─── Staged loading steps ─────────────────────────────────────────────────────
const LOAD_STEPS = [
    { id: 'parse', label: '🔍 Parsing record...' },
    { id: 'anon', label: '🔒 Anonymizing PHI via Presidio...' },
    { id: 'validate', label: '✅ Validating schema...' },
];

// ─── JSON validation helper ────────────────────────────────────────────────────
function validatePatient(data) {
    const errors = [];
    const warnings = [];

    if (!data || typeof data !== 'object') errors.push('Invalid JSON structure.');
    if (typeof data.age !== 'number') errors.push('Missing or invalid field: age (must be a number).');
    if (typeof data.gender !== 'string') errors.push('Missing or invalid field: gender (must be a string).');
    if (!Array.isArray(data.diagnoses)) errors.push('Missing or invalid field: diagnoses (must be an array).');

    if (!data.labs || Object.keys(data.labs).length === 0)
        warnings.push('⚠️ No lab values — some trial matches may be incomplete.');
    if (Array.isArray(data.medications) && data.medications.length === 0)
        warnings.push('⚠️ No medications listed.');
    if (!data.zip || !/^\d{5}$/.test(String(data.zip)))
        warnings.push('⚠️ Invalid ZIP — location filtering disabled.');

    return { errors, warnings };
}

// ─── Lab value display helper ──────────────────────────────────────────────────
function labColor(key, value) {
    if (key === 'HbA1c') return value > 7 ? 'text-red-400' : 'text-emerald-400';
    if (key === 'eGFR') return value < 60 ? 'text-amber-400' : 'text-emerald-400';
    return 'text-slate-400';
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PatientUploader({
    // Called with AnonymizedPatient once backend responds (or demo fallback)
    onPatientLoaded = () => { },
    isDemoMode = false,
}) {
    const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
    const [patient, setPatient] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [loadStep, setLoadStep] = useState(-1);       // index of active loading step
    const [completedSteps, setCompletedSteps] = useState([]);
    const [progress, setProgress] = useState(0);
    const [demoBannerVisible, setDemoBannerVisible] = useState(true);

    const fileInputRef = useRef(null);

    // ── Demo mode: auto-load demo patient ──
    useEffect(() => {
        if (isDemoMode && state === 'idle') {
            runLoadSequence(null, DEMO_PATIENT);
        }
    }, [isDemoMode]);

    // ── Simulate staged loading + optional real API call ──
    const runLoadSequence = useCallback(async (rawData, override = null) => {
        setState('loading');
        setLoadStep(0);
        setCompletedSteps([]);
        setProgress(0);

        const stepDuration = 600; // ms per step
        const totalDuration = 1800;

        // Animate progress bar
        const progressInterval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) { clearInterval(progressInterval); return 100; }
                return p + 100 / (totalDuration / 50);
            });
        }, 50);

        // Step 0 — Parsing
        setLoadStep(0);
        await delay(stepDuration);
        setCompletedSteps(['parse']);

        // Step 1 — Anonymize via Presidio (real API call happens here)
        setLoadStep(1);
        let result = override;
        if (!result && rawData) {
            try {
                // ── BACKEND INTEGRATION POINT ────────────────────────────────────────
                // Replace this fetch with your real Member 1 endpoint.
                // Expected: POST /ingest/patient → returns AnonymizedPatient JSON
                const response = await fetch(`${API_BASE}/ingest/patient`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rawData),
                });
                if (!response.ok) throw new Error(`Server error: ${response.status}`);
                result = await response.json();
                // ── END BACKEND INTEGRATION POINT ────────────────────────────────────
            } catch (apiErr) {
                console.warn('[PatientUploader] API unavailable, using demo fallback:', apiErr.message);
                // Fallback: use raw data with redacted history (simulates Presidio output)
                result = { ...rawData, history_text: '[REDACTED - PHI removed by Presidio]' };
            }
        }
        await delay(stepDuration);
        setCompletedSteps(s => [...s, 'anon']);

        // Step 2 — Schema validation
        setLoadStep(2);
        await delay(stepDuration / 2);
        setCompletedSteps(s => [...s, 'validate']);
        setProgress(100);

        clearInterval(progressInterval);

        // Compute warnings from validated/returned data
        const { warnings: w } = validatePatient(result);
        setWarnings(w);
        setPatient(result);
        setState('success');
        onPatientLoaded(result);
    }, [onPatientLoaded]);

    // ── Handle file selection ──
    const handleFile = useCallback((file) => {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            setErrorMsg('File too large. Maximum size is 10MB.');
            setState('error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                const { errors } = validatePatient(parsed);
                if (errors.length > 0) {
                    setErrorMsg(errors.join(' '));
                    setState('error');
                    return;
                }
                runLoadSequence(parsed);
            } catch {
                setErrorMsg('Could not parse JSON. Please upload a valid .json file.');
                setState('error');
            }
        };
        reader.readAsText(file);
    }, [runLoadSequence]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleInputChange = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    }, [handleFile]);

    const handleReset = () => {
        setState('idle');
        setPatient(null);
        setWarnings([]);
        setErrorMsg('');
        setLoadStep(-1);
        setCompletedSteps([]);
        setProgress(0);
    };

    return (
        <div className="flex flex-col gap-2">
            <style>{`
        @keyframes floatCloud {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        .animate-float { animation: floatCloud 2.5s ease-in-out infinite; }
        @keyframes fadeInStep {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-step { animation: fadeInStep 0.35s ease-out forwards; }
      `}</style>

            {/* ── 1. Demo Banner ── */}
            {isDemoMode && demoBannerVisible && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center justify-between">
                    <div>
                        <span className="text-amber-400 font-bold text-sm">⚡ Demo Mode</span>
                        <span className="text-amber-500/70 text-xs ml-2">Using simulated data</span>
                    </div>
                    <button
                        onClick={() => setDemoBannerVisible(false)}
                        className="text-amber-500/60 hover:text-amber-400 transition-colors text-lg leading-none ml-2"
                        aria-label="Dismiss"
                    >✕</button>
                </div>
            )}

            {/* ── 2. UPLOAD ZONE (idle only) ── */}
            {state === 'idle' && (
                <div
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 select-none
            ${dragOver ? 'border-blue-500 bg-blue-500/5 scale-[1.02]' : 'border-slate-600 bg-slate-900/50 hover:border-slate-400'}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={handleInputChange}
                    />
                    <div className="text-4xl mb-3 animate-float select-none">☁️</div>
                    <p className="text-slate-300 font-semibold text-sm">Drop Patient JSON here</p>
                    <p className="text-xs mt-1">
                        <span className="text-blue-400 underline cursor-pointer">or click to browse</span>
                    </p>
                    <p className="text-slate-600 text-xs mt-2">Supports .json · Max 10MB</p>
                </div>
            )}

            {/* ── 3. LOADING STATE ── */}
            {state === 'loading' && (
                <div className="border-2 border-blue-500/40 bg-blue-500/5 rounded-2xl p-5">
                    {/* Progress bar */}
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mb-4 overflow-hidden">
                        <div
                            className="h-1.5 bg-blue-500 rounded-full transition-all duration-100 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    {/* Steps */}
                    <div className="space-y-2.5">
                        {LOAD_STEPS.map((step, idx) => {
                            const isDone = completedSteps.includes(step.id);
                            const isActive = loadStep === idx && !isDone;
                            const isPending = loadStep < idx;
                            return (
                                <div key={step.id} className={`flex items-center gap-2.5 text-sm animate-step ${isPending ? 'opacity-30' : 'opacity-100'}`}
                                    style={{ animationDelay: `${idx * 150}ms` }}>
                                    {isDone ? (
                                        <span className="text-emerald-400 text-base">✅</span>
                                    ) : isActive ? (
                                        <svg className="w-4 h-4 animate-spin text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                    ) : (
                                        <span className="w-4 h-4 rounded-full border border-slate-600 inline-block"></span>
                                    )}
                                    <span className={isDone ? 'text-emerald-300' : isActive ? 'text-blue-300' : 'text-slate-500'}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── 4. SUCCESS STATE ── */}
            {state === 'success' && patient && (
                <div className="border-2 border-emerald-500/40 bg-emerald-500/5 rounded-2xl p-4 flex flex-col gap-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">✅</span>
                            <span className="text-emerald-400 font-bold text-sm">Patient Record Loaded</span>
                        </div>
                        <button onClick={handleReset} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
                            Clear ↺
                        </button>
                    </div>

                    {/* Patient ID */}
                    <span className="font-mono text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md border border-slate-700 w-max">
                        {patient.patient_id}
                    </span>

                    {/* Summary chips */}
                    <div className="flex flex-wrap gap-1.5">
                        <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-full px-2 py-0.5 text-xs font-semibold">
                            {patient.age} yrs
                        </span>
                        <span className="bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded-full px-2 py-0.5 text-xs font-semibold">
                            {patient.gender}
                        </span>
                        <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 text-xs font-semibold">
                            {patient.diagnoses?.length || 0} Diagnoses
                        </span>
                        <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5 text-xs font-semibold">
                            {patient.medications?.length || 0} Medications
                        </span>
                    </div>

                    {/* Lab values */}
                    {patient.labs && Object.keys(patient.labs).length > 0 && (
                        <div className="flex gap-4 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                            {Object.entries(patient.labs).map(([key, val]) => (
                                <div key={key} className="flex flex-col items-center">
                                    <span className={`text-sm font-bold tabular-nums ${labColor(key, val)}`}>
                                        {val}{key === 'HbA1c' ? '%' : ''}
                                    </span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">{key}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Warnings */}
                    {warnings.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {warnings.map((w, i) => (
                                <span key={i} className="bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg px-2 py-1 text-[11px] font-medium">
                                    {w}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* PHI redaction notice */}
                    {patient.history_text?.includes('[REDACTED]') && (
                        <p className="text-slate-500 text-xs italic">🔒 History anonymized</p>
                    )}
                </div>
            )}

            {/* ── 5. ERROR STATE ── */}
            {state === 'error' && (
                <div className="border-2 border-red-500/40 bg-red-500/5 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">❌</span>
                        <span className="text-red-400 font-semibold text-sm">{errorMsg || 'Upload failed.'}</span>
                    </div>
                    <button
                        onClick={handleReset}
                        className="self-start bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-xs font-bold px-4 py-2 rounded-lg transition-colors duration-150"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* ── 6. PHI NOTICE ── */}
            <div className="flex items-start gap-1.5 mt-1">
                <span className="text-[11px] leading-none mt-0.5">🔒</span>
                <p className="text-slate-600 text-[11px] leading-snug">
                    All PHI anonymized before processing. No identifiable data transmitted.
                </p>
            </div>
        </div>
    );
}

// ─── Internal helper ──────────────────────────────────────────────────────────
function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}
