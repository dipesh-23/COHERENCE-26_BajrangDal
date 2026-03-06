import React, { useState, useEffect } from 'react';

// ─── Score tier helper ─────────────────────────────────────────────────────────
// Drives border color, ring color, and left-border accent — all from match_score
function getTier(score) {
    if (score >= 75) return { hex: '#10B981', border: 'border-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 50) return { hex: '#F59E0B', border: 'border-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
    return { hex: '#EF4444', border: 'border-red-500', text: 'text-red-600', bg: 'bg-red-50' };
}

// ─── Recommendation pill ───────────────────────────────────────────────────────
const REC_STYLES = {
    'Proceed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Verify First': 'bg-amber-100 text-amber-800 border-amber-200',
    'Not Suitable': 'bg-red-100 text-red-800 border-red-200',
};

// ─── Confidence pill ──────────────────────────────────────────────────────────
const CONF_STYLES = {
    HIGH: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: '✅' },
    MEDIUM: { cls: 'bg-amber-100  text-amber-700  border-amber-200', icon: '⚠️' },
    LOW: { cls: 'bg-red-100    text-red-700    border-red-200', icon: '🔴' },
};

const truncate = (str = '', n) => str.length > n ? str.slice(0, n) + '…' : str;

export default function TrialCard({
    // ── All fields come directly from MatchResult returned by POST /match ──
    // Default props are realistic mocks used for dev until backend is live
    trial_name = 'EMBARK-T2DM Phase III',
    trial_id = 'NCT-2026-001',
    match_score = 87,
    confidence = 'HIGH',
    phase = 'Phase III',
    sponsor = 'NovaBiomed Inc.',
    location = 'New York, NY',
    hpsa_flagged = false,
    criteria_breakdown = [
        { name: 'Age 40-65', status: 'met', detail: 'Age 52 within range' },
        { name: 'T2DM Diagnosis', status: 'met', detail: 'ICD E11.9 confirmed' },
        { name: 'HbA1c >7%', status: 'met', detail: '8.2% recorded' },
        { name: 'Metformin Use', status: 'met', detail: 'Active prescription' },
        { name: 'eGFR ≥60', status: 'verify', detail: '71 recorded, confirm needed' },
        { name: 'No Insulin', status: 'met', detail: 'Not in medications' },
    ],
    missing_data = ['eGFR lab confirmation'],
    exclusion_flags = [],
    recommendation = 'Proceed',
    // UI props from Dashboard
    isSelected = false,
    onSelect = () => { },
    onViewReport = () => { },
}) {
    const tier = getTier(match_score);

    // ── Animated score counter (ease-out cubic, 900ms) ──
    const [displayScore, setDisplayScore] = useState(0);
    useEffect(() => {
        let frame = 0;
        const FRAMES = 54; // ~900ms at 60fps
        const id = setInterval(() => {
            frame++;
            const t = frame / FRAMES;
            const ease = 1 - Math.pow(1 - t, 3);
            setDisplayScore(Math.round(ease * match_score));
            if (frame >= FRAMES) { clearInterval(id); setDisplayScore(match_score); }
        }, 900 / 54);
        return () => clearInterval(id);
    }, [match_score]);

    // SVG stroke lengths for 24px radius circle
    const R = 22;
    const CIRC = 2 * Math.PI * R;
    const strokeOffset = CIRC - (CIRC * displayScore) / 100;

    const conf = CONF_STYLES[confidence] || CONF_STYLES.MEDIUM;

    return (
        <div
            className={`relative bg-white rounded-2xl cursor-pointer transition-all duration-200 ease-out border-l-[6px]
        ${tier.border}
        ${isSelected
                    ? 'ring-2 ring-blue-500 ring-offset-2 shadow-2xl scale-[1.01]'
                    : 'shadow-lg hover:scale-[1.015] hover:shadow-2xl'
                }`}
            onClick={onSelect}
        >
            <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.75); }
          to   { opacity: 1; transform: scale(1); }
        }
        .chip-scale-in { animation: scaleIn 0.25s ease-out forwards; opacity: 0; }
        @keyframes goldShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        .gold-shimmer {
          background: linear-gradient(90deg, #FDE68A 25%, #FEF3C7 50%, #FDE68A 75%);
          background-size: 200% auto;
          animation: goldShimmer 2s linear infinite;
        }
        /* Chip tooltips */
        .chip-wrap:hover .chip-tip {
          visibility: visible;
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        .chip-tip {
          visibility: hidden;
          opacity: 0;
          transform: translateX(-50%) translateY(4px);
          transition: opacity 0.15s ease, transform 0.15s ease;
          pointer-events: none;
        }
      `}</style>

            {/* ── 2. TOP ROW ── */}
            <div className="flex items-start justify-between p-4 pb-2">
                {/* Left */}
                <div className="flex-1 pr-3 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <h3 className="font-bold text-slate-900 text-[15px] leading-tight">{trial_name}</h3>
                        {hpsa_flagged && (
                            <span className="relative overflow-hidden text-amber-900 border border-amber-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm gold-shimmer">
                                ⭐ Underserved Area
                            </span>
                        )}
                    </div>
                    <span className="font-mono text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200 inline-block">
                        {trial_id}
                    </span>
                </div>

                {/* Right — SVG score ring */}
                <div className="relative shrink-0 w-[56px] h-[56px] flex items-center justify-center">
                    <svg className="absolute inset-0 -rotate-90" width="56" height="56">
                        <circle cx="28" cy="28" r={R} fill="none" stroke="#E2E8F0" strokeWidth="5" />
                        <circle
                            cx="28" cy="28" r={R} fill="none"
                            stroke={tier.hex} strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={CIRC}
                            strokeDashoffset={strokeOffset}
                            style={{ transition: 'stroke-dashoffset 0.25s ease-out' }}
                        />
                    </svg>
                    <div className="z-10 flex flex-col items-center">
                        <span className="text-[14px] font-extrabold leading-none" style={{ color: tier.hex }}>
                            {displayScore}
                        </span>
                        <span className="text-[8px] text-slate-400 uppercase tracking-tight mt-0.5">Match</span>
                    </div>
                </div>
            </div>

            {/* ── 3. META ROW ── */}
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 px-4 pb-2">
                <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${conf.cls}`}>
                    {conf.icon} {confidence}
                </span>
                <span className="text-slate-500 text-xs flex items-center gap-1 font-medium">🧪 {phase}</span>
                <span className="text-slate-500 text-xs flex items-center gap-1 font-medium" title={sponsor}>
                    🏢 {truncate(sponsor, 24)}
                </span>
                <span className="text-slate-500 text-xs flex items-center gap-1 font-medium">📍 {location}</span>
            </div>

            {/* ── 4. CRITERIA ROW ── */}
            <div className="px-4 py-2 border-t border-slate-50">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Criteria</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {(criteria_breakdown || []).map((c, i) => {
                        const isMet = c.status === 'met';
                        const isUnmet = c.status === 'unmet';
                        const isVerify = c.status === 'verify';
                        const chipCls = isMet ? 'bg-emerald-500 text-white shadow-sm'
                            : isUnmet ? 'bg-red-500 text-white shadow-sm'
                                : 'bg-amber-400 text-slate-900 shadow-sm';
                        const icon = isMet ? '✅' : isUnmet ? '❌' : '⚠️';

                        return (
                            <div
                                key={i}
                                className="chip-wrap relative shrink-0 chip-scale-in"
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-black/5 ${chipCls}`}>
                                    <span className="text-[10px] leading-none">{icon}</span>
                                    {truncate(c.name, 18)}
                                </span>
                                {/* Tooltip */}
                                <div className="chip-tip absolute bottom-full left-1/2 mb-2 whitespace-nowrap bg-slate-900 text-white text-[11px] font-medium rounded-lg px-3 py-2 shadow-xl z-50 border border-white/10">
                                    <p className="font-bold opacity-90 mb-0.5">{c.name}</p>
                                    <p className="text-slate-300 font-normal">{c.detail}</p>
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-900 -mt-px" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── 5. STRIPS ── */}
            {missing_data?.length > 0 && (
                <div className="bg-orange-50 border-t border-orange-200 px-4 py-2 text-orange-700 text-xs flex items-center gap-1.5 font-medium">
                    <span>⚠️</span>
                    <span>
                        <strong>{missing_data.length}</strong>{' '}
                        {missing_data.length === 1 ? 'field requires' : 'fields require'} verification
                        <span className="text-orange-500/70 ml-1">({missing_data[0]}{missing_data.length > 1 ? ', …' : ''})</span>
                    </span>
                </div>
            )}
            {exclusion_flags?.length > 0 && (
                <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-red-700 text-xs flex items-center gap-1.5 font-medium">
                    <span>🚫</span>
                    <strong>{exclusion_flags.length}</strong> exclusions flagged
                </div>
            )}

            {/* ── 6. BOTTOM ROW ── */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
                {/* Select button */}
                <button
                    onClick={e => { e.stopPropagation(); onSelect(); }}
                    className={`text-xs font-bold px-4 py-2 rounded-lg border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            ${isSelected
                            ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                            : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
                        }`}
                >
                    {isSelected ? '✓ Selected' : 'Select'}
                </button>

                {/* Right: rec pill + view report */}
                <div className="flex items-center gap-2">
                    <span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-wide border px-2 py-1 rounded-md ${REC_STYLES[recommendation] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {recommendation}
                    </span>
                    <button
                        onClick={e => { e.stopPropagation(); onViewReport(); }}
                        className="group flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    >
                        Report
                        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
