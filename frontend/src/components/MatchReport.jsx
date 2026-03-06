import React, { useState, useEffect } from 'react';

// ─── Default Mock Data (swap with real backend response from GET /report/{patient_id}/{trial_id}) ───
const DEFAULT_REPORT = {
    patient_id: "P-84921",
    trial_id: "NCT-2026-001",
    trial_name: "EMBARK-T2DM Phase III",
    match_score: 87,
    confidence: "HIGH",
    criteria_breakdown: [
        { name: "Age 40-65", status: "met", detail: "Age 52 within range" },
        { name: "T2DM Diagnosis", status: "met", detail: "ICD E11.9 confirmed" },
        { name: "HbA1c >7%", status: "met", detail: "8.2% recorded" },
        { name: "Metformin Use", status: "met", detail: "Active prescription" },
        { name: "eGFR ≥60", status: "verify", detail: "71 recorded, confirm needed" },
        { name: "No Insulin", status: "met", detail: "Not in medications" }
    ],
    missing_data: ["eGFR lab confirmation"],
    exclusion_flags: [],
    narrative_text: "Strong metabolic profile match. Patient shows consistent alignment with primary inclusion criteria for EMBARK-T2DM.",
    recommendation: "Proceed",
    llm_explanation: "Patient P-84921 aligns strongly with EMBARK-T2DM criteria based on confirmed T2DM diagnosis (ICD E11.9), elevated HbA1c of 8.2% meeting the >7% threshold, and current Metformin prescription. Age of 52 falls within the target 40–65 range. The only pending item is an eGFR lab confirmation—current recorded value of 71 meets the ≥60 threshold but requires an official lab report for enrolment eligibility."
};

// ─── Score tier helper ─────────────────────────────────────────────────────────
function getScoreTier(score) {
    if (score >= 75) return { color: '#10B981', border: 'border-emerald-500' };
    if (score >= 50) return { color: '#F59E0B', border: 'border-amber-500' };
    return { color: '#EF4444', border: 'border-red-500' };
}

// ─── Confidence badge helper ───────────────────────────────────────────────────
function ConfidencePill({ confidence }) {
    const map = {
        HIGH: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        MEDIUM: 'bg-amber-500/20  text-amber-400  border-amber-500/30',
        LOW: 'bg-red-500/20    text-red-400    border-red-500/30',
    };
    const icon = { HIGH: '✅', MEDIUM: '⚠️', LOW: '🔴' }[confidence] || '';
    return (
        <span className={`text-[11px] font-bold uppercase tracking-wider border px-2.5 py-1 rounded-full ${map[confidence] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
            {icon} {confidence}
        </span>
    );
}

// ─── Recommendation pill helper ───────────────────────────────────────────────
function RecommendationPill({ recommendation }) {
    const map = {
        'Proceed': 'bg-emerald-100 text-emerald-800 border-emerald-300',
        'Verify Fields First': 'bg-amber-100  text-amber-800  border-amber-300',
        'Not Suitable': 'bg-red-100    text-red-800    border-red-300',
    };
    return (
        <span className={`text-xs font-bold uppercase tracking-wider border px-3 py-1.5 rounded-full ${map[recommendation] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
            {recommendation}
        </span>
    );
}

// ─── Mini score ring (SVG, matches TrialCard style) ───────────────────────────
function ScoreRing({ score }) {
    const tier = getScoreTier(score);
    const r = 22;
    const circ = 2 * Math.PI * r;
    const offset = circ - (circ * score) / 100;
    return (
        <div className="relative w-[52px] h-[52px] shrink-0 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" width="52" height="52">
                <circle cx="26" cy="26" r={r} fill="none" stroke="#334155" strokeWidth="5" />
                <circle cx="26" cy="26" r={r} fill="none" stroke={tier.color} strokeWidth="5"
                    strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <div className="z-10 flex flex-col items-center">
                <span className="text-[13px] font-extrabold leading-none" style={{ color: tier.color }}>{score}</span>
                <span className="text-[7px] text-slate-400 uppercase tracking-tight">Match</span>
            </div>
        </div>
    );
}

// ─── AccordionSection ─────────────────────────────────────────────────────────
function AccordionSection({ id, title, icon, borderColor, count, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className={`bg-white rounded-xl border-l-4 ${borderColor} shadow-sm overflow-hidden`}>
            <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors duration-150"
                onClick={() => setOpen(o => !o)}
            >
                <div className="flex items-center gap-2">
                    <span>{icon}</span>
                    <span className="font-bold text-slate-800 text-sm">{title}</span>
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">{count}</span>
                </div>
                <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? '' : 'rotate-180'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                </svg>
            </button>
            <div
                className="transition-all duration-300 ease-in-out overflow-hidden"
                style={{ maxHeight: open ? '1000px' : '0px', opacity: open ? 1 : 0 }}
            >
                <div className="px-4 pb-4 pt-1 space-y-2">
                    {children}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MatchReport({
    isOpen = false,
    onClose = () => { },
    // report will be injected from Dashboard.jsx → GET /report/{patient_id}/{trial_id}
    // Falls back to mock data for isolated development/testing
    report = null,
}) {
    const data = report || DEFAULT_REPORT;

    const [mounted, setMounted] = useState(false);
    const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setMounted(true), 10);
        } else {
            setMounted(false);
        }
    }, [isOpen]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;
    if (!data) return null;

    // ── Derive sections from criteria_breakdown ──
    const metItems = (data.criteria_breakdown || []).filter(c => c.status === 'met');
    const unmetItems = (data.criteria_breakdown || []).filter(c => c.status === 'unmet');
    const verifyItems = (data.criteria_breakdown || []).filter(c => c.status === 'verify');
    const exclusions = data.exclusion_flags || [];

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200"
            style={{ opacity: mounted ? 1 : 0 }}
            onClick={handleBackdropClick}
        >
            <style>{`
        .mr-scrollbar::-webkit-scrollbar { width: 6px; }
        .mr-scrollbar::-webkit-scrollbar-track { background: #E2E8F0; border-radius: 9999px; }
        .mr-scrollbar::-webkit-scrollbar-thumb { background: #3B82F6; border-radius: 9999px; }
      `}</style>

            {/* ── Modal Shell ── */}
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden transition-all duration-200 ease-out"
                style={{ transform: mounted ? 'scale(1)' : 'scale(0.95)', opacity: mounted ? 1 : 0 }}
            >
                {/* ── 3. STICKY HEADER ── */}
                <div className="bg-slate-900 px-6 py-4 flex items-center gap-4 shrink-0">
                    {/* Left */}
                    <div className="bg-blue-500 rounded-lg p-1.5 shrink-0">
                        <span className="text-xl leading-none">🔬</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-white font-bold text-base leading-tight truncate">{data.trial_name}</h2>
                        <span className="text-blue-400 text-sm font-mono">{data.trial_id}</span>
                    </div>

                    {/* Center */}
                    <ScoreRing score={data.match_score} />

                    {/* Right */}
                    <ConfidencePill confidence={data.confidence} />
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:rotate-90 transition-all duration-300 shrink-0 ml-1"
                        aria-label="Close"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* ── 4. SCROLLABLE BODY ── */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-slate-50 mr-scrollbar">

                    {/* Section A — Inclusion Met */}
                    <AccordionSection id="met" title="Inclusion Met" icon="✅" borderColor="border-emerald-500" count={metItems.length}>
                        {metItems.length === 0 ? (
                            <p className="text-slate-400 text-sm italic">None</p>
                        ) : metItems.map((c, i) => (
                            <div key={i} className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
                                <span className="text-emerald-500 mt-0.5">✓</span>
                                <div>
                                    <p className="text-slate-800 font-semibold text-sm">{c.name}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{c.detail}</p>
                                </div>
                            </div>
                        ))}
                    </AccordionSection>

                    {/* Section B — Inclusion Unmet */}
                    <AccordionSection id="unmet" title="Inclusion Unmet" icon="❌" borderColor="border-red-500" count={unmetItems.length}>
                        {unmetItems.length === 0 ? (
                            <p className="text-slate-400 text-sm italic">None</p>
                        ) : unmetItems.map((c, i) => (
                            <div key={i} className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                                <span className="text-red-500 mt-0.5">✗</span>
                                <div>
                                    <p className="text-slate-800 font-semibold text-sm">{c.name}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{c.detail}</p>
                                </div>
                            </div>
                        ))}
                    </AccordionSection>

                    {/* Section C — Exclusion Flags */}
                    <AccordionSection id="exclusions" title="Exclusion Flags" icon="🚫" borderColor="border-red-900" count={exclusions.length}>
                        {exclusions.length === 0 ? (
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
                                <span className="text-emerald-500">✓</span>
                                <span className="text-emerald-700 font-semibold text-sm">None Triggered</span>
                            </div>
                        ) : exclusions.map((flag, i) => (
                            <div key={i} className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                                <span className="text-red-600 mt-0.5">⛔</span>
                                <p className="text-red-700 font-semibold text-sm">{flag}</p>
                            </div>
                        ))}
                    </AccordionSection>

                    {/* Section D — Requires Verification */}
                    <AccordionSection id="verify" title="Requires Verification" icon="⚠️" borderColor="border-amber-500" count={verifyItems.length}>
                        {verifyItems.length === 0 ? (
                            <p className="text-slate-400 text-sm italic">None</p>
                        ) : verifyItems.map((c, i) => (
                            <div key={i} className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                                <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-slate-800 font-semibold text-sm">{c.name}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">{c.detail}</p>
                                </div>
                                <span className="shrink-0 text-[10px] font-bold bg-amber-500 text-white px-2 py-1 rounded-full whitespace-nowrap shadow-sm">
                                    Contact GP →
                                </span>
                            </div>
                        ))}
                    </AccordionSection>

                    {/* Section E — AI Reasoning */}
                    <AccordionSection id="ai" title="AI Reasoning" icon="🧠" borderColor="border-purple-500" count={1}>
                        <p className="text-slate-500 text-sm italic mb-3">{data.narrative_text}</p>
                        <blockquote className="border-l-4 border-purple-500 pl-4 py-2 bg-purple-50 rounded-r-lg">
                            <p className="text-slate-700 text-sm italic leading-relaxed">"{data.llm_explanation}"</p>
                        </blockquote>
                        <div className="mt-3 flex items-center gap-1.5">
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full">
                                🧠 Powered by BioGPT + Sentence-Transformers
                            </span>
                        </div>
                    </AccordionSection>

                </div>

                {/* ── 6. STICKY FOOTER ── */}
                <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                    {/* Left — patient ID */}
                    <span className="font-mono text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200">
                        {data.patient_id}
                    </span>

                    {/* Center — recommendation */}
                    <RecommendationPill recommendation={data.recommendation} />

                    {/* Right — actions */}
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors duration-150">
                            📥 PDF
                        </button>
                        <button
                            onClick={() => setFeedback('up')}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 text-base ${feedback === 'up' ? 'bg-emerald-100 border border-emerald-300 scale-110' : 'bg-slate-100 hover:bg-slate-200 border border-slate-200'}`}
                            title="Helpful"
                        >👍</button>
                        <button
                            onClick={() => setFeedback('down')}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 text-base ${feedback === 'down' ? 'bg-red-100 border border-red-300 scale-110' : 'bg-slate-100 hover:bg-slate-200 border border-slate-200'}`}
                            title="Not helpful"
                        >👎</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
