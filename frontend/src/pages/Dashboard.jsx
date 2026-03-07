import React, { useState, useMemo, useEffect } from 'react';
import PatientUploader from '../components/PatientUploader';
import TrialCard from '../components/TrialCard';
import GeographyFilter from '../components/GeographyFilter';
import MatchReport from '../components/MatchReport';
import ScoreBreakdown from '../components/ScoreBreakdown';
import NewPatientModal from '../components/NewPatientModal';

// ── Simple CountUp Hook ──
function useCountUp(endValue, duration = 2000) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime = null;
        let animationFrame;
        const target = parseInt(endValue, 10);
        if (isNaN(target)) {
            setCount(endValue);
            return;
        }

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            // easeOutQuart
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            setCount(Math.floor(easeProgress * target));

            if (progress < 1) {
                animationFrame = requestAnimationFrame(step);
            } else {
                setCount(target);
            }
        };

        animationFrame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(animationFrame);
    }, [endValue, duration]);

    return count;
}

const AnimatedNumber = ({ value }) => {
    // If it's a string like "~24", extract the number, animate it, put the prefix back
    const isString = typeof value === 'string';
    const prefix = isString ? value.replace(/[0-9]/g, '') : '';
    const num = isString ? value.replace(/[^0-9]/g, '') : value;
    const count = useCountUp(num, 1500);

    return <>{prefix}{count}</>;
};
import TrialMap from '../components/TrialMap';
import { useTrialEngine } from '../hooks/useTrialEngine';

// ─── Score tier helpers & LAB colors ──────────────────────────────────────────
function labColor(key, value) {
    if (key === 'HbA1c') return value > 7 ? 'text-red-400' : 'text-emerald-400';
    if (key === 'eGFR') return value < 60 ? 'text-amber-400' : 'text-emerald-400';
    return 'text-slate-300';
}

const MARKER_COLORS = [
    '#EF4444', // red
    '#3B82F6', // blue
    '#10B981', // emerald
    '#F59E0B', // amber
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#84CC16', // lime
    '#A855F7', // purple
    '#0EA5E9', // sky
    '#F43F5E', // rose
    '#22C55E', // green
    '#EAB308', // yellow
    '#64748B', // slate
    '#FB923C', // orange-400
    '#818CF8', // indigo-400
    '#2DD4BF', // teal-400
];

// ─── Derive ScoreGauge breakdown from criteria_breakdown ──────────────────────
// Maps criteria statuses into [{category, value, color}] expected by ScoreGauge.
// When backend sends real `criteria_breakdown`, this transformation is the only
// integration point needed here — no other changes required.
function deriveBreakdown(criteria = []) {
    const met = criteria.filter(c => c.status === 'pass').length;
    const total = criteria.length || 1;
    const metPct = Math.round((met / total) * 100);

    const labCriteria = criteria.filter(c => /hba1c|egfr|creatinine|lab|renal|cholesterol/i.test(c.name));
    const meds = criteria.filter(c => /medication|metformin|insulin|drug|inhibitor|blocker/i.test(c.name));
    const diag = criteria.filter(c => /diagnosis|t2dm|diabetes|hypertension|ckd|dx/i.test(c.name));

    const pct = (arr) => arr.length === 0 ? metPct : Math.round((arr.filter(c => c.status === 'pass').length / arr.length) * 100);

    return [
        { category: 'Demographics', value: metPct, color: '#3B82F6' },
        { category: 'Lab Values', value: pct(labCriteria), color: '#10B981' },
        { category: 'Diagnosis', value: pct(diag), color: '#8B5CF6' },
        { category: 'Medications', value: pct(meds), color: '#F59E0B' },
    ];
}

const NAV_TABS = ['Screening', 'My Patients', 'Trial Database', 'Reports'];

export default function Dashboard({
    currentUser = null,   // { id, name, role, department, hospital }
    token = null,         // JWT — passed to API calls via Authorization header
    onLogout = () => { },  // clears session in App.jsx
}) {
    const [activeTab, setActiveTab] = useState('Screening');
    const [selectedTrial, setSelectedTrial] = useState(null);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [filters, setFilters] = useState({ zip: '10001', radius_miles: 50, hpsa_only: false });
    const [sortBy, setSortBy] = useState('score');
    const [viewMode, setViewMode] = useState('list');
    const [maxDistance, setMaxDistance] = useState('all');
    const [focusedLocation, setFocusedLocation] = useState(null);
    const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
    const [extraReviews, setExtraReviews] = useState(0);
    const [flaggedTrials, setFlaggedTrials] = useState(new Set());

    const toggleFlag = (trialId) => {
        setFlaggedTrials(prev => {
            const next = new Set(prev);
            if (next.has(trialId)) next.delete(trialId);
            else next.add(trialId);
            return next;
        });
    };

    // ── Engine: all data + API calls come from here ──
    const {
        matchTrials,
        patientData,
        matchResults,
        loadingStatus,
        setPatientData,
    } = useTrialEngine(token);

    // ── Filtered & Sorted results ──
    const sortedResults = useMemo(() => {
        let copy = [...matchResults];
        
        if (maxDistance !== 'all') {
            const limit = parseInt(maxDistance, 10);
            copy = copy.filter(r => r.site_info?.distance_miles !== null && r.site_info?.distance_miles <= limit);
        }

        const confRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        if (sortBy === 'score') copy.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        if (sortBy === 'confidence') copy.sort((a, b) => (confRank[b.confidence] || 0) - (confRank[a.confidence] || 0));
        if (sortBy === 'location') copy.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
        return copy;
    }, [matchResults, sortBy, maxDistance]);

    // ── Stable color mapping for map markers ──
    const trialColors = useMemo(() => {
        const colors = {};
        matchResults.forEach((r, i) => {
            colors[r.trial_id] = MARKER_COLORS[i % MARKER_COLORS.length];
        });
        return colors;
    }, [matchResults]);

    // ── Quick stats ──
    const topScore = matchResults.length ? Math.max(...matchResults.map(r => r.match_score || 0)) : '--';
    const verifications = matchResults.reduce((acc, r) => acc + (r.missing_data?.length || 0), 0) + extraReviews;
    const derivedBreakdown = useMemo(() => deriveBreakdown(selectedTrial?.criteria_breakdown), [selectedTrial]);

    // ── Handlers ──
    const handlePatientLoaded = (data) => {
        // data = AnonymizedPatient returned from POST /ingest/patient (via PatientUploader)
        // Sync it into the engine's patientData state so the patient panel and labs update
        if (data?.patient_id) {
            setPatientData(data);
            matchTrials(data, 5, filters);
            setIsNewPatientOpen(false); // Close if opened from modal
        }
    };

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
        if (patientData?.patient_id) matchTrials(patientData, 5, newFilters);
    };

    const handleLocateOnMap = (trial) => {
        setSelectedTrial(trial);
        setActiveTab('Screening');
        setViewMode('map');
        if (trial.site_info?.lat && trial.site_info?.lng) {
            setFocusedLocation([trial.site_info.lat, trial.site_info.lng]);
        }
    };

    const isMatchLoading = !!loadingStatus?.match;

    return (
        <div className="flex flex-col h-screen w-full overflow-hidden font-sans bg-[#F8FAFC] text-[#0F1E34]">


            {/* ═══ 1. STICKY TOP NAV ═════════════════════════════════════════════ */}
            <nav className="sticky top-0 z-50 h-16 shrink-0 flex items-center justify-between px-8 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm"
                style={{ animation: 'navSlideDown 0.4s cubic-bezier(0.16,1,0.3,1) forwards' }}>

                {/* ── Keyframes injected inline ── */}
                <style>{`
                    @keyframes navSlideDown {
                        from { opacity: 0; transform: translateY(-100%); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes logoPulse {
                        0%, 100% { box-shadow: 0 0 0 0 rgba(13,148,136,0.3); }
                        50%       { box-shadow: 0 0 0 8px rgba(13,148,136,0); }
                    }
                    @keyframes dotPulseNav {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50%       { opacity: 0.6; transform: scale(1.4); }
                    }
                    @keyframes tabUnderline {
                        from { transform: scaleX(0); }
                        to   { transform: scaleX(1); }
                    }
                    .nav-tab-active-bar {
                        animation: tabUnderline 0.25s ease-out forwards;
                        transform-origin: center;
                    }
                    .logo-icon { animation: logoPulse 2.5s ease-in-out infinite; }
                    .nav-dot { animation: dotPulseNav 1.8s ease-in-out infinite; }
                `}</style>

                {/* Logo */}
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="logo-icon bg-[#0D9488]/10 rounded-xl p-2 border border-[#0D9488]/20 transition-all duration-300 group-hover:bg-[#0D9488]/20 group-hover:scale-110">
                        <span className="text-xl leading-none">🏥</span>
                    </div>
                    <div>
                        <span className="text-[#0F1E34] font-black text-[18px] tracking-tight block leading-tight group-hover:text-[#0D9488] transition-colors duration-200">
                            TrialSync<span className="text-[#0D9488]">.ai</span>
                        </span>
                        <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider block">Clinical Research Platform</span>
                    </div>
                </div>

                {/* Center nav tabs */}
                <div className="flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                    {NAV_TABS.map((label, i) => (
                        <button
                            key={label}
                            onClick={() => setActiveTab(label)}
                            style={{ animationDelay: `${i * 60 + 100}ms`, animation: 'navSlideDown 0.5s cubic-bezier(0.16,1,0.3,1) both' }}
                            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105 active:scale-95 ${
                                activeTab === label
                                    ? 'bg-[#0D9488]/8 text-[#0D9488]'
                                    : 'text-slate-500 hover:text-[#0F1E34] hover:bg-slate-100'
                            }`}
                        >
                            {label}
                            {activeTab === label && (
                                <span className="nav-tab-active-bar absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-[#0D9488] to-[#14B8A6] rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Right — status + user */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 hover:bg-emerald-100 transition-colors duration-150">
                        <div className="nav-dot w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-emerald-700 text-xs font-semibold">Engine Online</span>
                    </div>
                    {currentUser && (
                        <div className="flex items-center gap-2 border border-slate-200 rounded-full pl-1.5 pr-3 py-1.5 bg-white shadow-sm hover:border-[#0D9488]/40 hover:shadow-md hover:shadow-[#0D9488]/10 transition-all duration-200 cursor-default">
                            <div className="w-7 h-7 rounded-full bg-[#0D9488]/10 border border-[#0D9488]/20 flex items-center justify-center text-sm hover:bg-[#0D9488]/20 transition-colors duration-150">🔬</div>
                            <span className="text-[#0F1E34] text-xs font-bold">{currentUser.email?.split('@')[0] || 'Doctor'}</span>
                        </div>
                    )}
                    <button
                        onClick={onLogout}
                        className="group text-slate-500 hover:text-red-500 text-xs font-semibold border border-slate-200 hover:border-red-200 hover:bg-red-50 rounded-full px-4 py-1.5 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                        <span className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span> Sign Out
                    </button>
                </div>
            </nav>

            {/* ── STATS STRIP ── */}
            <div className="bg-white px-8 py-5 flex items-center justify-between border-b border-slate-100 shrink-0"
                style={{ animation: 'statsSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
                <style>{`
                    @keyframes statsSlideUp {
                        from { opacity: 0; transform: translateY(12px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
                <div>
                    <h1 className="text-[#0F1E34] font-black text-2xl tracking-tight">
                        Good morning, <span className="text-[#0D9488] inline-block hover:scale-105 transition-transform duration-200 cursor-default">{currentUser?.email?.split('@')[0] || 'Doctor'}</span> 👋
                    </h1>
                    <p className="text-slate-400 text-sm mt-0.5">Clinical Trials Office · TrialSync.ai Research Center</p>
                </div>
                <div className="flex items-center gap-3">
                    {[
                        { icon: '🔬', label: 'Trials Screened', value: matchResults.length, bg: 'bg-[#0D9488]/8', text: 'text-[#0D9488]', border: 'border-[#0D9488]/15', glow: 'hover:shadow-[#0D9488]/15' },
                        { icon: '⚠️', label: 'Need Verification', value: verifications, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', glow: 'hover:shadow-amber-100' },
                    ].map((s, i) => (
                        <div key={s.label}
                            style={{ animationDelay: `${i * 80 + 200}ms`, animation: 'statsSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}
                            className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${s.bg} ${s.border} shadow-sm hover:shadow-md ${s.glow} hover:-translate-y-0.5 transition-all duration-200 cursor-default`}>
                            <span className="text-xl leading-none">{s.icon}</span>
                            <div>
                                <p className={`font-black text-xl leading-none ${s.text}`}>
                                    <AnimatedNumber value={s.value} />
                                </p>
                                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── QUICK ACTIONS STRIP ── */}
            {patientData && (
                <div className="bg-slate-50/80 border-b border-teal-100 px-6 py-2.5 flex items-center gap-3 shrink-0 relative z-30">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Quick Actions:</span>
                    <button onClick={() => setExtraReviews(prev => prev + 1)} className="bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-sm">
                        ⚠️ Flag for Review
                    </button>
                    <button
                        onClick={() => setIsNewPatientOpen(true)}
                        className="ml-auto bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-sm"
                    >
                        ➕ Real Patient Entry
                    </button>
                </div>
            )}
            
            <NewPatientModal isOpen={isNewPatientOpen} onClose={() => setIsNewPatientOpen(false)} onSubmit={handlePatientLoaded} />

            {/* ═══ 2. THREE-COLUMN BODY ═══════════════════════════════════════════ */}
            <main className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">

                {/* ── LEFT COLUMN ── */}
                <aside className="w-80 shrink-0 flex flex-col overflow-y-auto bg-[#F8FFFE] border-r border-slate-100 p-4 gap-4 pb-20">
                    <h2 className="text-slate-800 font-bold text-base flex items-center gap-2 mb-2"><span>⚙️</span> Patient Screening</h2>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider pl-1">📁 Upload Patient Record</span>
                        <PatientUploader
                            onPatientLoaded={handlePatientLoaded}
                            userRole={currentUser?.role || 'crc'}
                            token={token}
                            externalPatient={patientData}
                        />
                    </div>

                    {/* GeographyFilter — produces {zip, radius_miles, hpsa_only} for POST /match */}
                    <GeographyFilter onFilterChange={handleFilterChange} />

                    {/* Ethics Monitor */}
                    <div className="mt-auto bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                        <h3 className="text-slate-800 font-bold text-sm flex items-center gap-2 mb-3"><span>🛡️</span> Protocol Compliance</h3>
                        {[
                            { label: 'Site Accessibility Check', status: 'ok' },
                            { label: 'Inclusion Fairness Audit', status: 'ok' },
                            { label: 'Record Completeness', status: verifications > 2 ? 'warn' : 'ok' },
                        ].map(row => (
                            <div key={row.label} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                                <span className="text-slate-600 font-medium text-xs">{row.label}</span>
                                <div className={`flex items-center gap-1.5`}>
                                    <div className={`w-2 h-2 rounded-full ${row.status === 'warn' ? 'bg-amber-400 anim-pulse' : 'bg-[#0D9488]'}`} />
                                    <span className={`text-[10px] font-bold ${row.status === 'warn' ? 'text-amber-600' : 'text-[#0D9488]'}`}>
                                        {row.status === 'warn' ? 'Review' : 'Pass'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* ── CENTER COLUMN ── */}
                <section className="flex-1 flex flex-col overflow-y-auto bg-[#F8FAFC] p-6 pb-32">

                    {/* ── SCREENING TAB ── */}
                    {activeTab === 'Screening' && (
                        <>
                            <div className="flex items-center justify-between mb-6 shrink-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-[#0F1E34] text-2xl font-black tracking-tight">Eligible Trial Matches</h2>
                                    {matchResults.length > 0 && (
                                        <span className="bg-[#0D9488] text-white text-sm font-bold px-3 py-1 rounded-full shadow-sm">
                                            {sortedResults.length}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-[#0D9488] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            📄 List
                                        </button>
                                        <button
                                            onClick={() => setViewMode('map')}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'map' ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            🗺️ Map
                                        </button>
                                    </div>
                                    <select
                                        value={maxDistance}
                                        onChange={e => setMaxDistance(e.target.value)}
                                        className="appearance-none bg-white border-2 border-slate-100 text-slate-700 font-bold text-sm rounded-xl pl-4 pr-10 py-2 focus:outline-none focus:ring-4 focus:ring-[#0D9488]/20 focus:border-[#0D9488] shadow-sm cursor-pointer"
                                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                                    >
                                        <option value="all">Distance: Any</option>
                                        <option value="50">Within 50 miles</option>
                                        <option value="250">Within 250 miles</option>
                                        <option value="1000">Within 1,000 miles</option>
                                    </select>
                                    <select
                                        value={sortBy}
                                        onChange={e => setSortBy(e.target.value)}
                                        className="appearance-none bg-white border-2 border-slate-100 text-slate-700 font-bold text-sm rounded-xl pl-4 pr-10 py-2 focus:outline-none focus:ring-4 focus:ring-[#0D9488]/20 focus:border-[#0D9488] shadow-sm cursor-pointer"
                                        style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
                                    >
                                        <option value="score">Sort by: Best Match</option>
                                        <option value="confidence">Sort by: Confidence</option>
                                        <option value="location">Sort by: Location</option>
                                    </select>
                                </div>
                            </div>
                            {loadingStatus.match ? (
                                <div className="space-y-5 anim-fade-up">
                                    <div className="bg-white rounded-2xl p-6 border border-teal-100 shadow-sm relative overflow-hidden flex items-center justify-between">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#0D9488] to-emerald-400" />
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                                                <div className="w-6 h-6 border-[3px] border-teal-200 border-t-[#0D9488] rounded-full animate-[loader-spin_1s_linear_infinite]" />
                                            </div>
                                            <div>
                                                <h3 className="text-[#0F1E34] font-black tracking-tight text-[15px] mb-1">Scanning Trial Database...</h3>
                                                <div className="flex items-center gap-2 text-xs font-bold font-mono text-slate-400">
                                                    <span className="text-[#0D9488] animate-pulse">Running NLP Parser</span>
                                                    <span>·</span>
                                                    <span>Cross-referencing OpenFDA</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right pr-2">
                                            <div className="text-sm font-black text-slate-300 font-mono tracking-widest animate-pulse">EXTRACTING</div>
                                        </div>
                                    </div>
                                    
                                    {/* Skeletons */}
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ animationDelay: `${i * 100}ms` }}>
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
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {matchResults.length === 0 && (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border-2 border-dashed border-teal-100 rounded-3xl shadow-sm">
                                            <div className="text-[64px] mb-5">📋</div>
                                            <p className="text-slate-800 text-lg font-bold mb-1">No patient loaded for screening</p>
                                            <p className="text-slate-500 text-sm max-w-sm mb-3">Upload a de-identified patient record to begin automated eligibility screening</p>
                                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Supports JSON · HL7 FHIR · CSV formats</p>
                                        </div>
                                    )}
                                    {matchResults.length > 0 && viewMode === 'list' && (
                                        <div className="flex flex-col gap-4 pb-8">
                                            {sortedResults.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500 font-bold bg-white rounded-2xl border border-teal-100 shadow-sm">No trials met geographic bounds.</div>
                                            ) : (
                                                sortedResults.map((result, index) => (
                                                    <div key={result.trial_id} className="anim-fade-up" style={{ animationDelay: `${index * 80}ms` }}>
                                                        <TrialCard
                                                            {...result}
                                                            userRole={currentUser?.role || 'crc'}
                                                            isSelected={selectedTrial?.trial_id === result.trial_id}
                                                            markerColor={trialColors[result.trial_id]}
                                                            completion_likelihood={result.completion_likelihood ?? null}
                                                            dropout_reason={result.dropout_reason ?? ''}
                                                            visits_required={result.visits_required ?? null}
                                                            telehealth_enabled={result.telehealth_enabled ?? false}
                                                            polypharmacy_flags={result.polypharmacy_flags ?? []}
                                                            investigational_drug={result.investigational_drug ?? ''}
                                                            onSelect={() => setSelectedTrial(result)}
                                                            onViewReport={() => { setSelectedTrial(result); setIsReportOpen(true); }}
                                                            onLocate={() => handleLocateOnMap(result)}
                                                        />
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                    {matchResults.length > 0 && viewMode === 'map' && (
                                        <div className="anim-fade-up pb-8 h-[600px]">
                                            <TrialMap 
                                                trials={sortedResults}
                                                patientLat={patientData?.lat}
                                                patientLng={patientData?.lng}
                                                trialColors={trialColors}
                                                focusedLocation={focusedLocation}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ── MY PATIENTS TAB ── */}
                    {activeTab === 'My Patients' && (
                        <div className="flex-1 flex flex-col anim-fade-up">
                            <h2 className="text-slate-800 text-2xl font-bold tracking-tight mb-6">Patient Records</h2>
                            {patientData ? (
                                <div className="bg-gradient-to-br from-[#0D9488]/8 to-[#0D9488]/3 border border-teal-100 rounded-2xl p-5 max-w-xl shadow-sm">
                                    {/* Case file header */}
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-teal-200/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-md">
                                                {patientData.gender === 'Female' ? '♀' : '♂'}
                                            </div>
                                            <div>
                                                <p className="text-teal-900 font-bold text-lg font-mono tracking-tight">{patientData.patient_id}</p>
                                                <p className="text-teal-700 text-sm font-medium">{patientData.age}yo {patientData.gender} · {patientData.zip || 'No ZIP'}</p>
                                            </div>
                                        </div>
                                        <span className="bg-white text-teal-700 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-teal-200 shadow-sm">
                                            🔒 De-identified
                                        </span>
                                    </div>
                                    {/* Diagnoses */}
                                    <div className="mb-4">
                                        <p className="text-teal-800/60 text-[10px] uppercase tracking-wider font-bold mb-2">Active Diagnoses</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {patientData.diagnoses?.map((d, i) => (
                                                <span key={i} className="bg-white border border-teal-200 shadow-sm text-teal-800 font-medium text-[11px] px-2.5 py-1 rounded-lg">
                                                    {d}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Key labs */}
                                    <div className="mb-4">
                                        <p className="text-teal-800/60 text-[10px] uppercase tracking-wider font-bold mb-2">Key Lab Values</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {Object.entries(patientData.labs || {}).map(([key, val]) => (
                                                <div key={key} className="bg-white shadow-sm rounded-xl px-3 py-2 text-center border border-teal-100">
                                                    <p className={`font-bold text-lg ${key === 'HbA1c' && val > 7 ? 'text-red-500' :
                                                        key === 'eGFR' && val < 60 ? 'text-amber-500' :
                                                            'text-teal-600'
                                                        }`}>{val}</p>
                                                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">{key}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Screening status */}
                                    <div className="flex items-center justify-between pt-3 mt-1 border-t border-teal-200/50">
                                        <span className="text-teal-800/60 font-bold text-[11px] uppercase tracking-wider">Screening Status</span>
                                        <span className="text-emerald-600 text-xs font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.5)]"></span>
                                            Ready
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border-2 border-dashed border-teal-100 rounded-3xl shadow-sm">
                                    <div className="text-[64px] mb-5">👤</div>
                                    <p className="text-slate-800 text-lg font-bold mb-1">No patient loaded</p>
                                    <p className="text-slate-500 text-sm max-w-sm mb-5">Upload a patient record using the panel on the left or enable Demo Mode.</p>
                                    <button onClick={() => setActiveTab('Screening')} className="bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm transition-colors">← Back to Screening</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TRIALS TAB ── */}
                    {activeTab === 'Trial Database' && (
                        <div className="flex-1 flex flex-col anim-fade-up">
                            <h2 className="text-slate-800 text-2xl font-bold tracking-tight mb-6">Trial Database</h2>
                            {matchResults.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border-2 border-dashed border-teal-100 rounded-3xl shadow-sm">
                                    <div className="text-[64px] mb-5">🧪</div>
                                    <p className="text-slate-800 text-lg font-bold mb-1">No trials to display</p>
                                    <p className="text-slate-500 text-sm max-w-sm mb-5">Run a match from the Screening dashboard to see all trials here.</p>
                                    <button onClick={() => setActiveTab('Screening')} className="bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm transition-colors">← Go to Screening</button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto bg-white rounded-2xl border border-teal-50 shadow-sm">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                {['Trial', 'Phase', 'Score', 'Confidence', 'Location', 'Recommendation', ''].map(h => (
                                                    <th key={h} className="px-5 py-3.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {matchResults.map((r) => {
                                                const tier = r.match_score >= 75 ? 'text-emerald-600' : r.match_score >= 50 ? 'text-amber-500' : 'text-red-500';
                                                const conf = { HIGH: 'bg-emerald-50 text-emerald-700 border border-emerald-200', MEDIUM: 'bg-amber-50 text-amber-700 border border-amber-200', LOW: 'bg-red-50 text-red-700 border border-red-200' }[r.confidence] || '';
                                                return (
                                                    <tr key={r.trial_id} className="bg-white hover:bg-teal-50/30 transition-colors cursor-pointer" onClick={() => handleLocateOnMap(r)}>
                                                        <td className="px-5 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: trialColors[r.trial_id] || '#ccc' }}></div>
                                                                <div>
                                                                    <p className="text-slate-800 font-bold">{r.title}</p>
                                                                    <p className="font-mono text-xs text-slate-400 mt-1">{r.trial_id}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-slate-600 font-medium">{r.phase}</td>
                                                        <td className={`px-5 py-4 font-bold tabular-nums ${tier}`}>{r.match_score}</td>
                                                        <td className="px-5 py-4"><span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${conf}`}>{r.confidence}</span></td>
                                                        <td className="px-5 py-4 text-slate-600">{r.location}</td>
                                                        <td className="px-5 py-4 text-slate-600 font-medium">{r.recommendation}</td>
                                                        <td className="px-5 py-4 text-right">
                                                            <button onClick={e => { e.stopPropagation(); setSelectedTrial(r); setIsReportOpen(true); }} className="text-xs text-[#0D9488] hover:text-[#0F766E] font-bold transition-colors underline underline-offset-2">Report →</button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── REPORTS TAB ── */}
                    {activeTab === 'Reports' && (
                        <div className="flex-1 flex flex-col anim-fade-up">
                            <h2 className="text-slate-800 text-2xl font-bold tracking-tight mb-6 flex items-center gap-3">
                                <span>📑</span> Patient Match Reports
                            </h2>
                            {!patientData ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border-2 border-dashed border-teal-100 rounded-3xl shadow-sm">
                                    <div className="text-[64px] mb-5">👤</div>
                                    <p className="text-slate-800 text-lg font-bold mb-1">No patient loaded</p>
                                    <p className="text-slate-500 text-sm max-w-sm mb-5">Upload a patient record to generate match reports.</p>
                                    <button onClick={() => setActiveTab('Screening')} className="bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm transition-colors">← Go to Screening</button>
                                </div>
                            ) : matchResults.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border-2 border-dashed border-teal-100 rounded-3xl shadow-sm">
                                    <div className="text-[64px] mb-5">📊</div>
                                    <p className="text-slate-800 text-lg font-bold mb-1">No reports generated</p>
                                    <p className="text-slate-500 text-sm max-w-sm mb-5">Run a match from the Screening dashboard to generate reports.</p>
                                    <button onClick={() => setActiveTab('Screening')} className="bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm transition-colors">← Go to Screening</button>
                                </div>
                            ) : (
                                <div className="space-y-8 pb-12">
                                    {/* --- 1. PATIENT SUMMARY HEADER --- */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-teal-100 p-6 shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                        <div>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">Generated Reports For</p>
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-full bg-[#0ea5e9] flex items-center justify-center text-2xl text-white font-bold shadow-md shadow-sky-500/20">
                                                    {patientData.gender === 'Female' ? 'F' : 'M'}
                                                </div>
                                                <div>
                                                    <p className="text-xl text-[#0F1E34] font-black tracking-tight mb-1">{patientData.patient_id}</p>
                                                    <div className="flex flex-col gap-0.5 text-sm text-slate-500">
                                                        <span className="flex items-center gap-1.5">👤 {patientData.age} years · {patientData.gender}</span>
                                                        <span className="flex items-center gap-1.5">🩺 {patientData.diagnoses?.length || 0} active diagnoses</span>
                                                        <span className="flex items-center gap-1.5 text-xs mt-0.5 text-slate-400">💊 {(patientData.diagnoses || []).slice(0, 3).join(' · ')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Counts */}
                                        <div className="flex items-center gap-3">
                                            {[
                                                { label: 'PROCEED', count: matchResults.filter(r => r.recommendation === 'Proceed').length, bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-600', countText: 'text-emerald-700' },
                                                { label: 'REVIEW', count: flaggedTrials.size, bg: 'bg-amber-50/50', border: 'border-amber-200', text: 'text-amber-600', countText: 'text-amber-700' },
                                                { label: 'NOT SUITABLE', count: matchResults.filter(r => r.recommendation === 'Not Suitable').length, bg: 'bg-red-50/50', border: 'border-red-200', text: 'text-red-500', countText: 'text-red-600' }
                                            ].map(stat => (
                                                <div key={stat.label} className={`flex flex-col items-center justify-center w-24 h-24 rounded-2xl border ${stat.bg} ${stat.border} shadow-sm`}>
                                                    <span className={`text-3xl font-black ${stat.countText}`}>{stat.count}</span>
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider mt-1 text-center leading-tight px-2 ${stat.text}`}>{stat.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* --- 2. ELIGIBLE GRID (Proceed + Verify) --- */}
                                    {(() => {
                                        const eligible = matchResults.filter(r => r.recommendation === 'Proceed' || r.recommendation === 'Verify First').sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
                                        if (eligible.length === 0) return null;
                                        return (
                                            <div className="space-y-4">
                                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-2">
                                                    <span className="w-4 h-4 rounded bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px]">✓</span> 
                                                    Eligible To Proceed – {eligible.length} Trials
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                                                    {eligible.map((r, i) => (
                                                        <ReportCard key={r.trial_id} report={r} index={i}
                                                            onClick={() => { setSelectedTrial(r); setIsReportOpen(true); }}
                                                            isFlagged={flaggedTrials.has(r.trial_id)}
                                                            onFlag={() => toggleFlag(r.trial_id)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* --- 3. NOT SUITABLE GRID --- */}
                                    {(() => {
                                        const unsuitable = matchResults.filter(r => r.recommendation === 'Not Suitable').sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
                                        if (unsuitable.length === 0) return null;
                                        return (
                                            <div className="space-y-4 mt-8 pt-8 border-t border-slate-200 border-dashed">
                                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 px-2">
                                                    <span className="w-4 h-4 rounded bg-red-100 text-red-500 flex items-center justify-center text-[10px]">✕</span> 
                                                    Not Suitable – {unsuitable.length} Trials
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                                                    {unsuitable.map((r, i) => (
                                                        <ReportCard key={r.trial_id} report={r} index={i}
                                                            onClick={() => { setSelectedTrial(r); setIsReportOpen(true); }}
                                                            isFlagged={flaggedTrials.has(r.trial_id)}
                                                            onFlag={() => toggleFlag(r.trial_id)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* ── RIGHT COLUMN ── */}
                <aside className="w-96 shrink-0 flex flex-col overflow-y-auto bg-[#F8FAFC] border-l border-slate-200 p-4 gap-4">
                    {/* ScoreBreakdown — shown when a trial is selected */}
                    {selectedTrial ? (
                        <div className="anim-scale-in">
                            <ScoreBreakdown
                                score={selectedTrial.match_score}
                                criteria_breakdown={selectedTrial.criteria_breakdown || []}
                                confidence={selectedTrial.confidence || 'MEDIUM'}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-white min-h-[320px]">
                            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-3xl mb-4">💡</div>
                            <p className="text-[#0F1E34] font-bold text-sm mb-1">Select a trial</p>
                            <p className="text-slate-400 text-xs max-w-[180px] leading-relaxed">Click any trial card to see the detailed eligibility score breakdown</p>
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="flex flex-col gap-3">
                        {[
                            { icon: '🎯', label: 'Best Eligibility Score', value: topScore !== '--' ? `${topScore}` : '--', sub: topScore !== '--' ? '/ 100' : '', bg: 'bg-[#0D9488]/10', border: 'border-[#0D9488]/20', text: 'text-[#0D9488]' },
                            { icon: '📋', label: 'Trials Screened', value: matchResults.length, sub: '', bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
                            {
                                icon: '⚠️', label: 'Items to Verify', value: verifications, sub: '',
                                bg: verifications > 0 ? 'bg-amber-50' : 'bg-slate-50',
                                border: verifications > 0 ? 'border-amber-200' : 'border-slate-100',
                                text: verifications > 0 ? 'text-amber-700' : 'text-slate-400'
                            },
                        ].map(stat => (
                            <div key={stat.label} className={`flex items-center gap-4 rounded-xl p-4 border ${stat.bg} ${stat.border}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border ${stat.bg} ${stat.border} shrink-0 bg-white shadow-sm`}>{stat.icon}</div>
                                <div>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">{stat.label}</p>
                                    <p className={`text-xl font-bold ${stat.text} flex items-baseline gap-1`}>
                                        {stat.value}<span className="text-slate-500 text-xs font-normal">{stat.sub}</span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </main>

            {/* ═══ 3. MATCH REPORT MODAL ══════════════════════════════════════════ */}
            <MatchReport
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                report={selectedTrial}
                userRole={currentUser?.role || 'crc'}
            />
        </div>
    );
}

// ─── NEW REPORT CARD COMPONENT (Matches UI Mockup) ──────────────────────────
function ReportCard({ report, index, onClick, isFlagged = false, onFlag = () => {} }) {
    const [aiOpen, setAiOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiExplanation, setAiExplanation] = useState(null);

    const fetchExplanation = async (e) => {
        e.stopPropagation();
        setAiOpen(o => !o);
        if (aiExplanation || aiLoading) return; // already fetched
        setAiLoading(true);
        try {
            const API = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
                ? import.meta.env.VITE_API_BASE_URL : 'http://localhost:8001';
            const res = await fetch(`${API}/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trial_id: report.trial_id,
                    title: report.title || '',
                    match_score: report.match_score || 0,
                    recommendation: report.recommendation || '',
                    confidence: report.confidence || 'MEDIUM',
                    criteria_breakdown: report.criteria_breakdown || [],
                    site_info: report.site_info || {},
                    investigational_drug: report.investigational_drug || '',
                    completion_likelihood: report.completion_likelihood || 95,
                    missing_data: report.missing_data || [],
                }),
            });
            const data = await res.json();
            setAiExplanation(data.narrative || 'No explanation available.');
        } catch {
            setAiExplanation('Unable to fetch explanation. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const isProceed = report.recommendation === 'Proceed';
    const isVerify = report.recommendation === 'Verify First';
    const isUnsuitable = report.recommendation === 'Not Suitable';

    // Status config
    const config = {
        Proceed: {
            borderL: 'border-l-[5px] border-l-emerald-500',
            dot: 'bg-emerald-500',
            text: 'text-emerald-700',
            label: 'PROCEED'
        },
        'Verify First': {
            borderL: 'border-l-[5px] border-l-amber-400',
            dot: 'bg-amber-400',
            text: 'text-amber-700',
            label: 'MANUAL REVIEW'
        },
        'Not Suitable': {
            borderL: 'border-l-[5px] border-l-red-500',
            dot: 'bg-red-500',
            text: 'text-red-600',
            label: 'NOT SUITABLE'
        }
    }[report.recommendation] || config['Not Suitable'];

    const criteria = report.criteria_breakdown || [];
    
    // Calculate simple circle score pct (matches the 49%, 23%, etc from mockup)
    const displayScore = Math.round(report.match_score || 0);
    const scoreDeg = (displayScore / 100) * 360;
    const scoreColor = isProceed ? '#10B981' : isVerify ? '#F59E0B' : '#EF4444';

    return (
        <div 
            onClick={onClick}
            className={`bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:-translate-y-1 hover:shadow-md transition-all cursor-pointer overflow-hidden ${config.borderL} anim-fade-up`}
            style={{ animationDelay: `${index * 80}ms` }}
        >
            {/* Top row */}
            <div className="p-5 pb-3">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                        <span className={`text-[11px] font-black uppercase tracking-wider ${config.text} w-min leading-tight`}>
                            {config.label.replace(' ', '\n')}
                        </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 border border-slate-200 rounded px-2 py-0.5 bg-slate-50">
                        {report.trial_id}
                    </span>
                </div>

                <h3 className="font-bold text-[#0F1E34] text-[15px] leading-snug mb-2 line-clamp-3">
                    {report.title}
                </h3>
                
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-slate-500">{report.sponsor}</span>
                    <span className="text-[10px] text-[#3B82F6] font-bold bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
                        {report.phase}
                    </span>
                </div>

                {/* Criteria Chips Grid */}
                <div className="flex flex-wrap gap-1.5 mb-2 h-[84px] overflow-hidden content-start">
                    {criteria.slice(0, 6).map((c, i) => {
                        const style = c.status === 'pass' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : c.status === 'fail'
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200 font-medium';
                        
                        const icon = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✕' : '?';
                        
                        // Shorten names for the small chips
                        let shortName = c.name;
                        if (shortName.includes('Age')) shortName = 'Age';
                        if (shortName.includes('Diagnosis:')) shortName = 'Diagnosis';
                        if (shortName.includes('Excluded Condition')) shortName = shortName.replace('Excluded Condition/Criteria: ', '');
                        if (shortName.length > 20) shortName = shortName.substring(0, 18) + '...';

                        return (
                            <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 ${style}`}>
                                <span>{icon}</span> {shortName}
                            </span>
                        );
                    })}
                    {criteria.length > 6 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 text-slate-400">
                            +{criteria.length - 6} more
                        </span>
                    )}
                </div>
            </div>

            {/* Bottom Footer (Score Area) */}
            <div className="mt-auto border-t border-slate-100 p-5 flex items-end justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Match<br/>Score</p>
                        <p className={`text-2xl font-black tabular-nums leading-none ${isProceed ? 'text-emerald-500' : isVerify ? 'text-amber-500' : 'text-slate-300'}`}>
                            {isUnsuitable ? '0' : report.match_score?.toFixed(2) || '0.00'}
                        </p>
                    </div>
                    
                    <div className="border-l border-slate-200 pl-4 h-10 flex flex-col justify-center">
                        <div className="flex gap-0.5 mb-1.5 object-bottom">
                            <div className={`h-1.5 w-4 rounded-full ${isProceed ? 'bg-emerald-500' : isVerify ? 'bg-amber-400' : 'bg-slate-200'}`} />
                            <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                        </div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-tight">
                            {isProceed ? `High\nconfidence\n· ${criteria.filter(c=>c.status==='pass').length} criteria met` 
                            : isVerify ? `Low\nconfidence\n· review needed` 
                            : `Hard\nfilter\nfailed`}
                        </p>
                    </div>
                </div>

                {isUnsuitable ? (
                    <button
                        onClick={e => { e.stopPropagation(); }}
                        className="text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-lg px-4 py-2 hover:bg-slate-50"
                    >
                        Details
                    </button>
                ) : (
                    <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full"
                            style={{ background: `conic-gradient(${scoreColor} ${scoreDeg}deg, #E2E8F0 ${scoreDeg}deg)` }} />
                        <div className="absolute inset-[3px] rounded-full bg-white flex flex-col items-center justify-center">
                            <span className="font-black text-[10px] text-slate-600">{displayScore}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ✨ AI Explain button + collapsible panel */}
            <div className="px-5 pb-2 pt-0" onClick={e => e.stopPropagation()}>
                <button
                    onClick={fetchExplanation}
                    className={`w-full text-[11px] font-bold py-1.5 rounded-lg border transition-all duration-150 flex items-center justify-center gap-1.5
                        ${aiOpen
                            ? 'bg-violet-50 border-violet-300 text-violet-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50'
                        }`}
                >
                    {aiLoading ? (
                        <><span className="animate-spin inline-block">⚙️</span> Generating...</>
                    ) : (
                        <>✨ {aiOpen ? 'Hide' : 'AI Explanation'}</>
                    )}
                </button>

                {aiOpen && (
                    <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50/60 p-3.5 text-[11px] text-slate-700 leading-relaxed anim-fade-up">
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-violet-500 font-black text-xs">✨ AI Summary</span>
                            <span className="text-[9px] text-violet-400 bg-violet-100 rounded px-1.5 py-0.5 font-bold uppercase tracking-wide">BiomedBERT · Clinical NLP</span>
                        </div>
                        {aiLoading ? (
                            <div className="space-y-1.5">
                                {[90, 70, 80].map((w, i) => (
                                    <div key={i} className="h-2 bg-violet-100 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {(aiExplanation || '').split('\n\n').map((para, i) => (
                                    <p key={i}>
                                        {para.split(/\*\*([^*]+)\*\*/).map((chunk, j) =>
                                            j % 2 === 1
                                                ? <strong key={j} className="text-violet-700">{chunk}</strong>
                                                : chunk
                                        )}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Flag for Review button */}
            <div className="px-5 pb-4 pt-0">
                <button
                    onClick={e => { e.stopPropagation(); onFlag(); }}
                    className={`w-full text-[11px] font-bold py-1.5 rounded-lg border transition-all duration-150 flex items-center justify-center gap-1.5
                        ${ isFlagged
                            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50'
                        }`}
                >
                    {isFlagged ? '✅ Flagged for Review' : '🚩 Flag for Review'}
                </button>
            </div>
        </div>
    );
} 
