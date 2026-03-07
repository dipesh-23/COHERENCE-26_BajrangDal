import React, { useState, useEffect } from 'react';

// ─── Score tier helper ──────────────────────────────────────────────────────────
function getTier(score) {
    if (score >= 75) return {
        color: '#0D9488', trackColor: '#CCFBF1',
        label: 'Eligible', icon: '✅',
        hint: 'Proceed to consent screening',
        badgeCls: 'bg-teal-50 text-teal-700 border-teal-200',
    };
    if (score >= 46) return {
        color: '#F59E0B', trackColor: '#FEF3C7',
        label: 'Verify First', icon: '🔍',
        hint: 'Verify before proceeding',
        badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return {
        color: '#EF4444', trackColor: '#FEE2E2',
        label: 'Likely Ineligible', icon: '🚫',
        hint: 'Do not screen · check exclusion criteria',
        badgeCls: 'bg-red-50 text-red-700 border-red-200',
    };
}

// ─── Clean SVG Arc Gauge ────────────────────────────────────────────────────────
function ArcGauge({ score }) {
    const [animated, setAnimated] = useState(0);

    useEffect(() => {
        setAnimated(0);
        let start = null;
        const dur = 1000;
        const target = score;
        const step = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setAnimated(Math.round(ease * target));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [score]);

    const tier = getTier(score);

    // SVG arc math — 240° sweep (from 150° to 30°)
    const SIZE = 200;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const R = 78;
    const STROKE = 14;
    const START_ANGLE = 150; // degrees
    const SWEEP = 240;

    function polarToXY(angleDeg, r) {
        const rad = (angleDeg * Math.PI) / 180;
        return {
            x: cx + r * Math.cos(rad),
            y: cy + r * Math.sin(rad),
        };
    }

    function describeArc(startDeg, endDeg) {
        const s = polarToXY(startDeg, R);
        const e = polarToXY(endDeg, R);
        const large = endDeg - startDeg > 180 ? 1 : 0;
        return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
    }

    const endAngle = START_ANGLE + (animated / 100) * SWEEP;
    const trackPath = describeArc(START_ANGLE, START_ANGLE + SWEEP);
    const fillPath = animated > 0 ? describeArc(START_ANGLE, Math.min(endAngle, START_ANGLE + SWEEP - 0.01)) : null;

    // Ticks at 0, 25, 50, 75, 100
    const ticks = [0, 25, 50, 75, 100];

    return (
        <div className="flex flex-col items-center">
            <svg width={SIZE} height={SIZE * 0.78} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }}>
                {/* Track */}
                <path
                    d={trackPath}
                    fill="none"
                    stroke={tier.trackColor}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                />
                {/* Fill arc */}
                {fillPath && (
                    <path
                        d={fillPath}
                        fill="none"
                        stroke={tier.color}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        style={{ filter: `drop-shadow(0 0 6px ${tier.color}88)` }}
                    />
                )}
                {/* Tick marks */}
                {ticks.map((t) => {
                    const ang = START_ANGLE + (t / 100) * SWEEP;
                    const outer = polarToXY(ang, R + STROKE / 2 + 3);
                    const inner = polarToXY(ang, R - STROKE / 2 - 3);
                    const label = polarToXY(ang, R + STROKE / 2 + 14);
                    return (
                        <g key={t}>
                            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                                stroke="#CBD5E1" strokeWidth={1.5} strokeLinecap="round" />
                            <text x={label.x} y={label.y + 3.5} textAnchor="middle"
                                fontSize={8} fill="#94A3B8" fontWeight="600" fontFamily="sans-serif">
                                {t}
                            </text>
                        </g>
                    );
                })}
                {/* Center score */}
                <text x={cx} y={cy - 8} textAnchor="middle"
                    fontSize={38} fontWeight="900" fill={tier.color} fontFamily="sans-serif">
                    {animated}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle"
                    fontSize={10} fill="#94A3B8" fontFamily="sans-serif" fontWeight="600" letterSpacing="1">
                    SCORE
                </text>
            </svg>

            {/* Badge */}
            <span className={`text-xs font-bold border rounded-full px-4 py-1 -mt-4 ${tier.badgeCls}`}>
                {tier.icon} {tier.label}
            </span>
            <p className="text-slate-400 text-[11px] text-center mt-2 leading-snug">{tier.hint}</p>
        </div>
    );
}

// ─── Legend bar (animated width) ───────────────────────────────────────────────
function LegendBar({ color, value, category, showValue }) {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setWidth(value), 200);
        return () => clearTimeout(t);
    }, [value]);

    return (
        <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-slate-600 text-xs truncate">{category}</span>
                    {showValue && (
                        <span className="text-xs font-bold tabular-nums ml-2" style={{ color }}>{value}%</span>
                    )}
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all ease-out"
                        style={{ width: `${width}%`, backgroundColor: color, transitionDuration: '800ms' }}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 animate-pulse">
            <div className="h-4 bg-slate-100 rounded-full w-1/2 mb-4" />
            <div className="flex items-center justify-center">
                <div className="w-[180px] h-[130px] rounded-full bg-slate-100" />
            </div>
            <div className="space-y-3 mt-4">
                {[80, 65, 75].map((w, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-slate-100 shrink-0" />
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full" style={{ width: `${w}%` }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function ScoreGauge({ score = null, label = 'Overall Match', userRole = 'doctor', breakdown = null }) {
    const [infoOpen, setInfoOpen] = useState(false);
    if (score === null || score === undefined) return <Skeleton />;

    const isDoctor = userRole === 'doctor';

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#0F766E] font-bold text-sm flex items-center gap-1.5">
                    📊 Eligibility Score Breakdown
                </h3>
                <div className="relative">
                    <button
                        onClick={() => setInfoOpen(o => !o)}
                        className="text-teal-400 hover:text-teal-600 transition-colors text-sm w-6 h-6 rounded-full flex items-center justify-center hover:bg-teal-50"
                    >ℹ️</button>
                    {infoOpen && (
                        <div className="absolute right-0 top-7 z-50 bg-[#0F766E] text-white text-xs px-3 py-2 rounded-lg shadow-xl w-60 leading-relaxed">
                            Score = hard-filter pass rate × confidence + BiomedBERT semantic similarity (0–100).
                            <div className="absolute -top-1.5 right-2 border-[6px] border-transparent border-b-[#0F766E]" />
                        </div>
                    )}
                </div>
            </div>

            {/* Arc Gauge */}
            <ArcGauge score={score} />

            {/* Legend bars */}
            {breakdown?.length > 0 && (
                <div className="space-y-2.5 mt-4 pt-3 border-t border-slate-50">
                    {breakdown.map((b) => (
                        <LegendBar
                            key={b.category}
                            color={b.color}
                            value={b.value}
                            category={b.category}
                            showValue={isDoctor}
                        />
                    ))}
                </div>
            )}

            {/* Footer */}
            <p className="text-teal-400 text-[10px] text-center mt-4 font-medium">
                🧬 Scored by BiomedBERT NLP + rule-based criteria engine
            </p>
        </div>
    );
}
