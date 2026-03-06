import React, { useState, useEffect } from 'react';

// ─── Score tier ───────────────────────────────────────────────────────────────
function getTier(score) {
    if (score >= 75) return { color: '#0D9488', label: 'Strong Match' };
    if (score >= 50) return { color: '#F59E0B', label: 'Partial Match' };
    return { color: '#EF4444', label: 'Weak Match' };
}

// ─── Small score ring in header ───────────────────────────────────────────────
function MiniRing({ score }) {
    const tier = getTier(score);
    const deg = (score / 100) * 360;
    return (
        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(white ${deg}deg, rgba(255,255,255,0.2) ${deg}deg)` }} />
            <div className="absolute inset-[5px] rounded-full flex flex-col items-center justify-center"
                style={{ background: 'rgba(13,148,136,0.85)' }}>
                <span className="text-white font-black text-[13px] leading-none">{score}</span>
                <span className="text-white/70 text-[8px]">/ 100</span>
            </div>
        </div>
    );
}

// ─── Recommendation pill ──────────────────────────────────────────────────────
function RecPill({ recommendation, isPatient }) {
    const map = {
        'Proceed': { cls: 'bg-gradient-to-r from-[#0D9488] to-[#0F766E] text-white', label: '✅ Eligible — Proceed to Consent', patient: '🎉 Great news! You may be eligible' },
        'Verify First': { cls: 'bg-amber-400 text-white', label: '🔍 Pending Verification — Hold', patient: '🔍 A few things need to be checked' },
        'Not Suitable': { cls: 'bg-red-500 text-white', label: '🚫 Ineligible — Protocol Exclusion', patient: 'This trial may not be the right fit right now' },
    };
    const r = map[recommendation] || map['Proceed'];
    return (
        <span className={`rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ${r.cls}`}>
            {isPatient ? r.patient : r.label}
        </span>
    );
}

// ─── Accordion section wrapper ────────────────────────────────────────────────
function Section({ borderColor, title, badge, children, defaultOpen = true, titleSuffix }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-xl border-l-4 shadow-sm overflow-hidden mb-3"
            style={{ borderLeftColor: borderColor }}>
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
                <div className="flex flex-1 items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        {title}
                        {titleSuffix}
                    </span>
                    {badge != null && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: borderColor }}>{badge}</span>
                    )}
                </div>
                <svg className="w-4 h-4 text-slate-400 transition-transform duration-200"
                    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div style={{
                maxHeight: open ? '2000px' : '0',
                overflow: 'hidden',
                transition: 'max-height 300ms ease-in-out'
            }}>
                <div className="px-5 pb-4">{children}</div>
            </div>
        </div>
    );
}

// ─── Criteria row ─────────────────────────────────────────────────────────────
function CriteriaRow({ c, isNurse, isPatient }) {
    const map = {
        met: { icon: '✅', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100', label: isPatient ? '✅ You meet this requirement' : 'Met' },
        verify: { icon: '⚠️', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', label: isPatient ? '⚠️ Your doctor needs to confirm this' : 'Verify' },
        unmet: { icon: '❌', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', label: isPatient ? '❌ This requirement is not currently met' : 'Not Met' },
    };
    const s = map[c.status] || map.verify;
    return (
        <div className={`flex items-start justify-between gap-3 rounded-lg p-3 border ${s.bg} ${s.border} mb-2`}>
            <div className="flex-1">
                <p className="text-slate-800 text-sm font-semibold">{isPatient ? c.name.replace(/ICD\s[\w.]+/g, '').trim() : c.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{c.detail}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}>
                    {s.label}
                </span>
                {isNurse && c.status === 'verify' && (
                    <button
                        onClick={e => e.stopPropagation()}
                        className="bg-teal-500 hover:bg-teal-400 text-white rounded-full px-2 py-0.5 text-xs font-bold transition-colors"
                    >
                        Mark Verified ✓
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MatchReport({
    isOpen = false,
    onClose = () => { },
    report = null,      // TransparencyReport | null
    userRole = 'doctor',
    onVerifyField = null,
}) {
    const [verifiedFields, setVerifiedFields] = useState([]);

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            setVerifiedFields([]); // reset on close
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!isOpen || !report) return null;

    // Treat 'crc' same as 'doctor' for full visibility
    const isDoctor = userRole === 'doctor' || userRole === 'crc';
    const isNurse = userRole === 'nurse';
    const isPatient = userRole === 'patient';

    const met = report.criteria_breakdown?.filter(c => c.status === 'met') || [];
    const verify = report.criteria_breakdown?.filter(c => c.status === 'verify') || [];
    const unmet = report.criteria_breakdown?.filter(c => c.status === 'unmet') || [];
    const excl = report.exclusion_flags || [];

    const tier = getTier(report.match_score);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
            <style>{`
        @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn  { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
        .modal-in { animation: scaleIn 0.2s ease-out; }
        .scrollbar-teal::-webkit-scrollbar { width: 6px; }
        .scrollbar-teal::-webkit-scrollbar-track { background: #f0fdfc; border-radius: 9999px; }
        .scrollbar-teal::-webkit-scrollbar-thumb { background: #5eead4; border-radius: 9999px; }
        .scrollbar-teal::-webkit-scrollbar-thumb:hover { background: #0d9488; }
      `}</style>

            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white shadow-2xl z-10 modal-in
        ${isPatient ? 'rounded-3xl' : 'rounded-2xl'}`}>

                {/* ── STICKY HEADER ── */}
                <div className="sticky top-0 z-20 bg-gradient-to-r from-[#0D9488] to-[#0F766E] rounded-t-2xl px-6 py-4 flex items-center gap-4">
                    {/* Left: icon + trial info */}
                    <div className="text-2xl shrink-0" title="Patient Screening Report">🔬</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h2 className="text-white font-bold text-base leading-tight truncate">
                                {isPatient ? 'Your Trial Match Report' : 'Patient Screening Report'}
                            </h2>
                            {!isPatient && (
                                <span className="bg-teal-100 text-teal-600 border border-teal-200 rounded-full text-[10px] px-2 py-0.5 font-bold">CRC Review</span>
                            )}
                        </div>
                        {!isPatient && (
                            <div className="text-white/90 text-sm font-medium mb-1 truncate">
                                {report.trial_name}
                            </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                            {!isPatient && (
                                <span className="font-mono text-white/70 text-xs">{report.trial_id}</span>
                            )}
                            <span className="text-white/60 text-xs">
                                Patient: <span className="text-white/90 font-mono">{report.patient_id}</span>
                            </span>
                        </div>
                    </div>

                    {/* Center: score ring */}
                    <MiniRing score={report.match_score} />

                    {/* Right: confidence + close */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold border
              ${report.confidence === 'HIGH' ? 'bg-white/20 text-white border-white/40' :
                                report.confidence === 'MEDIUM' ? 'bg-amber-100/30 text-amber-100 border-amber-300/40' :
                                    'bg-red-100/30 text-red-100 border-red-300/40'}`}>
                            {report.confidence}
                        </span>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center text-lg transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* ── CRC SCREENING STRIP ── */}
                {!isPatient && (
                    <div className="bg-slate-50 border-b border-slate-100 px-6 py-2 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <span className="text-slate-400 text-xs flex items-center gap-1.5">
                                🕐 Screened: <span className="text-slate-600 font-medium">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                            <span className="text-slate-400 text-xs flex items-center gap-1.5">
                                🔬 Engine: <span className="text-teal-600 font-medium">BioGPT + Rule-Based v2.1</span>
                            </span>
                        </div>
                        <span className="bg-teal-50 text-teal-600 border border-teal-200 text-[10px] font-semibold px-2.5 py-1 rounded-full">
                            Auto-generated · Not a clinical decision
                        </span>
                    </div>
                )}

                {/* ── SCROLLABLE BODY ── */}
                <div className="flex-1 overflow-y-auto bg-[#F8FFFE] p-5 scrollbar-teal">

                    {/* ── SECTION A: Met Criteria / Why You May Qualify ── */}
                    <Section
                        borderColor="#0D9488"
                        title={isPatient ? 'A — Why You May Qualify' : `✅ Eligibility Confirmed`}
                        badge={met.length}
                    >
                        {met.length === 0
                            ? <p className="text-slate-400 text-sm py-2">No criteria are currently met.</p>
                            : met.map((c, i) => <CriteriaRow key={i} c={c} isNurse={isNurse} isPatient={isPatient} />)
                        }
                    </Section>

                    {/* ── SECTION B: Verify / Items Your Doctor Needs (shown to all) ── */}
                    <Section
                        borderColor="#F59E0B"
                        title={isPatient ? 'B — Items Your Doctor Needs to Confirm' : '📋 Coordinator Action Required'}
                        badge={verify.length}
                        titleSuffix={
                            (!isPatient && report.missing_data?.length > 0) ? (
                                <span className="flex items-center gap-1.5 ml-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                    <span className="text-amber-600 text-[10px] font-semibold">Action needed</span>
                                </span>
                            ) : null
                        }
                    >
                        {verify.length === 0
                            ? <p className="text-slate-400 text-sm py-2 flex items-center gap-1.5">✅ Nothing requires verification.</p>
                            : verify.map((c, i) => <CriteriaRow key={i} c={c} isNurse={isNurse} isPatient={isPatient} />)
                        }
                        {report.missing_data?.length > 0 && (
                            <div className="mt-4 border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                {userRole === 'nurse' && (
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-slate-500 font-medium">Verification Progress</span>
                                            <span className="text-xs font-bold text-teal-600">
                                                {verifiedFields.length} / {report.missing_data.length} verified
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-teal-400 to-teal-600 h-2 transition-all duration-500"
                                                style={{
                                                    width: `${(verifiedFields.length / report.missing_data.length) * 100}%`
                                                }}
                                            />
                                        </div>
                                        {verifiedFields.length === report.missing_data.length && (
                                            <p className="text-teal-600 text-[11px] font-bold mt-1.5 text-center animate-pulse">
                                                ✅ All fields verified — ready for enrollment
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div className="p-1 space-y-1">
                                    {report.missing_data.map((field, index) => {
                                        const isVerified = verifiedFields.includes(field);
                                        return (
                                            <div
                                                key={index}
                                                className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ${isVerified
                                                    ? 'bg-teal-50 border border-teal-200'
                                                    : 'bg-amber-50 border border-amber-100'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 pr-4">
                                                    <span className="text-sm shrink-0">
                                                        {isVerified ? '✅' : '⚠️'}
                                                    </span>
                                                    <span className={`text-sm font-medium leading-tight ${isVerified ? 'text-teal-700 line-through opacity-60' : 'text-amber-800'}`}>
                                                        {field}
                                                    </span>
                                                </div>
                                                {userRole === 'nurse' && (
                                                    <button
                                                        onClick={() => {
                                                            if (!isVerified) {
                                                                setVerifiedFields(prev => [...prev, field]);
                                                                if (onVerifyField) onVerifyField(report.patient_id, field);
                                                            }
                                                        }}
                                                        disabled={isVerified}
                                                        className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all duration-200 shadow-sm ${isVerified
                                                            ? 'bg-teal-200/50 text-teal-600 cursor-not-allowed shadow-none'
                                                            : 'bg-teal-500 text-white hover:bg-teal-600 hover:shadow-teal-200 active:scale-95'
                                                            }`}
                                                    >
                                                        {isVerified ? '✓ Verified' : 'Mark Verified ✓'}
                                                    </button>
                                                )}
                                                {userRole === 'doctor' && (
                                                    <span className="shrink-0 text-[10px] text-slate-400 italic font-medium bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                                        Contact GP →
                                                    </span>
                                                )}
                                                {userRole === 'patient' && (
                                                    <span className="shrink-0 text-[10px] text-amber-600 italic font-medium bg-amber-100/50 px-2 py-1 rounded-md border border-amber-200/50">
                                                        Pending Doctor
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </Section>

                    {/* ── SECTION C: Unmet Criteria (doctor/nurse only) ── */}
                    {!isPatient && (
                        <Section borderColor="#EF4444" title="❌ Eligibility Gaps" badge={unmet.length}>
                            {unmet.length === 0
                                ? <p className="text-slate-400 text-sm py-2 flex items-center gap-1.5">✅ No unmet criteria.</p>
                                : unmet.map((c, i) => <CriteriaRow key={i} c={c} isNurse={isNurse} isPatient={false} />)
                            }
                        </Section>
                    )}

                    {/* ── SECTION D: Exclusion Flags (doctor/nurse only) ── */}
                    {!isPatient && (
                        <Section borderColor="#7F1D1D" title="🚫 Protocol Exclusions" badge={excl.length}>
                            {excl.length === 0
                                ? <p className="text-slate-400 text-sm py-2 flex items-center gap-1.5">✅ No exclusion flags raised.</p>
                                : excl.map((flag, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-2">
                                        <span className="text-red-500">🚫</span>
                                        <span className="text-red-700 text-sm">{flag}</span>
                                    </div>
                                ))
                            }
                        </Section>
                    )}

                    {/* ── SECTION E: AI Reasoning / What This Means For You ── */}
                    {(isDoctor || isPatient) && (
                        <Section
                            borderColor="#8B5CF6"
                            title={isPatient ? 'E — What This Means For You' : '🧠 AI Screening Summary'}
                        >
                            {isPatient ? (
                                <div className="space-y-3">
                                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                                        <p className="text-purple-700 text-sm font-semibold mb-2">In plain terms:</p>
                                        <p className="text-slate-600 text-sm leading-relaxed">
                                            {report.narrative_text || 'Your health profile has been analyzed against this trial\'s requirements.'}
                                        </p>
                                    </div>
                                    <RecPill recommendation={report.recommendation} isPatient={true} />
                                    <p className="text-slate-400 text-xs">
                                        📋 Please speak with your doctor for more information about this trial.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Narrative */}
                                    {report.narrative_text && (
                                        <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-2">Narrative Summary</p>
                                            <p className="text-slate-700 text-sm leading-relaxed italic">{report.narrative_text}</p>
                                        </div>
                                    )}
                                    {/* LLM Explanation */}
                                    {report.llm_explanation && (
                                        <blockquote className="border-l-4 border-purple-400 pl-4 py-0.5">
                                            <p className="text-slate-600 text-sm leading-relaxed italic">{report.llm_explanation}</p>
                                        </blockquote>
                                    )}
                                    <div className="flex items-center gap-2 pt-1">
                                        <span className="bg-teal-50 text-teal-700 border border-teal-100 text-[10px] font-bold rounded-full px-2.5 py-1">
                                            🧠 Powered by BioGPT
                                        </span>
                                        <span className="text-slate-400 text-[10px]">+ Sentence-Transformers · Confidence: {report.confidence}</span>
                                    </div>
                                </div>
                            )}
                        </Section>
                    )}
                </div>

                {/* ── STICKY FOOTER ── */}
                <div className="sticky bottom-0 bg-white border-t border-slate-100 rounded-b-2xl px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
                    {/* Left: patient_id chip */}
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-slate-50 text-slate-500 border border-slate-100 px-2.5 py-1 rounded-lg">
                            {report.patient_id}
                        </span>
                        <RecPill recommendation={report.recommendation} isPatient={isPatient} />
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2">
                        {!isPatient && (
                            <div className="flex items-center gap-1 text-xs px-3 text-slate-500">
                                <span>Was this screening accurate?</span>
                                <button className="hover:bg-slate-100 rounded p-1 hover:text-green-600 transition-colors">👍</button>
                                <button className="hover:bg-slate-100 rounded p-1 hover:text-red-600 transition-colors">👎</button>
                            </div>
                        )}
                        {!isPatient && (
                            <button className="bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl px-3 py-2 text-sm font-medium transition-all flex items-center gap-1.5">
                                📧 Email PI
                            </button>
                        )}
                        {!isPatient && (
                            <button className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-gradient-to-r from-[#0D9488] to-[#0F766E] text-white shadow-md shadow-teal-200 hover:shadow-lg transition-all">
                                📤 Export to Investigator
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-xs font-semibold px-4 py-2 rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
