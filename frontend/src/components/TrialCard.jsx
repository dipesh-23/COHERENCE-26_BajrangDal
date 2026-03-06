import React, { useState, useEffect } from 'react';

export default function TrialCard({
    trial_name = "EMBARK-T2DM Phase III",
    trial_id = "NCT-2026-001",
    match_score = 87,
    confidence = "HIGH",
    phase = "Phase III",
    sponsor = "NovaBiomed Inc.",
    location = "New York, NY",
    hpsa_flagged = false,
    criteria_breakdown = [
        { name: "Age 40-65", status: "met", detail: "Age 52 within range" },
        { name: "T2DM Diagnosis", status: "met", detail: "ICD E11.9 confirmed" },
        { name: "HbA1c >7%", status: "met", detail: "8.2% recorded" },
        { name: "Metformin Use", status: "met", detail: "Active prescription" },
        { name: "eGFR ≥60", status: "verify", detail: "71 recorded, confirm needed" },
        { name: "No Insulin", status: "met", detail: "Not in medications" }
    ],
    missing_data = ["eGFR lab confirmation"],
    exclusion_flags = [],
    recommendation = "Proceed",
    isSelected = false,
    onSelect = () => { },
    onViewReport = () => { }
}) {
    const [animatedScore, setAnimatedScore] = useState(0);

    useEffect(() => {
        // Animate score from 0 to actual value
        const duration = 900;
        const steps = 60;
        const stepTime = duration / steps;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            setAnimatedScore(Math.round(easeProgress * match_score));

            if (currentStep >= steps) {
                clearInterval(timer);
                setAnimatedScore(match_score);
            }
        }, stepTime);

        // Re-run animation if match_score changes
        currentStep = 0;
        setAnimatedScore(0);

        return () => clearInterval(timer);
    }, [match_score]);

    // Determine colors based on score
    const getScoreColor = (score) => {
        if (score >= 75) return { hex: '#10B981', border: 'border-emerald-500', text: 'text-emerald-500' };
        if (score >= 50) return { hex: '#F59E0B', border: 'border-amber-500', text: 'text-amber-500' };
        return { hex: '#EF4444', border: 'border-red-500', text: 'text-red-500' };
    };
    const scoreStyle = getScoreColor(match_score);

    // Confidence pill colors
    const confColor = {
        HIGH: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
        LOW: 'bg-red-100 text-red-700 border-red-200'
    }[confidence] || 'bg-slate-100 text-slate-700 border-slate-200';

    const confIcon = {
        HIGH: '✅',
        MEDIUM: '⚠️',
        LOW: '🔴'
    }[confidence] || '';

    // Recommendation pill colors
    const recColor = {
        'Proceed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'Verify First': 'bg-amber-100 text-amber-800 border-amber-200',
        'Not Suitable': 'bg-red-100 text-red-800 border-red-200'
    }[recommendation] || 'bg-slate-100 text-slate-800 border-slate-200';

    // Truncate strings
    const truncate = (str, length) => (str && str.length > length) ? str.substring(0, length) + '...' : str;

    return (
        <div
            className={`relative bg-white rounded-2xl cursor-pointer transition-all duration-200 ease-out border-l-[6px] ${scoreStyle.border} ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-2xl scale-[1.015]' : 'shadow-lg hover:scale-[1.015] hover:shadow-2xl'}`}
            onClick={onSelect}
        >
            <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in {
          animation: scaleIn 0.3s ease-out forwards;
          opacity: 0;
        }
        @keyframes shimmerGold {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer-gold {
          background: linear-gradient(90deg, transparent 25%, rgba(253, 230, 138, 0.5) 50%, transparent 75%);
          background-size: 200% auto;
          animation: shimmerGold 2s linear infinite;
        }
      `}</style>

            {/* 2. TOP ROW */}
            <div className="flex items-start justify-between p-4 pb-2">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{trial_name}</h3>
                        {hpsa_flagged && (
                            <span className="relative overflow-hidden bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center shadow-sm">
                                <span className="mr-1">⭐</span> Underserved Area
                                <span className="absolute inset-0 animate-shimmer-gold mix-blend-overlay"></span>
                            </span>
                        )}
                    </div>
                    <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 w-max">
                        {trial_id}
                    </span>
                </div>

                {/* Animated Score Ring */}
                <div className="relative flex items-center justify-center w-[56px] h-[56px] shrink-0 ml-4 rounded-full bg-slate-50 shadow-inner">
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                        <circle
                            cx="28" cy="28" r="24"
                            fill="none"
                            className="stroke-slate-200"
                            strokeWidth="4"
                        />
                        <circle
                            cx="28" cy="28" r="24"
                            fill="none"
                            stroke={scoreStyle.hex}
                            strokeWidth="4"
                            strokeDasharray="150.79" /* 2 * PI * 24 */
                            strokeDashoffset={150.79 - (150.79 * animatedScore) / 100}
                            strokeLinecap="round"
                            className="transition-all duration-300 ease-out"
                        />
                    </svg>
                    <div className="flex flex-col items-center justify-center z-10 bg-white rounded-full" style={{ width: '40px', height: '40px' }}>
                        <span className={`text-base font-bold leading-none ${scoreStyle.text}`}>{animatedScore}</span>
                        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-tighter mt-0.5">Match</span>
                    </div>
                </div>
            </div>

            {/* 3. META ROW */}
            <div className="flex items-center flex-wrap gap-2 px-4 py-1">
                <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full flex items-center shadow-sm ${confColor}`}>
                    <span className="mr-1 text-[11px] leading-none">{confIcon}</span> {confidence}
                </span>
                <span className="text-slate-500 text-xs flex items-center font-medium">
                    <span className="mr-1 opacity-80">🧪</span> {phase}
                </span>
                <span className="text-slate-500 text-xs flex items-center font-medium" title={sponsor}>
                    <span className="mr-1 opacity-80">🏢</span> {truncate(sponsor, 24)}
                </span>
                <span className="text-slate-500 text-xs flex items-center font-medium">
                    <span className="mr-1 opacity-80">📍</span> {location}
                </span>
            </div>

            {/* 4. CRITERIA ROW */}
            <div className="px-4 py-2 mt-1 border-t border-slate-50">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Criteria Breakdown</h4>
                <div className="flex overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    <div className="flex gap-2">
                        {criteria_breakdown?.map((criterion, index) => {
                            const isMet = criterion.status === 'met';
                            const isVerify = criterion.status === 'verify';

                            let chipClasses = 'bg-slate-100 text-slate-600';
                            let icon = '❌';

                            if (isMet) {
                                chipClasses = 'bg-emerald-500 text-white shadow-sm';
                                icon = '✅';
                            } else if (isVerify) {
                                chipClasses = 'bg-amber-400 text-slate-900 shadow-sm';
                                icon = '⚠️';
                            } else {
                                chipClasses = 'bg-red-500 text-white shadow-sm';
                                icon = '❌';
                            }

                            return (
                                <div
                                    key={index}
                                    className={`group relative animate-scale-in shrink-0 flex items-center px-2 py-1 text-[11px] font-semibold rounded-full border border-black/5 ${chipClasses}`}
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    <span className="mr-1 leading-none">{icon}</span>
                                    {truncate(criterion.name, 18)}

                                    {/* Tooltip */}
                                    <div className="invisible opacity-0 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[220px] bg-slate-900 text-white text-[11px] font-medium leading-tight rounded-lg px-3 py-2 shadow-xl z-50 transition-all duration-200 pointer-events-none group-hover:visible group-hover:opacity-100">
                                        <div className="font-bold mb-1 opacity-90">{criterion.name}</div>
                                        <div className="text-slate-300 font-normal leading-relaxed">{criterion.detail}</div>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[5px] border-transparent border-t-slate-900"></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 5. STRIPS */}
            {missing_data && missing_data.length > 0 && (
                <div className="bg-orange-50 border-t border-orange-200 px-4 py-2 flex items-start text-orange-700 text-xs font-medium">
                    <span className="mr-2 mt-0.5 text-[10px] leading-none">⚠️</span>
                    <span>
                        <strong className="font-bold">{missing_data.length}</strong> {missing_data.length === 1 ? 'field requires' : 'fields require'} verification
                        <span className="opacity-70 font-normal ml-1">({missing_data[0]}{missing_data.length > 1 ? ', ...' : ''})</span>
                    </span>
                </div>
            )}

            {exclusion_flags && exclusion_flags.length > 0 && (
                <div className="bg-red-50 border-t border-red-200 px-4 py-2 flex items-start text-red-700 text-xs font-medium">
                    <span className="mr-2 mt-0.5 text-[10px] leading-none">🚫</span>
                    <span>
                        <strong className="font-bold">{exclusion_flags.length}</strong> exclusions flagged
                    </span>
                </div>
            )}

            {/* 6. BOTTOM ROW */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl relative z-10">
                <button
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    className={`text-xs font-bold px-4 py-2 rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${isSelected
                            ? 'bg-blue-500 text-white shadow-md'
                            : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                        }`}
                >
                    {isSelected ? 'Selected' : 'Select'}
                </button>

                <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide border ${recColor}`}>
                        {recommendation}
                    </span>

                    <button
                        onClick={(e) => { e.stopPropagation(); onViewReport(); }}
                        className="group flex items-center text-xs font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                    >
                        Report
                        <svg className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
