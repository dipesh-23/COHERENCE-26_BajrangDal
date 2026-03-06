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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-pulse">
            <div className="flex items-start justify-between p-4 pb-2">
                <div className="flex-1 space-y-2 pr-4">
                    <div className="h-4 bg-slate-100 rounded-full w-3/4" />
                    <div className="h-3 bg-slate-100 rounded-full w-1/3" />
                </div>
                <div className="w-14 h-14 rounded-full bg-slate-100 shrink-0" />
            </div>
            <div className="px-4 py-2 flex gap-2">
                {[40, 56, 32, 48].map(w => <div key={w} className="h-5 bg-slate-100 rounded-full" style={{ width: w }} />)}
            </div>
            <div className="px-4 py-2 flex gap-2">
                {[3, 3, 3].map((_, i) => <div key={i} className="h-7 bg-slate-100 rounded-full w-20" />)}
            </div>
            <div className="border-t border-slate-50 px-4 py-3 flex justify-between">
                <div className="h-8 w-20 bg-slate-100 rounded-full" />
                <div className="h-8 w-28 bg-slate-100 rounded-full" />
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
        <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full"
                style={{ background: `conic-gradient(${color} ${deg}deg, #F1F5F9 ${deg}deg)` }} />
            <div className="absolute inset-[5px] rounded-full bg-white flex flex-col items-center justify-center">
                <span className="font-bold text-[13px] leading-none" style={{ color }}>{pct}</span>
                <span className="text-[8px] text-slate-400 leading-none mt-0.5">Match</span>
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
    trial_name = null,
    trial_id = 'NCT-0000-000',
    match_score = 87,
    confidence = 'HIGH',
    phase = 'Phase III',
    sponsor = 'Sponsor',
    location = '—',
    distance_string = null,
    hpsa_flagged = false,
    criteria_breakdown = [],
    missing_data = [],
    exclusion_flags = [],
    recommendation = 'Proceed',
    // UI
    isSelected = false,
    userRole = 'doctor',   // 'doctor' | 'nurse' | 'patient'
    onSelect = () => { },
    onViewReport = () => { },
}) {
    // Null guard → skeleton
    if (!trial_name) return <Skeleton />;

    const tier = getTier(match_score);
    const isDoctor = userRole === 'doctor';
    const isNurse = userRole === 'nurse';
    const isPatient = userRole === 'patient';

    return (
        <div
            onClick={onSelect}
            className={`bg-white rounded-2xl border border-slate-100 border-l-[5px] cursor-pointer transition-all duration-200
        ${tier.border}
        ${isSelected
                    ? `ring-2 ring-[#0D9488] ring-offset-2 shadow-lg ${tier.glow}`
                    : `shadow-sm hover:shadow-lg hover:scale-[1.01] hover:shadow-[#0D9488]/10`
                }`}
        >
            <style>{`
        @keyframes scaleIn {
          from { opacity:0; transform:scale(0.7); }
          to   { opacity:1; transform:scale(1); }
        }
        .chip-in { animation: scaleIn 0.22s ease-out both; }

        /* Tooltip */
        .chip-wrap { position:relative; }
        .chip-wrap:hover .chip-tip { visibility:visible; opacity:1; transform:translateX(-50%) translateY(0); }
        .chip-tip {
          visibility:hidden; opacity:0;
          transform:translateX(-50%) translateY(6px);
          transition:opacity 0.15s ease, transform 0.15s ease;
          position:absolute; bottom:calc(100% + 8px); left:50%;
          pointer-events:none; z-index:50;
        }
        .nurse-chip-wrap:hover .chip-tip { pointer-events:auto; }

        @keyframes goldShimmer {
          0%   { background-position:-200% 0; }
          100% { background-position: 200% 0; }
        }
        .hpsa-shimmer {
          background: linear-gradient(90deg,#FDE68A 25%,#FEF9C3 50%,#FDE68A 75%);
          background-size: 200% auto;
          animation: goldShimmer 2s linear infinite;
        }
      `}</style>

            {/* ── TOP ROW ── */}
            <div className="flex items-start justify-between p-4 pb-2">
                <div className="flex-1 min-w-0 pr-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-slate-800 text-[15px] leading-tight">{trial_name}</h3>
                        {hpsa_flagged && (
                            <span className="hpsa-shimmer text-amber-800 border border-amber-200 rounded-full px-2.5 py-0.5 text-[10px] font-bold">⭐ Underserved</span>
                        )}
                    </div>
                    <span className="font-mono text-[11px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded border border-slate-100">{trial_id}</span>
                </div>

                {/* Score display — ring for doctor/nurse, badge for patient */}
                {isPatient
                    ? <ScoreBadge score={match_score} />
                    : <ScoreRing score={match_score} color={tier.hex} />
                }
            </div>

            {/* ── META ROW ── */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 pb-2">
                <span className={`rounded-full text-xs px-2.5 py-1 font-medium ${CONF[confidence] || CONF.MEDIUM}`}>
                    {confidence === 'HIGH' ? '✅' : confidence === 'MEDIUM' ? '⚠️' : '🔴'} {confidence}
                </span>
                {!isPatient && (
                    <span className="text-slate-400 text-xs">🧪 {phase}</span>
                )}
                {isPatient ? (
                    <>
                        <span className="text-slate-400 text-xs">
                            📍 {location} {distance_string && <span className="font-semibold text-teal-600">({distance_string})</span>}
                        </span>
                        <span className="text-slate-400 text-xs">🧪 {phase}</span>
                    </>
                ) : (
                    <>
                        <span className="text-slate-400 text-xs" title={sponsor}>🏢 {truncate(sponsor, 22)}</span>
                        <span className="text-slate-400 text-xs">
                            📍 {location} {distance_string && <span className="font-semibold text-teal-600">({distance_string})</span>}
                        </span>
                    </>
                )}
            </div>

            {/* ── CRITERIA ROW (doctor / nurse) ── */}
            {!isPatient && criteria_breakdown.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-50">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-2">Criteria</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {criteria_breakdown.map((c, i) => {
                            const isMet = c.status === 'met';
                            const isUnmet = c.status === 'unmet';
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
                    {missing_data.length === 1 ? 'field requires' : 'fields require'} verification
                    <span className="text-orange-400 font-normal">({missing_data[0]}{missing_data.length > 1 ? '…' : ''})</span>
                </div>
            )}

            {/* ── EXCLUSION STRIP (doctor / nurse) ── */}
            {!isPatient && exclusion_flags?.length > 0 && (
                <div className="bg-red-50 border-t border-red-100 px-4 py-2 text-red-700 text-xs flex items-center gap-1.5 font-medium">
                    🚫 <strong>{exclusion_flags.length}</strong> exclusion{exclusion_flags.length > 1 ? 's' : ''} flagged
                </div>
            )}

            {/* ── BOTTOM ROW ── */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50 bg-slate-50/40 rounded-b-2xl">
                {/* Select */}
                <button
                    onClick={e => { e.stopPropagation(); onSelect(); }}
                    className={`text-xs font-bold px-4 py-2 rounded-full border transition-all duration-150
            ${isSelected
                            ? 'bg-[#0D9488] border-[#0D9488] text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-[#0D9488] hover:text-[#0D9488]'
                        }`}
                >
                    {isSelected ? '✓ Selected' : 'Select'}
                </button>

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

                    {isDoctor && (
                        <button
                            onClick={e => { e.stopPropagation(); onViewReport(); }}
                            className="group flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full bg-gradient-to-r from-[#0D9488] to-[#0F766E] text-white shadow-md shadow-[#0D9488]/20 hover:shadow-lg hover:shadow-[#0D9488]/30 transition-all"
                        >
                            Report <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </button>
                    )}
                    {isNurse && (
                        <button
                            onClick={e => { e.stopPropagation(); onViewReport(); }}
                            className="text-xs font-bold px-4 py-2 rounded-full bg-[#0F766E] text-white shadow-md shadow-[#0F766E]/20 hover:bg-[#0D9488] transition-all"
                        >
                            Flag for Review
                        </button>
                    )}
                    {isPatient && (
                        <button
                            onClick={e => { e.stopPropagation(); onViewReport(); }}
                            className="text-xs font-bold px-4 py-2 rounded-full bg-teal-400 text-white shadow-md shadow-teal-400/20 hover:bg-teal-500 transition-all"
                        >
                            Learn More →
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
