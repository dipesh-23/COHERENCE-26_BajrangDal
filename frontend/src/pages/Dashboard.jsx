import React, { useState, useEffect, useMemo } from 'react';
import PatientUploader from '../components/PatientUploader';
import TrialCard from '../components/TrialCard';
import GeographyFilter from '../components/GeographyFilter';
import MatchReport from '../components/MatchReport';
import ScoreGauge from '../components/ScoreGauge';
import { useTrialEngine } from '../hooks/useTrialEngine';

export default function Dashboard() {
    // State from User Request
    const [patientData, setPatientData] = useState(null);
    const [matchResults, setMatchResults] = useState([]);
    const [selectedTrial, setSelectedTrial] = useState(null);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [filters, setFilters] = useState({ zip: '', radius_miles: 50, hpsa_only: false });
    const [sortBy, setSortBy] = useState('score');
    const [isDemoMode, setIsDemoMode] = useState(false);

    // Local UI state
    const [isDarkMode, setIsDarkMode] = useState(true);

    const { matchTrials, isLoading } = useTrialEngine();

    // Function to load matches
    const loadMatches = async (patientId, currentFilters) => {
        const results = await matchTrials(patientId, 5, currentFilters);
        setMatchResults(results || []);
        // Auto-select top match if available and none selected
        if (results && results.length > 0 && !selectedTrial) {
            setSelectedTrial(results[0]);
        }
    };

    // Handlers
    const handlePatientLoaded = (data) => {
        setPatientData(data);
        if (data?.patient_id) {
            loadMatches(data.patient_id, filters);
        }
    };

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
        if (patientData?.patient_id) {
            loadMatches(patientData.patient_id, newFilters);
        }
    };

    const handleSortChange = (e) => {
        setSortBy(e.target.value);
    };

    // Derived Data
    const sortedResults = useMemo(() => {
        const results = [...matchResults];
        if (sortBy === 'score') {
            return results.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        } else if (sortBy === 'confidence') {
            const confMap = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            return results.sort((a, b) => (confMap[b.confidence] || 0) - (confMap[a.confidence] || 0));
        } else if (sortBy === 'location') {
            return results.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
        }
        return results;
    }, [matchResults, sortBy]);

    const topMatchScore = useMemo(() => {
        if (!matchResults.length) return '--';
        return Math.max(...matchResults.map(r => r.match_score || 0));
    }, [matchResults]);

    const missingDataCount = useMemo(() => {
        return matchResults.reduce((acc, r) => acc + (r.missing_data?.length || 0), 0);
    }, [matchResults]);

    // Transform criteria_breakdown for ScoreGauge
    const derivedBreakdown = useMemo(() => {
        if (!selectedTrial?.criteria_breakdown) return [];
        return selectedTrial.criteria_breakdown.map(c => ({
            category: c.name,
            value: c.detail,
            color: c.status === 'met' ? 'emerald' : c.status === 'not_met' ? 'coral' : 'amber'
        }));
    }, [selectedTrial]);

    return (
        <div className={`flex flex-col h-screen w-full overflow-hidden font-sans transition-colors duration-200 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900'}`}>
            <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-slide-up {
          animation: fadeSlideUp 0.6s ease-out forwards;
          opacity: 0;
        }
        @keyframes pulseSlow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.4); }
        }
        .animate-pulse-slow {
          animation: pulseSlow 2s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        .animate-shimmer {
          background: linear-gradient(90deg, rgba(30,41,59,0) 0%, rgba(30,41,59,0.5) 50%, rgba(30,41,59,0) 100%);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite linear;
        }
      `}</style>

            {/* 1. STICKY TOP NAV */}
            <nav className="sticky top-0 z-50 h-16 w-full shrink-0 flex items-center justify-between px-6 bg-slate-900 border-b border-slate-700">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-500 rounded-lg p-1.5 flex items-center justify-center">
                        <span className="text-xl leading-none">🏥</span>
                    </div>
                    <h1 className="text-white font-bold text-[20px] tracking-tight">TrialMatch AI</h1>
                    <span className="bg-blue-500/20 text-blue-500 border border-blue-500/30 rounded-full px-2 py-0.5 text-xs font-semibold tracking-wider ml-1">
                        BETA
                    </span>
                </div>

                <div className="flex items-center space-x-8 absolute left-1/2 transform -translate-x-1/2">
                    <button className="relative text-blue-500 font-medium transition-colors duration-200">
                        Dashboard
                        <span className="absolute -bottom-[21px] left-0 w-full h-[2px] bg-blue-500"></span>
                    </button>
                    <button className="text-slate-400 font-medium transition-colors duration-200 hover:text-white">
                        Patients
                    </button>
                    <button className="text-slate-400 font-medium transition-colors duration-200 hover:text-white">
                        Trials
                    </button>
                </div>

                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2 bg-slate-800/50 rounded-full px-3 py-1 border border-slate-700/50">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse-slow"></div>
                        <span className="text-emerald-500 text-xs font-medium tracking-wide">System Online</span>
                    </div>
                    <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-all duration-300"
                        style={{ transform: isDarkMode ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        aria-label="Toggle dark mode"
                    >
                        {isDarkMode ? '☀️' : '🌙'}
                    </button>
                </div>
            </nav>

            {/* 2. THREE-COLUMN BODY */}
            <main className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">

                {/* LEFT COLUMN */}
                <aside className="w-80 flex flex-col shrink-0 overflow-y-auto bg-slate-900 border-r border-slate-700 p-4 gap-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <h2 className="text-white font-bold text-lg flex items-center">
                        <span className="mr-2">⚙️</span> Patient & Filters
                    </h2>

                    <PatientUploader
                        onPatientLoaded={handlePatientLoaded}
                        isDemoMode={isDemoMode}
                    />

                    {patientData && (
                        <div className="bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-700">
                            <div className="font-mono text-sm text-blue-400 mb-2">{patientData.patient_id}</div>
                            <div className="flex space-x-2 mb-3">
                                <span className="bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded-md">{patientData.age} yrs</span>
                                <span className="bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded-md">{patientData.gender}</span>
                                <span className="bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded-md">{patientData.diagnoses?.length || 0} Dx</span>
                            </div>
                            {patientData.labs && (
                                <div className="pt-2 border-t border-slate-700 flex justify-between text-xs">
                                    <div className="flex flex-col">
                                        <span className="text-slate-400">HbA1c</span>
                                        <span className={patientData.labs.HbA1c > 7 ? 'text-amber-400' : 'text-emerald-400'}>{patientData.labs.HbA1c}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-slate-400">eGFR</span>
                                        <span className={patientData.labs.eGFR < 60 ? 'text-amber-400' : 'text-emerald-400'}>{patientData.labs.eGFR}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-slate-400">Creat</span>
                                        <span className="text-slate-200">{patientData.labs.Creatinine}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <GeographyFilter onFilterChange={handleFilterChange} />

                    {/* Ethics Monitor bottom panel */}
                    <div className="mt-auto bg-slate-800 rounded-2xl p-4 border border-slate-700">
                        <h3 className="text-white font-semibold mb-3 flex items-center text-sm tracking-wide">
                            <span className="mr-2">🛡️</span> Ethics Monitor
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-300">Geographic Equity</span>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-300">Demographic Parity</span>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-300">Data Completeness</span>
                                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)] animate-pulse-slow"></div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* CENTER COLUMN */}
                <section className="flex-1 flex flex-col overflow-y-auto bg-slate-950 p-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    <div className="flex items-center justify-between mb-6 shrink-0">
                        <div className="flex items-center space-x-3">
                            <h2 className="text-white text-2xl font-bold tracking-tight">Matched Trials</h2>
                            {matchResults.length > 0 && (
                                <span className="bg-blue-500 text-white font-semibold text-sm px-3 py-1 rounded-full transition-all duration-300">
                                    {matchResults.length}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={handleSortChange}
                                className="appearance-none bg-slate-900 border border-slate-700 text-slate-300 text-sm rounded-lg pl-4 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                            >
                                <option value="score">Sort by: Best Match</option>
                                <option value="confidence">Sort by: Confidence</option>
                                <option value="location">Sort by: Location</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <span className="text-slate-400 text-xs">▼</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                        {isLoading ? (
                            <div className="flex flex-col gap-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-40 bg-slate-900 rounded-xl border border-slate-800 animate-pulse relative overflow-hidden">
                                        <div className="absolute inset-0 animate-shimmer mix-blend-overlay"></div>
                                    </div>
                                ))}
                            </div>
                        ) : matchResults.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-800 rounded-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-slate-900/40"></div>
                                <div className="absolute inset-0 animate-shimmer pointer-events-none mix-blend-overlay"></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="text-[64px] mb-6 drop-shadow-lg">🔬</div>
                                    <h3 className="text-slate-300 text-xl font-medium mb-2">Upload a patient record to begin matching</h3>
                                    <p className="text-slate-500 max-w-md">Results will appear here based on biomarker profiles, geographical constraints, and eligibility criteria.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 pb-8">
                                {sortedResults.map((result, index) => (
                                    <div
                                        key={result.trial_id || index}
                                        className="animate-fade-slide-up"
                                        style={{ animationDelay: `${index * 80}ms` }}
                                    >
                                        <TrialCard
                                            {...result}
                                            isSelected={selectedTrial?.trial_id === result.trial_id}
                                            onSelect={() => setSelectedTrial(result)}
                                            onViewReport={() => {
                                                setSelectedTrial(result);
                                                setIsReportOpen(true);
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* RIGHT COLUMN */}
                <aside className="w-96 flex flex-col shrink-0 overflow-y-auto bg-slate-900 border-l border-slate-700 p-4 gap-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {selectedTrial ? (
                        <div className="animate-fade-slide-up">
                            <ScoreGauge
                                score={selectedTrial.match_score}
                                breakdown={derivedBreakdown}
                            />
                        </div>
                    ) : (
                        <div className="border border-slate-700/50 bg-slate-800/30 rounded-xl p-6 text-center">
                            <h3 className="text-slate-400 text-sm font-medium">Select a trial to view match score</h3>
                        </div>
                    )}

                    <div className="flex-1 flex flex-col gap-4">
                        {/* Quick Stats */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center shadow-sm">
                            <div className="bg-emerald-500/10 text-emerald-500 w-10 h-10 rounded-lg flex items-center justify-center text-lg mr-4 border border-emerald-500/20 shrink-0">
                                🎯
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-0.5">Top Match Score</p>
                                <div className="text-white text-xl font-bold flex items-baseline">
                                    {topMatchScore} <span className="text-slate-500 text-xs ml-1 font-normal">{topMatchScore !== '--' && '/ 100'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center shadow-sm">
                            <div className="bg-blue-500/10 text-blue-500 w-10 h-10 rounded-lg flex items-center justify-center text-lg mr-4 border border-blue-500/20 shrink-0">
                                📋
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-0.5">Trials Analyzed</p>
                                <p className="text-white text-xl font-bold">{matchResults.length}</p>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center shadow-sm">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg mr-4 border shrink-0 ${missingDataCount > 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                ⚠️
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-0.5">Verifications Needed</p>
                                <p className="text-white text-xl font-bold">{missingDataCount}</p>
                            </div>
                        </div>

                        {/* Demo Mode Toggle */}
                        <div className="mt-auto border border-amber-500/30 bg-amber-500/5 rounded-xl p-4 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 bg-amber-500 h-full"></div>
                            <div className="flex items-center justify-between mb-1 pl-2">
                                <div className="flex items-center text-amber-500 font-semibold space-x-2 text-sm">
                                    <span>⚡ Demo Mode</span>
                                </div>
                                <button
                                    onClick={() => setIsDemoMode(!isDemoMode)}
                                    className={`w-10 h-5 rounded-full flex items-center transition-colors duration-300 p-1 focus:outline-none ${isDemoMode ? 'bg-amber-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-300 ${isDemoMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                            <p className="text-slate-400 text-xs pl-2">Use simulated patient data for testing.</p>
                        </div>
                    </div>
                </aside>

            </main>

            {/* 3. MODAL: MATCH REPORT */}
            <MatchReport
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                report={selectedTrial}
            />
        </div>
    );
}
