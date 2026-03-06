import React, { useState, useEffect } from 'react';
// recharts will be available after `npm install recharts`
// The component gracefully falls back to an SVG arc if recharts is not installed yet.
let RadialBarChart, RadialBar, Tooltip, ResponsiveContainer;
try {
    const recharts = require('recharts');
    RadialBarChart = recharts.RadialBarChart;
    RadialBar = recharts.RadialBar;
    Tooltip = recharts.Tooltip;
    ResponsiveContainer = recharts.ResponsiveContainer;
} catch (e) {
    // recharts not installed yet — fallback SVG is used below
}

// ─── Score Tier Helper ────────────────────────────────────────────────────────
function getTier(score) {
    if (score >= 75) return { color: '#10B981', label: 'Strong Match', glow: '0 0 18px #10B981' };
    if (score >= 50) return { color: '#F59E0B', label: 'Partial Match', glow: '0 0 18px #F59E0B' };
    return { color: '#EF4444', label: 'Weak Match', glow: '0 0 18px #EF4444' };
}

// ─── Custom Recharts Tooltip ──────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-slate-900 text-white text-xs font-semibold rounded-full px-3 py-1.5 shadow-xl pointer-events-none whitespace-nowrap border border-white/10">
            {d.name}: <span style={{ color: d.fill }}>{d.value}%</span>
        </div>
    );
}

// ─── Fallback SVG arc (when recharts is absent) ───────────────────────────────
function FallbackArc({ score, tierColor }) {
    const [animated, setAnimated] = useState(0);
    useEffect(() => {
        const duration = 1000;
        const steps = 60;
        let step = 0;
        const t = setInterval(() => {
            step++;
            setAnimated(Math.round((1 - Math.pow(1 - step / steps, 3)) * score));
            if (step >= steps) { clearInterval(t); setAnimated(score); }
        }, duration / steps);
        return () => clearInterval(t);
    }, [score]);

    const r = 80;
    const circ = 2 * Math.PI * r;
    const offset = circ - (circ * animated) / 100;

    return (
        <svg className="w-full h-full" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={r} fill="none" stroke="#E2E8F0" strokeWidth="16" strokeDasharray={circ} strokeDashoffset={circ * 0.25} strokeLinecap="round" transform="rotate(135 100 100)" />
            <circle cx="100" cy="100" r={r} fill="none" stroke={tierColor} strokeWidth="16" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(135 100 100)" style={{ transition: 'stroke-dashoffset 0.3s ease-out' }} />
        </svg>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ScoreGauge({
    // These values will be replaced with real backend data once merged
    score = 87,
    label = 'Overall Match',
    breakdown = [
        { category: 'Demographics', value: 91, color: '#3B82F6' },
        { category: 'Lab Values', value: 78, color: '#10B981' },
        { category: 'Diagnosis', value: 88, color: '#8B5CF6' },
        { category: 'Medications', value: 65, color: '#F59E0B' },
    ],
}) {
    const tier = getTier(score);

    // Animated mini-bar widths for legend
    const [barWidths, setBarWidths] = useState(breakdown.map(() => 0));
    useEffect(() => {
        const t = setTimeout(() => {
            setBarWidths(breakdown.map(b => b.value));
        }, 100);
        return () => clearTimeout(t);
    }, [breakdown]);

    // Animated score counter
    const [displayScore, setDisplayScore] = useState(0);
    useEffect(() => {
        const duration = 900;
        const steps = 60;
        let step = 0;
        const t = setInterval(() => {
            step++;
            setDisplayScore(Math.round((1 - Math.pow(1 - step / steps, 3)) * score));
            if (step >= steps) { clearInterval(t); setDisplayScore(score); }
        }, duration / steps);
        return () => clearInterval(t);
    }, [score]);

    // Build chart data: total score first (outermost), then breakdown categories
    const chartData = [
        { name: label, value: score, fill: tier.color },
        ...breakdown.map(b => ({ name: b.category, value: b.value, fill: b.color })),
    ];

    const hasRecharts = !!RadialBarChart;

    return (
        <div className="bg-white rounded-2xl shadow-xl p-5 relative">
            <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sg-fade-up { animation: fadeUp 0.4s ease-out forwards; }
      `}</style>

            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-slate-800 font-bold text-sm tracking-tight flex items-center">
                    <span className="mr-1.5">📊</span> Match Score Breakdown
                </h3>
                <div className="relative group">
                    <span className="text-slate-400 text-base cursor-help select-none">ℹ️</span>
                    <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute right-0 top-6 w-64 bg-slate-900 text-white text-[11px] leading-relaxed rounded-xl px-3 py-2 shadow-2xl z-50 transition-all duration-200 pointer-events-none border border-white/10">
                        Score = hard filter pass/fail + BioGPT semantic match, weighted 0–100.
                        <div className="absolute top-0 right-2 -translate-y-1.5 w-3 h-3 bg-slate-900 rotate-45 border-l border-t border-white/10"></div>
                    </div>
                </div>
            </div>

            {/* ── Chart + Center Overlay ── */}
            <div className="relative h-[220px]">
                {hasRecharts ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                            innerRadius="28%"
                            outerRadius="95%"
                            startAngle={225}
                            endAngle={-45}
                            data={chartData}
                            barSize={12}
                        >
                            <RadialBar
                                dataKey="value"
                                cornerRadius={6}
                                isAnimationActive={true}
                                animationDuration={1000}
                                animationEasing="ease-out"
                                background={{ fill: '#F1F5F9' }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={false} />
                        </RadialBarChart>
                    </ResponsiveContainer>
                ) : (
                    // Fallback when recharts not installed
                    <FallbackArc score={score} tierColor={tier.color} />
                )}

                {/* ── Center Overlay ── */}
                <div className="absolute top-[55px] left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none sg-fade-up">
                    <span
                        className="text-[48px] font-extrabold leading-none tabular-nums"
                        style={{ color: tier.color, filter: `drop-shadow(${tier.glow})` }}
                    >
                        {displayScore}
                    </span>
                    <span className="text-slate-400 text-sm font-medium mt-0.5">Score</span>
                    <span
                        className="mt-2 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border"
                        style={{
                            color: tier.color,
                            borderColor: tier.color + '55',
                            background: tier.color + '15',
                        }}
                    >
                        {tier.label}
                    </span>
                </div>
            </div>

            {/* ── Legend ── */}
            <div className="space-y-2.5 mt-4">
                {breakdown.map((item, idx) => (
                    <div key={item.category} className="flex items-center gap-2.5">
                        {/* Colored dot */}
                        <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                        />
                        {/* Category name */}
                        <span className="text-slate-700 text-sm flex-1 truncate">{item.category}</span>
                        {/* Animated mini bar */}
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-2 rounded-full transition-all ease-out"
                                style={{
                                    width: `${barWidths[idx] || 0}%`,
                                    backgroundColor: item.color,
                                    transitionDuration: '800ms',
                                    transitionDelay: `${idx * 60}ms`,
                                }}
                            />
                        </div>
                        {/* Value */}
                        <span className="text-xs text-slate-500 w-8 text-right font-semibold tabular-nums">
                            {item.value}
                        </span>
                    </div>
                ))}
            </div>

            {/* ── Footer ── */}
            <div className="border-t border-slate-100 pt-3 mt-4 text-center">
                <span className="text-slate-400 text-[11px]">
                    🧠 Powered by <span className="font-semibold text-slate-500">BioGPT</span> + Sentence-Transformers
                </span>
            </div>
        </div>
    );
}
