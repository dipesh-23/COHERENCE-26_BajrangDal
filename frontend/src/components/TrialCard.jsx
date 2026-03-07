import React, { useState, useEffect } from 'react';

// ─── Score tier helpers ────────────────────────────────────────────────────────
function getTier(score) {
    if (score >= 75) return { hex: '#0D9488', border: 'border-l-[#0D9488]', glow: 'shadow-[#0D9488]/15' };
    if (score >= 50) return { hex: '#F59E0B', border: 'border-l-[#F59E0B]', glow: 'shadow-[#F59E0B]/15' };
    return { hex: '#EF4444', border: 'border-l-[#EF4444]', glow: 'shadow-[#EF4444]/15' };
}

// ─── Confidence pill styles ────────────────────────────────────────────────────
const CONF = {
    HIGH: 'bg-teal-50 text-teal-700 border border-teal-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200',
    LOW: 'bg-red-50 text-red-700 border border-red-200',
};

// ─── Recommendation → button gradient ─────────────────────────────────────────
const REC_CLS = {
    'Proceed': 'bg-gradient-to-r from-[#0D9488] to-[#0F766E] text-white shadow-[#0D9488]/25',
    'Verify First': 'bg-amber-400 text-white shadow-amber-400/25',
    'Not Suitable': 'bg-red-500 text-white shadow-red-500/25',
};

const truncate = (s = '', n) => s.length > n ? s.slice(0, n) + '…' : s;

// ─── Skeleton (null guard) ────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-start justify-between p-5 pb-3">
                <div className="flex-1 space-y-2.5 pr-4">
                    <div className="h-5 anim-shimmer-skeleton rounded-full w-3/4" />
                    <div className="h-3.5 anim-shimmer-skeleton rounded-full w-1/3" />
                </div>
                <div className="w-16 h-16 rounded-full anim-shimmer-skeleton shrink-0" />
            </div>
            <div className="px-5 py-3 flex gap-2">
                {[56, 72, 48, 64].map(w => <div key={w} className="h-6 anim-shimmer-skeleton rounded-full" style={{ width: w }} />)}
            </div>
            <div className="border-t border-slate-100 px-5 py-4 flex justify-between">
                <div className="h-9 w-24 anim-shimmer-skeleton rounded-xl" />
                <div className="h-9 w-32 anim-shimmer-skeleton rounded-xl" />
            </div>
        </div>
    );
}

// ─── Score ring (doctor / nurse) ──────────────────────────────────────────────
function ScoreRing({ score, color }) {
    const [pct, setPct] = useState(0);
    useEffect(() => {
        let start = null;
        const dur = 900;
        const step = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setPct(Math.round(ease * score));
            if (p < 1) requestAnimationFrame(step);
        };
        const id = requestAnimationFrame(step);
        return () => cancelAnimationFrame(id);
    }, [score]);

    const deg = (pct / 100) * 360;
    return (
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(${color} ${deg}deg, #E2E8F0 ${deg}deg)` }} />
            <div className="absolute inset-[5px] rounded-full bg-white flex flex-col items-center justify-center shadow-sm">
                <span className="font-black text-[14px] leading-none" style={{ color }}>{pct}</span>
                <span className="text-[8px] text-slate-400 leading-none mt-0.5 font-semibold uppercase tracking-wide">Match</span>
            </div>
        </div>
    );
}

// ─── Score badge (patient) ────────────────────────────────────────────────────
function ScoreBadge({ score }) {
    if (score >= 75) return <span className="bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-4 py-1.5 font-semibold text-sm">✅ Strong Match</span>;
    if (score >= 50) return <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-4 py-1.5 font-semibold text-sm">⚠️ Possible Match</span>;
    return <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-4 py-1.5 font-semibold text-sm">❌ Needs Review</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TrialCard({
    // All fields come directly from MatchResult (POST /match response)
    title = null,
    trial_id = 'NCT-0000-000',
    match_score = 87,
    confidence = 'HIGH',
    phase = 'Phase III',
    sponsor = 'Sponsor',
    location = '—',
    site_info = {},
    criteria_breakdown = [],
    missing_data = [],
    exclusion_flags = [],
    recommendation = 'Proceed',
    // UI
    markerColor = '#0D9488',
    isSelected = false,
    userRole = 'doctor',
    onSelect = () => { },
    onViewReport = () => { },
    onLocate = () => { },
    // Dropout Predictor
    completion_likelihood = null,
    dropout_reason = '',
    visits_required = null,
    telehealth_enabled = false,
    // Polypharmacy Safety
    polypharmacy_flags = [],
    investigational_drug = '',
}) {
    // Null guard → skeleton
    if (!title) return <Skeleton />;

    const tier = getTier(match_score);
    const isDoctor = userRole === 'doctor';
    const isNurse = userRole === 'nurse';
    const isPatient = userRole === 'patient';
    const isCrc = userRole === 'crc';

    return (
        <button
            onClick={onSelect}
            className={`bg-white rounded-2xl border border-slate-200 border-l-[5px] w-full text-left cursor-pointer transition-all duration-200
        ${tier.border}
        ${isSelected
                    ? `ring-2 ring-[#0D9488] ring-offset-2 shadow-xl ${tier.glow}`
                    : `shadow-sm hover:shadow-lg hover:scale-[1.005] hover:shadow-[#0D9488]/8`
                }`}
        >

            {/* ── TOP ROW ── */}
            <div className="flex items-start justify-between px-5 pt-5 pb-3">
                <div className="flex-1 min-w-0 pr-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: markerColor }}></div>
                        <h3 className="font-black text-[#0F1E34] text-[15px] leading-snug tracking-tight">{title}</h3>
                        {site_info?.hpsa_bonus && (
                            <span className="hpsa-shimmer text-amber-800 border border-amber-200 rounded-full px-2.5 py-0.5 text-[10px] font-bold">⭐ Underserved</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded border border-slate-200">{trial_id}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{phase} · {sponsor}</span>
                    </div>
                </div>

                {/* Score display */}
                <div className="flex flex-col items-end gap-1">
                    {isPatient
                        ? <ScoreBadge score={match_score} />
                        : <ScoreRing score={match_score} color={tier.hex} />
                    }
                    {isCrc && (
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-center ${
                            recommendation === 'Proceed'
                                ? 'bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20'
                                : recommendation === 'Verify First'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {recommendation === 'Proceed' ? '✅ Screen Now'
                                : recommendation === 'Verify First' ? '🔍 Verify'
                                    : '🚫 Excluded'}
                        </div>
                    )}
                </div>
            </div>

            {/* ── META ROW ── */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2">
                <span className={`rounded-full text-xs px-2.5 py-1 font-medium ${CONF[confidence] || CONF.MEDIUM}`}>
                    {confidence === 'HIGH' ? '✅ High Confidence' : confidence === 'MEDIUM' ? '⚠️ Verify Required' : '🔴 Low Confidence'}
                </span>
                {!isPatient && (
                    <span className="text-slate-400 text-xs">🧪 {phase}</span>
                )}
                {isPatient ? (
                    <>
                        <span className="text-slate-500 text-xs flex items-center gap-1">
                            📍 {location}
                            {site_info?.distance_miles !== null && site_info?.distance_miles !== undefined && (
                                <span className="text-teal-500 font-medium bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5 text-[10px] ml-1">
                                    • {site_info.distance_miles} miles away
                                </span>
                            )}
                        </span>
                        <span className="text-slate-400 text-xs">🧪 {phase}</span>
                    </>
                ) : (
                    <>
                        <span className="text-slate-400 text-xs" title={sponsor}>🏢 {truncate(sponsor, 22)}</span>
                        <span className="text-slate-500 text-xs flex items-center gap-1">
                            📍 {location}
                            {site_info?.distance_miles !== null && site_info?.distance_miles !== undefined && (
                                <span className="text-teal-500 font-medium bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5 text-[10px] ml-1">
                                    • {site_info.distance_miles} miles away
                                </span>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); onLocate(); }}
                                className="ml-2 text-[10px] text-[#0D9488] hover:text-white border border-[#0D9488] hover:bg-[#0D9488] px-2 py-0.5 rounded transition-colors"
                            >
                                Map ↗
                            </button>
                        </span>
                    </>
                )}
            </div>

            {/* ── DROPOUT PREDICTOR STRIP (doctor / nurse / crc only) ── */}
            {!isPatient && completion_likelihood !== null && (
                <div className={`px-4 py-2.5 border-t flex items-center justify-between gap-3 ${
                    completion_likelihood >= 80 ? 'bg-emerald-50/60 border-emerald-100'
                    : completion_likelihood >= 60 ? 'bg-amber-50/60 border-amber-100'
                    : 'bg-red-50/60 border-red-100'
                }`}>
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">
                            {completion_likelihood >= 80 ? '🟢' : completion_likelihood >= 60 ? '🟡' : '🔴'}
                        </span>
                        <div className="min-w-0">
                            <p className={`text-[10px] font-bold uppercase tracking-wide ${
                                completion_likelihood >= 80 ? 'text-emerald-700'
                                : completion_likelihood >= 60 ? 'text-amber-700'
                                : 'text-red-700'
                            }`}>Completion Likelihood</p>
                            <p className="text-[9px] text-slate-500 truncate max-w-[200px]" title={dropout_reason}>
                                {dropout_reason || 'low dropout risk'}
                                {telehealth_enabled && <span className="ml-1 text-teal-500 font-semibold">· Telehealth ✅</span>}
                                {visits_required && <span className="ml-1 text-slate-400">· {visits_required} visits</span>}
                            </p>
                        </div>
                    </div>
                    <div className={`shrink-0 text-center px-3 py-1 rounded-full font-bold text-sm border ${
                        completion_likelihood >= 80 ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : completion_likelihood >= 60 ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-red-100 text-red-800 border-red-200'
                    }`}>
                        {completion_likelihood}%
                    </div>
                </div>
            )}

            {/* ── POLYPHARMACY DANGER FLAG (doctor / nurse / crc only) ── */}
            {!isPatient && polypharmacy_flags?.length > 0 && (
                <div className="border-t border-red-100 bg-red-50/70">
                    <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
                        <span className="text-base">💊</span>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">
                            Polypharmacy Safety Alert
                        </p>
                        <span className="text-[9px] bg-red-200 text-red-800 font-bold px-1.5 rounded-full">
                            {polypharmacy_flags.length} interaction{polypharmacy_flags.length > 1 ? 's' : ''} detected
                        </span>
                    </div>
                    <div className="px-4 pb-2.5 space-y-1.5">
                        {polypharmacy_flags.map((flag, i) => {
                            const sev = flag.severity;
                            const sevCls = sev === 'HIGH'
                                ? 'bg-red-600 text-white'
                                : sev === 'MODERATE'
                                ? 'bg-amber-500 text-white'
                                : 'bg-blue-500 text-white';
                            return (
                                <div key={i} className="flex items-start gap-2 bg-white rounded-xl px-3 py-2 border border-red-100 shadow-sm">
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${sevCls}`}>{sev}</span>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold text-slate-700">
                                            {investigational_drug} ↔ <span className="text-red-600">{flag.interacting_drug}</span>
                                        </p>
                                        <p className="text-[9px] text-slate-500 leading-snug mt-0.5">{flag.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                        <p className="text-[8px] text-red-400 italic text-right">⚕️ Flag for clinical pharmacist review before enrollment</p>
                    </div>
                </div>
            )}

            {/* ── CRITERIA ROW (doctor / nurse) ── */}
            {!isPatient && criteria_breakdown.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-50">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">Criteria</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {criteria_breakdown.map((c, i) => {
                            const isMet = c.status === 'pass';
                            const isUnmet = c.status === 'fail';
                            const chipCls = isMet ? 'bg-teal-500 text-white'
                                : isUnmet ? 'bg-red-500 text-white'
                                    : 'bg-amber-400 text-slate-900';
                            const icon = isMet ? '✅' : isUnmet ? '❌' : '⚠️';

                            return (
                                <div key={i} className={`chip-wrap shrink-0 chip-in ${isNurse ? 'nurse-chip-wrap' : ''}`}
                                    style={{ animationDelay: `${i * 30}ms` }}>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${chipCls}`}>
                                        <span className="text-[10px]">{icon}</span>
                                        {truncate(c.name, 16)}
                                    </span>

                                    {/* Tooltip */}
                                    <div className="chip-tip whitespace-nowrap bg-slate-900 text-white text-[11px] rounded-xl px-3 py-2.5 shadow-xl border border-white/10 min-w-[160px]">
                                        <p className="font-bold mb-1 opacity-90">{c.name}</p>
                                        <p className="text-slate-300 text-[10px] font-normal mb-2">{c.detail}</p>
                                        {isNurse && c.status === 'verify' && (
                                            <button
                                                className="w-full bg-teal-500 hover:bg-teal-400 text-white text-[10px] font-bold py-1 rounded-lg transition-colors pointer-events-auto"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                Mark Verified ✓
                                            </button>
                                        )}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-900 -mt-px" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── MISSING DATA STRIP ── */}
            {missing_data?.length > 0 && (
                <div className="bg-orange-50 border-t border-orange-100 px-4 py-2 text-orange-700 text-xs flex items-center gap-1.5 font-medium">
                    ⚠️ <strong>{missing_data.length}</strong>&nbsp;
                    {missing_data.length === 1 ? 'item needs' : 'items need'} coordinator verification before screening
                    <span className="text-orange-400 font-normal">({missing_data[0]}{missing_data.length > 1 ? '…' : ''})</span>
                </div>
            )}

            {/* ── EXCLUSION STRIP (doctor / nurse) ── */}
            {!isPatient && exclusion_flags?.length > 0 && (
                <div className="bg-red-50 border-t border-red-100 px-4 py-2 text-red-700 text-xs flex items-center gap-1.5 font-medium">
                    🚫 <strong>{exclusion_flags.length}</strong> hard exclusion{exclusion_flags.length > 1 ? 's' : ''} — patient ineligible per protocol
                </div>
            )}

            {/* ── BOTTOM ROW ── */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50 bg-slate-50/40 rounded-b-2xl">
                {/* Select & Time Saved */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={e => { e.stopPropagation(); onSelect(); }}
                        className={`text-xs font-bold px-4 py-2 rounded-full border transition-all duration-150
                ${isSelected
                                ? 'bg-[#0D9488] border-[#0D9488] text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-[#0D9488] hover:text-[#0D9488]'
                            }`}
                    >
                        {isSelected ? '✓ Selected' : isCrc ? 'Review' : 'Select'}
                    </button>
                    {isCrc && (
                        <span className="text-slate-300 text-[10px] flex items-center gap-1">
                            ⚡ <span className="text-teal-400 font-medium">~12 min saved</span>
                        </span>
                    )}
                </div>

                {/* Role CTA */}
                <div className="flex items-center gap-2">
                    {/* Recommendation pill */}
                    {!isPatient && (
                        <span className={`hidden sm:inline text-[10px] font-bold px-2.5 py-1 rounded-md border
              ${recommendation === 'Proceed' ? 'bg-teal-50 text-teal-700 border-teal-100'
                                : recommendation === 'Verify First' ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {recommendation}
                        </span>
                    )}

                    {(isDoctor || isCrc) && (
                        <button
                            onClick={e => { e.stopPropagation(); onViewReport(); }}
                            className="group flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-[#0D9488] text-white shadow-sm shadow-[#0D9488]/20 hover:bg-[#0F766E] hover:shadow-md transition-all duration-150"
                        >
                            {isCrc ? '📋 Screening Report' : 'Full Report'} <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </button>
                    )}
                    {isNurse && (
                        <button
                            onClick={e => { e.stopPropagation(); onViewReport(); }}
                            className="text-xs font-bold px-4 py-2.5 rounded-xl bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-all"
                        >
                            🔍 Flag for Review
                        </button>
                    )}
                    {isPatient && (
                        <button
                            onClick={e => { e.stopPropagation(); onViewReport(); }}
                            className="text-xs font-bold px-4 py-2.5 rounded-xl bg-[#0D9488] text-white shadow-sm hover:bg-[#0F766E] transition-all"
                        >
                            Learn More →
                        </button>
                    )}
                </div>
            </div>
        </button>
    );
}
