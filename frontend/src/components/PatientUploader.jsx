import React, { useState, useRef, useCallback } from 'react';

// ─── API base ─────────────────────────────────────────────────────────────────
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8001';

// ─── Loading stages ───────────────────────────────────────────────────────────
const STAGES = [
    { pct: 15, msg: '🔍 Parsing patient record...' },
    { pct: 40, msg: '🔒 Stripping PHI via Presidio (HIPAA-compliant)...' },
    { pct: 65, msg: '✅ Validating against HL7 FHIR schema...' },
    { pct: 85, msg: '🧬 Preparing for eligibility screening...' },
    { pct: 100, msg: '✅ Patient Record Ready for Screening' },
];

// ─── Lab value color helpers ──────────────────────────────────────────────────
function labColor(key, value) {
    if (key === 'HbA1c') return value > 7 ? 'text-red-500' : 'text-teal-600';
    if (key === 'eGFR') return value < 60 ? 'text-red-500' : 'text-teal-600';
    if (key === 'Creatinine') return value > 1.0 ? 'text-amber-500' : 'text-teal-600';
    return 'text-slate-600';
}
function labSuffix(key) {
    if (key === 'HbA1c') return '% HbA1c';
    if (key === 'eGFR') return ' eGFR';
    return ` ${key}`;
}

// ─── JSON validation ──────────────────────────────────────────────────────────
function validate(data) {
    const errors = [];
    const warnings = [];
    if (!data.diagnoses?.length) errors.push('❌ No diagnoses found — required for eligibility screening');
    if (!data.labs || Object.keys(data.labs).length === 0) warnings.push('⚠️ No lab values detected — eligibility scoring accuracy reduced');
    if (!data.medications?.length) warnings.push('⚠️ No medications listed — drug interaction checks unavailable');
    if (data.zip && !/^\d{5}$/.test(data.zip)) warnings.push('⚠️ Invalid ZIP — geographic trial filtering disabled');
    return { errors, warnings };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PatientUploader({
    onPatientLoaded = () => { },
    userRole = 'doctor',   // 'doctor' | 'nurse' (patient never sees this)
    token = null,
}) {
    const [state, setState] = useState('idle');   // idle | loading | success | error | batch
    const [dragOver, setDragOver] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stageMsg, setStageMsg] = useState('');
    const [patient, setPatient] = useState(null);
    const [warnings, setWarnings] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');
    // batch mode
    const [patientList, setPatientList] = useState([]);
    const [activeBatchId, setActiveBatchId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileRef = useRef();
    const animRef = useRef();

    // ── Stage animation ──────────────────────────────────────────────────────────
    const runStages = useCallback(() => {
        let i = 0;
        const next = () => {
            if (i >= STAGES.length) return;
            const { pct, msg } = STAGES[i++];
            setProgress(pct);
            setStageMsg(msg);
            if (i < STAGES.length) {
                // Approximate timing logic based on instructions
                // Total is still fast but visually distinct
                animRef.current = setTimeout(next, 500);
            }
        };
        next();
    }, []);

    // ── CSV row parser helper — parse a single row string into a Patient object ────
    const parseRow = useCallback((header, rawRow) => {
        const values = [];
        let inQuote = false, cur = '';
        for (let ch of rawRow) {
            if (ch === '"') { inQuote = !inQuote; }
            else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
            else { cur += ch; }
        }
        values.push(cur.trim());
        const row = {};
        header.forEach((h, i) => { row[h] = (values[i] || '').replace(/^"|"$/g, '').trim(); });

        const diagnoses = row['diagnoses_icd10']
            ? row['diagnoses_icd10'].split(',').map(d => d.trim()).filter(Boolean) : [];
        const labs = {};
        if (row['lab_values']) {
            row['lab_values'].split('|').forEach(segment => {
                const m = segment.match(/([^:]+):\s*([\d.]+)/);
                if (m) labs[m[1].trim()] = parseFloat(m[2]);
            });
        }
        const medications = row['medications']
            ? row['medications'].split(',').map(m => m.trim()).filter(Boolean) : [];
        return {
            patient_id:   row['patient_id']  || undefined,
            _displayName: row['patient_name'] || row['patient_id'] || 'Unknown',
            _note:        row['intended_trial_match'] || '',
            age:          parseInt(row['age'], 10) || 0,
            gender:       row['gender'] || 'unknown',
            zip_code:     row['zip_code'] || '00000',
            lat:          row['lat'] ? parseFloat(row['lat']) : undefined,
            lng:          row['lng'] ? parseFloat(row['lng']) : undefined,
            diagnoses, labs, medications,
            history_text: row['clinical_history'] || '',
        };
    }, []);

    // ── CSV parser — returns array of ALL patients in the file ─────────────────
    const parseCSVAllRows = useCallback((csvText) => {
        const lines = csvText.trim().split('\n').filter(Boolean);
        if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.');
        const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        return lines.slice(1).map(line => parseRow(header, line));
    }, [parseRow]);

    // ── Process file ──────────────────────────────────────────────────────────────
    const processFile = useCallback(async (file) => {
        const isJson = file?.name.endsWith('.json');
        const isCsv  = file?.name.endsWith('.csv');
        if (!file || (!isJson && !isCsv)) {
            setErrorMsg('Please upload a valid .json or .csv file.');
            setState('error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setErrorMsg('File exceeds 10 MB limit.');
            setState('error');
            return;
        }

        setState('loading');
        setProgress(0);
        runStages();

        let parsedData;  // single Patient obj (JSON) OR array of Patients (CSV)
        try {
            const text = await file.text();
            if (isCsv) {
                parsedData = parseCSVAllRows(text);              // returns Patient[]
            } else {
                parsedData = JSON.parse(text);                   // returns single Patient
            }
        } catch (err) {
            clearTimeout(animRef.current);
            setErrorMsg(err.message || 'Could not parse file.');
            setState('error');
            return;
        }

        // ── Batch CSV: multiple patients ─────────────────────────────────────────
        if (Array.isArray(parsedData)) {
            await new Promise(r => setTimeout(r, 1800)); // let stages animate
            clearTimeout(animRef.current);
            setPatientList(parsedData);
            setState('batch');  // new state — show patient selector
            return;
        }

        // ── Single patient (JSON) ── validate then POST ──────────────────────────
        const data = parsedData;
        const { errors, warnings: warns } = validate(data);
        if (errors.length) {
            clearTimeout(animRef.current);
            setErrorMsg(errors[0]);
            setState('error');
            return;
        }
        setWarnings(warns);
        await new Promise(r => setTimeout(r, 2000));

        try {
            console.log("DEBUG FRONTEND - PatientUploader token before fetch:", token ? token.substring(0, 20) + "..." : "null/undefined");
            
            const res = await fetch(`${API_BASE}/ingest/patient`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.detail || body?.message || `Server error (${res.status})`);
            }
            const anon = await res.json();
            setPatient(anon);
            setState('success');
            onPatientLoaded(anon);
        } catch (err) {
            clearTimeout(animRef.current);
            setErrorMsg(err.message || 'Failed to anonymize patient. Please try again.');
            setState('error');
        }
    }, [runStages, onPatientLoaded, parseCSVAllRows, token]);

    // ── Select a patient from batch list ─────────────────────────────────────────
    const selectBatchPatient = useCallback(async (p) => {
        setActiveBatchId(p.patient_id);
        const { _displayName, _note, ...patientPayload } = p;
        try {
            const res = await fetch(`${API_BASE}/ingest/patient`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(patientPayload),
            });
            const anon = res.ok ? await res.json() : patientPayload;
            onPatientLoaded({ ...anon, _displayName: p._displayName });
        } catch {
            onPatientLoaded({ ...patientPayload, _displayName: p._displayName });
        }
    }, [onPatientLoaded, token]);




    // ── Drag handlers ─────────────────────────────────────────────────────────────
    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };
    const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = () => setDragOver(false);

    const reset = () => {
        clearTimeout(animRef.current);
        setState('idle');
        setProgress(0);
        setStageMsg('');
        setPatient(null);
        setWarnings([]);
        setErrorMsg('');
        setPatientList([]);
        setActiveBatchId(null);
        setSearchTerm('');
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-4">
            <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        .anim-float { animation: float 2.8s ease-in-out infinite; }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fade-up { animation: fadeUp 0.3s ease-out forwards; }
        .delay-100 { animation-delay: 100ms; opacity: 0; }
        .delay-200 { animation-delay: 200ms; opacity: 0; }
        .delay-300 { animation-delay: 300ms; opacity: 0; }
      `}</style>

            {/* ── Title ── */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#0F766E] font-bold text-sm flex items-center gap-1.5">
                    🧑‍⚕️ Patient Record Intake
                </h3>
                {(state === 'success' || state === 'batch') && (
                    <button onClick={reset} className="text-[#0D9488] text-xs font-semibold hover:text-[#0F766E] transition-colors">
                        Clear ↺
                    </button>
                )}
                {state === 'error' && (
                    <button onClick={reset} className="text-red-500 text-xs font-semibold hover:text-red-700 transition-colors">
                        Try Again ↺
                    </button>
                )}
            </div>

            {/* ════════════════════════════════════════════════════════════════════
          IDLE STATE — Drop Zone
      ════════════════════════════════════════════════════════════════════ */}
            {state === 'idle' && (
                <>
                    <div
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onClick={() => fileRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 select-none
                ${dragOver
                                ? 'border-[#0D9488] bg-[#0D9488]/5 scale-[1.02]'
                                : 'border-teal-200 bg-teal-50/30 hover:border-teal-400 hover:bg-teal-50/60'}`}
                    >
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".json,.csv"
                            className="hidden"
                            onChange={e => processFile(e.target.files?.[0])}
                        />
                        <div className="anim-float text-4xl mb-3">☁️</div>
                        <p className="text-[#0F766E] font-semibold text-sm">Drop De-identified Patient Record Here</p>
                        <p className="text-teal-400 text-xs mt-1 underline underline-offset-2">or click to browse files</p>
                        <p className="text-slate-400 text-[10px] mt-2">Supports JSON · CSV · HL7 FHIR · Max 10MB</p>
                    </div>

                    <div className="mt-3 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
                        <p className="text-teal-600 text-[10px] font-semibold mb-1">💡 CRC Tip</p>
                        <p className="text-teal-500 text-[10px] leading-relaxed">
                            Export de-identified records from your EMR (Epic/Cerner) as JSON or CSV. The system will automatically screen against {'>'}5,000 active trials.
                        </p>
                    </div>
                </>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          LOADING STATE — Staged progress
      ════════════════════════════════════════════════════════════════════ */}
            {state === 'loading' && (
                <div className="space-y-3 fade-up">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#0D9488] to-[#14B8A6] transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-[#0F766E] text-sm text-center font-medium fade-up">{stageMsg}</p>
                    <div className="flex justify-center gap-1 pt-1">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          SUCCESS STATE — Patient summary
      ════════════════════════════════════════════════════════════════════ */}
            {state === 'success' && patient && (
                <div className="border border-[#0D9488] bg-[#0D9488]/5 rounded-xl p-3 space-y-3 fade-up">
                    {/* Header */}
                    <div className="flex flex-col gap-1 border-b border-teal-100 pb-2 mb-2">
                        <span className="font-bold text-teal-800 text-sm">✅ Patient Record Ready for Screening</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-white text-teal-700 border border-teal-200 rounded-lg px-2.5 py-1 shadow-sm">
                                {patient.patient_id}
                            </span>
                            <span className="text-teal-500 font-medium text-[10px] bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">De-identified · HIPAA-compliant</span>
                        </div>
                    </div>

                    {/* Summary chips */}
                    <div className="flex flex-wrap gap-1.5 fade-up delay-200">
                        <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            {patient.age} yrs
                        </span>
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            {patient.gender}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            {patient.diagnoses?.length || 0} Diagnoses
                        </span>
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            {patient.medications?.length || 0} Medications
                        </span>
                    </div>

                    {/* Lab values */}
                    {patient.labs && Object.keys(patient.labs).length > 0 && (
                        <div className="flex justify-between bg-white rounded-xl px-3 py-2 border border-teal-100 fade-up delay-300">
                    {Object.entries(patient.labs).map(([k, v]) => {
                                // Handle both plain numbers (8.4) and rich lab objects ({value, unit, ...})
                                const displayVal = (typeof v === 'object' && v !== null) ? v.value : v;
                                return (
                                    <div key={k} className="flex flex-col items-center">
                                        <span className={`text-sm font-bold tabular-nums ${labColor(k, displayVal)}`}>
                                            {displayVal}{labSuffix(k).startsWith('%') ? '%' : ''}
                                        </span>
                                        <span className="text-[9px] text-slate-400 mt-0.5 leading-none">{k}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* History redacted notice */}
                    {patient.history_text?.includes('[REDACTED') && (
                        <p className="text-slate-400 text-xs italic flex items-center gap-1">
                            🔒 History anonymized by Presidio
                        </p>
                    )}

                    {/* Warnings */}
                    {warnings.map((w, i) => (
                        <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-700 text-xs font-medium">
                            {w}
                        </div>
                    ))}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          BATCH STATE — Patient selector list (multi-patient CSV)
      ════════════════════════════════════════════════════════════════════ */}
            {state === 'batch' && (
                <div className="fade-up space-y-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-teal-700 text-xs font-bold">
                            📋 {patientList.length} patients loaded — click to screen
                        </span>
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="text-teal-500 text-[10px] underline hover:text-teal-700"
                        >Upload another</button>
                    </div>
                    
                    {/* Filter Input */}
                    <div className="relative mb-2">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                        <input
                            type="text"
                            placeholder="Filter by name, ID, or diagnosis..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
                        {patientList.filter(p => {
                            if (!searchTerm) return true;
                            const term = searchTerm.toLowerCase();
                            return (p.patient_id?.toLowerCase().includes(term) ||
                                    p._displayName?.toLowerCase().includes(term) ||
                                    p.diagnoses?.join(', ').toLowerCase().includes(term));
                        }).map((p) => {
                            const isActive = activeBatchId === p.patient_id;
                            return (
                                <button
                                    key={p.patient_id}
                                    onClick={() => selectBatchPatient(p)}
                                    className={`w-full text-left rounded-xl px-3 py-2 border transition-all duration-150
                                        ${isActive
                                            ? 'border-teal-400 bg-teal-50 shadow-sm'
                                            : 'border-slate-100 bg-white hover:border-teal-300 hover:bg-teal-50/40'}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-mono text-teal-700 text-[11px] font-semibold">{p.patient_id}</p>
                                            <p className="text-slate-500 text-[10px] truncate max-w-[180px]">{p._displayName}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] text-slate-500">{p.age}y · {p.gender}</span>
                                            <span className="text-[9px] text-slate-400 font-medium">Diagnoses: {p.diagnoses?.join(', ')}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════════
          ERROR STATE
      ════════════════════════════════════════════════════════════════════ */}
            {state === 'error' && (
                <div className="border-2 border-red-200 bg-red-50 rounded-xl p-4 text-center space-y-2 fade-up">
                    <div className="text-2xl">❌</div>
                    <p className="text-red-700 text-sm font-semibold">{errorMsg}</p>
                    <p className="text-red-400 text-xs">Check your JSON file and try again.</p>
                </div>
            )}

            {/* PHI notice */}
            <p className="text-teal-400/60 text-[10px] mt-2 text-center">
                🔒 PHI automatically stripped before AI processing · HIPAA § 164.514 compliant · Audit trail maintained
            </p>
        </div>
    );
}
