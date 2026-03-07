import React, { useState, useEffect } from 'react';
import {
    RadialBarChart,
    RadialBar,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// ─── Score tier helper ─────────────────────────────────────────────────────────
function getTier(score) {
    if (score >= 75) return { color: '#0D9488', label: 'Eligible ✅', glow: '0 0 14px #0D9488aa', badgeCls: 'bg-teal-50 text-teal-700 border-teal-200' };
    if (score >= 50) return { color: '#F59E0B', label: 'Review Required 🔍', glow: '0 0 14px #F59E0Baa', badgeCls: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { color: '#EF4444', label: 'Likely Ineligible ❌', glow: '0 0 14px #EF4444aa', badgeCls: 'bg-red-50 text-red-700 border-red-200' };
}

// ─── NULL SKELETON ─────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-5 animate-pulse">
            <div className="h-4 bg-slate-100 rounded-full w-1/2 mb-4" />
            <div className="flex items-center justify-center">
                <div className="w-[180px] h-[180px] rounded-full bg-slate-100" />
            </div>
            <div className="space-y-3 mt-4">
                {[80, 65, 75, 55].map((w, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-100 shrink-0" />
                        <div className="flex-1 h-2 bg-slate-100 rounded-full" style={{ width: `${w}%` }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Custom radial tooltip ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
        <div className="bg-[#0F766E] text-white text-xs px-3 py-1.5 rounded-lg shadow-lg pointer-events-none">
            <span className="font-semibold">{d?.category}</span>: {d?.value}%
        </div>
    );
}

// ─── Legend bar (animated width 0 → value%) ────────────────────────────────────
function LegendBar({ color, value, category, showValue }) {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setWidth(value), 150);
        return () => clearTimeout(t);
    }, [value]);

    return (
        <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <span className="text-slate-600 text-xs truncate">{category}</span>
                    {showValue && <span className="text-xs font-bold tabular-nums ml-2" style={{ color }}>{value}%</span>}
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all ease-out"
                        style={{ width: `${width}%`, backgroundColor: color, transitionDuration: '800ms' }}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Patient view: CSS conic-gradient circle ───────────────────────────────────
function PatientGauge({ score }) {
    const [pct, setPct] = useState(0);
    useEffect(() => {
        let start = null;
        const dur = 1000;
        const step = ts => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            const ease = 1 - Math.pow(1 - p, 3);
            setPct(Math.round(ease * score));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [score]);

    const tier = getTier(score);
    const deg = (pct / 100) * 360;

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative w-[160px] h-[160px] flex items-center justify-center"
                style={{ filter: `drop-shadow(${tier.glow})` }}>
                <div className="absolute inset-0 rounded-full"
                    style={{ background: `conic-gradient(${tier.color} ${deg}deg, #E2E8F0 ${deg}deg)` }} />
                <div className="absolute inset-[14px] rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="font-black text-3xl leading-none" style={{ color: tier.color }}>{pct}</span>
                    <span className="text-slate-400 text-xs mt-0.5">out of 100</span>
                </div>
            </div>
            <span className={`text-xs font-semibold border rounded-full px-3 py-1 ${tier.badgeCls}`}>
                {tier.label}
            </span>
            <p className="text-slate-500 text-xs text-center leading-snug max-w-[200px]">
                This score reflects how well your health profile matches the trial requirements.
            </p>
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ScoreGauge({
    // All values flow from Dashboard's deriveBreakdown() which transforms live criteria_breakdown
    score = null,   // null → skeleton
    label = 'Overall Match',
    userRole = 'doctor',
    breakdown = null,   // [{ category, value, color }] | null
}) {
    const [infoOpen, setInfoOpen] = useState(false);

    // Null guard
    if (score === null || score === undefined) return <Skeleton />;

    const tier = getTier(score);
    const isDoctor = userRole === 'doctor';
    const isNurse = userRole === 'nurse';
    const isPatient = userRole === 'patient';

    // Recharts data: must include outermost arc (overall score) first
    const chartData = breakdown?.length
        ? [
            { category: label || 'Overall', value: score, color: isNurse ? '#0F766E' : '#0D9488' },
            ...breakdown,
        ]
        : [{ category: label || 'Overall', value: score, color: isNurse ? '#0F766E' : '#0D9488' }];

    // Recharts needs data sorted largest→smallest for proper inner/outer stacking
    const sortedData = [...chartData].sort((a, b) => b.value - a.value);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-5">

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#0F766E] font-bold text-base flex items-center gap-1.5">
                    📊 Eligibility Score Breakdown
                </h3>
                {(isDoctor || isNurse) && (
                    <div className="relative">
                        <button
                            onClick={() => setInfoOpen(o => !o)}
                            className="text-teal-400 hover:text-teal-600 transition-colors text-sm w-6 h-6 rounded-full flex items-center justify-center hover:bg-teal-50"
                        >ℹ️</button>
                        {infoOpen && (
                            <div className="absolute right-0 top-7 z-50 bg-[#0F766E] text-white text-xs px-3 py-2 rounded-lg shadow-xl w-64 leading-relaxed whitespace-normal break-words">
                                Eligibility score = rule-based hard filter pass/fail (binary) + BioGPT semantic soft match (weighted). Combined into 0–100 CRC screening score.
                                <div className="absolute -top-1.5 right-2 border-[6px] border-transparent border-b-[#0F766E]" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Patient view ── */}
            {isPatient && <PatientGauge score={score} />}

            {/* ── Doctor / Nurse view ── */}
            {!isPatient && (
                <>
                    {/* Radial chart container */}
                    <div className="relative">
                        <ResponsiveContainer width="100%" height={220}>
                            <RadialBarChart
                                innerRadius="25%"
                                outerRadius="95%"
                                data={sortedData}
                                startAngle={90}
                                endAngle={-270}
                                barSize={10}
                            >
                                {sortedData.map((entry, i) => (
                                    <RadialBar
                                        key={i}
                                        dataKey="value"
                                        data={[entry]}
                                        fill={entry.color}
                                        cornerRadius={5}
                                        background={{ fill: '#F1F5F9' }}
                                        isAnimationActive
                                        animationDuration={1000}
                                        animationEasing="ease-out"
                                    />
                                ))}
                                <Tooltip content={<CustomTooltip />} />
                            </RadialBarChart>
                        </ResponsiveContainer>

                        {/* Center overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-2">
                            <span
                                className="font-black text-4xl leading-none tabular-nums"
                                style={{ color: tier.color, filter: `drop-shadow(${tier.glow})` }}
                            >
                                {score}
                            </span>
                            <span className="text-slate-400 text-xs mt-0.5">Score</span>
                            <span className={`mt-2 text-[10px] font-semibold border rounded-full px-2.5 py-0.5 ${tier.badgeCls}`}>
                                {tier.label}
                            </span>
                            <p className={`text-[9px] font-medium mt-1 ${score >= 75 ? 'text-teal-500'
                                : score >= 50 ? 'text-amber-500'
                                    : 'text-red-400'
                                }`}>
                                {score >= 75 ? 'Proceed to consent screening'
                                    : score >= 50 ? 'Verify before proceeding'
                                        : 'Do not screen — check exclusions'}
                            </p>
                        </div>
                    </div>

                    {/* Legend */}
                    {breakdown?.length > 0 && (
                        <div className="space-y-2.5 mt-3 pt-3 border-t border-slate-50">
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
                </>
            )}

            {/* ── Footer ── */}
            <p className="text-teal-400 text-[10px] text-center mt-4 font-medium">
                🧬 Scored by BioGPT clinical NLP + rule-based protocol engine
            </p>
        </div>
    );
}
