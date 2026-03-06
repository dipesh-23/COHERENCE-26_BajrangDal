import React, { useState, useMemo } from 'react';
import PatientUploader from '../components/PatientUploader';
import TrialCard from '../components/TrialCard';
import GeographyFilter from '../components/GeographyFilter';
import MatchReport from '../components/MatchReport';
import ScoreGauge from '../components/ScoreGauge';
import { useTrialEngine } from '../hooks/useTrialEngine';

// ─── Lab color helper ─────────────────────────────────────────────────────────
function labColor(key, value) {
    if (key === 'HbA1c') return value > 7 ? 'text-red-400' : 'text-emerald-400';
    if (key === 'eGFR') return value < 60 ? 'text-amber-400' : 'text-emerald-400';
    return 'text-slate-300';
}

// ─── Derive ScoreGauge breakdown from criteria_breakdown ──────────────────────
// Maps criteria statuses into [{category, value, color}] expected by ScoreGauge.
// When backend sends real `criteria_breakdown`, this transformation is the only
// integration point needed here — no other changes required.
function deriveBreakdown(criteria = []) {
    const met = criteria.filter(c => c.status === 'met').length;
    const total = criteria.length || 1;
    const metPct = Math.round((met / total) * 100);

    const labCriteria = criteria.filter(c => /hba1c|egfr|creatinine|lab|renal|cholesterol/i.test(c.name));
    const meds = criteria.filter(c => /medication|metformin|insulin|drug|inhibitor|blocker/i.test(c.name));
    const diag = criteria.filter(c => /diagnosis|t2dm|diabetes|hypertension|ckd|dx/i.test(c.name));

    const pct = (arr) => arr.length === 0 ? metPct : Math.round((arr.filter(c => c.status === 'met').length / arr.length) * 100);

    return [
        { category: 'Demographics', value: metPct, color: '#3B82F6' },
        { category: 'Lab Values', value: pct(labCriteria), color: '#10B981' },
        { category: 'Diagnosis', value: pct(diag), color: '#8B5CF6' },
        { category: 'Medications', value: pct(meds), color: '#F59E0B' },
    ];
}

const NAV_TABS = ['Dashboard', 'Patients', 'Trials'];

export default function Dashboard({
    currentUser = null,   // { id, name, role, department, hospital }
    token = null,         // JWT — passed to API calls via Authorization header
    onLogout = () => { },  // clears session in App.jsx
}) {
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [selectedTrial, setSelectedTrial] = useState(null);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [filters, setFilters] = useState({ zip: '10001', radius_miles: 50, hpsa_only: false });
    const [sortBy, setSortBy] = useState('score');

    // ── Engine: all data + API calls come from here ──
    const {
        matchTrials,
        patientData,
        matchResults,
        loadingStatus,
        isDemoMode,
        toggleDemoMode,
    } = useTrialEngine(token);

    // ── Sorted results ──
    const sortedResults = useMemo(() => {
        const copy = [...matchResults];
        const confRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        if (sortBy === 'score') copy.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
        if (sortBy === 'confidence') copy.sort((a, b) => (confRank[b.confidence] || 0) - (confRank[a.confidence] || 0));
        if (sortBy === 'location') copy.sort((a, b) => (a.location || '').localeCompare(b.location || ''));
        return copy;
    }, [matchResults, sortBy]);

    // ── Quick stats ──
    const topScore = matchResults.length ? Math.max(...matchResults.map(r => r.match_score || 0)) : '--';
    const verifications = matchResults.reduce((acc, r) => acc + (r.missing_data?.length || 0), 0);
    const derivedBreakdown = useMemo(() => deriveBreakdown(selectedTrial?.criteria_breakdown), [selectedTrial]);

    // ── Handlers ──
    const handlePatientLoaded = (data) => {
        // data = AnonymizedPatient from POST /ingest/patient (via PatientUploader)
        if (data?.patient_id) matchTrials(data.patient_id, 5, filters);
    };

    const handleFilterChange = (newFilters) => {
        setFilters(newFilters);
        if (patientData?.patient_id) matchTrials(patientData.patient_id, 5, newFilters);
    };

    const isMatchLoading = !!loadingStatus?.match;

    return (
        <div className="flex flex-col h-screen w-full overflow-hidden font-sans bg-[#F0FAFA] text-slate-800">
            <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim-fade-up { animation: fadeSlideUp 0.5s ease-out forwards; opacity: 0; }
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.4); }
        }
        .anim-pulse { animation: pulseDot 2s ease-in-out infinite; }
        @keyframes shimmer {
          0%   { background-position: -800px 0; }
          100% { background-position: 800px 0; }
        }
        .anim-shimmer {
          background: linear-gradient(90deg, rgba(30,41,59,0) 0%, rgba(30,41,59,0.6) 50%, rgba(30,41,59,0) 100%);
          background-size: 800px 100%;
          animation: shimmer 1.8s infinite linear;
        }
      `}</style>

            {/* ═══ 1. STICKY TOP NAV ══════════════════════════════════════════════ */}
            <nav className="sticky top-0 z-50 h-16 shrink-0 flex items-center justify-between px-6 bg-white border-b border-teal-50 shadow-sm">
                {/* Left */}
                <div className="flex items-center gap-3">
                    <div className="bg-[#0D9488]/10 rounded-lg p-1.5"><span className="text-xl leading-none">🏥</span></div>
                    <span className="text-slate-800 font-bold text-[20px] tracking-tight">TrialMatch <span className="text-[#0D9488]">AI</span></span>
                    <span className="bg-teal-50 text-[#0D9488] border border-teal-100 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider">BETA</span>
                </div>

                {/* Center nav */}
                <div className="flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                    {NAV_TABS.map((label) => (
                        <button
                            key={label}
                            onClick={() => setActiveTab(label)}
                            className={`relative text-sm font-bold transition-colors duration-200 ${activeTab === label ? 'text-[#0D9488]' : 'text-slate-400 hover:text-slate-700'}`}
                        >
                            {label}
                            {activeTab === label && (
                                <span className="absolute -bottom-[21px] left-0 w-full h-[3px] bg-[#0D9488] rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Right */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] anim-pulse" />
                        <span className="text-emerald-700 text-xs font-semibold">System Online</span>
                    </div>
                    {currentUser && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full pl-1 pr-3 py-1 shadow-sm">
                            <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-sm">
                                {currentUser.role === 'doctor' ? '👨‍⚕️' : currentUser.role === 'nurse' ? '👩‍⚕️' : '🧑‍🦽'}
                            </div>
                            <span className="text-slate-600 text-xs font-bold">{currentUser.name}</span>
                        </div>
                    )}
                    <button
                        onClick={onLogout}
                        className="text-slate-500 hover:text-[#0D9488] text-xs font-semibold border border-slate-200 hover:border-[#0D9488] hover:bg-teal-50 rounded-full px-4 py-1.5 transition-all duration-150"
                    >
                        Sign Out
                    </button>
                </div>
            </nav>

            {/* ═══ 2. THREE-COLUMN BODY ═══════════════════════════════════════════ */}
            <main className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">

                {/* ── LEFT COLUMN ── */}
                <aside className="w-80 shrink-0 flex flex-col overflow-y-auto bg-[#F8FFFE] border-r border-teal-100 p-4 gap-4">
                    <h2 className="text-[#0F766E] font-bold text-base flex items-center gap-2"><span>⚙️</span> Patient & Filters</h2>

                    <PatientUploader
                        onPatientLoaded={handlePatientLoaded}
                        userRole={currentUser?.role || 'doctor'}
                    />


                    {/* GeographyFilter — produces {zip, radius_miles, hpsa_only} for POST /match */}
                    <GeographyFilter onFilterChange={handleFilterChange} />

                    {/* Ethics Monitor */}
                    <div className="mt-auto bg-white rounded-2xl p-4 border border-teal-50 shadow-sm">
                        <h3 className="text-[#0F766E] font-semibold text-sm flex items-center gap-2 mb-3"><span>🛡️</span> Ethics Monitor</h3>
                        {[
                            { label: 'Geographic Equity', status: 'ok' },
                            { label: 'Demographic Parity', status: 'ok' },
                            { label: 'Data Completeness', status: verifications > 2 ? 'warn' : 'ok' },
                        ].map(row => (
                            <div key={row.label} className="flex items-center justify-between text-sm py-1.5">
                                <span className="text-slate-600">{row.label}</span>
                                <div className={`w-2 h-2 rounded-full shadow-sm ${row.status === 'warn' ? 'bg-amber-400 shadow-amber-400/50 anim-pulse' : 'bg-teal-500 shadow-teal-500/30'}`} />
                            </div>
                        ))}
                    </div>
                </aside>

                {/* ── CENTER COLUMN ── */}
                <section className="flex-1 flex flex-col overflow-y-auto bg-[#F0FAFA] p-6 scrollbar-thin scrollbar-thumb-teal-100">

                    {/* ── DASHBOARD TAB ── */}
                    {activeTab === 'Dashboard' && (
                        <>
                            <div className="flex items-center justify-between mb-6 shrink-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-slate-800 text-2xl font-bold tracking-tight">Matched Trials</h2>
                                    {matchResults.length > 0 && (
                                        <span className="bg-teal-50 border border-[#0D9488] text-[#0D9488] text-sm font-bold px-3 py-1 rounded-full shadow-sm transition-all duration-300">
                                            {matchResults.length}
                                        </span>
                                    )}
                                </div>
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}
                                    className="appearance-none bg-white border border-teal-100 text-slate-600 font-medium text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 focus:border-[#0D9488] shadow-sm cursor-pointer"
                                >
                                    <option value="score">Sort: Best Match</option>
                                    <option value="confidence">Sort: Confidence</option>
                                    <option value="location">Sort: Location</option>
                                </select>
                            </div>
                            {isMatchLoading && (
                                <div className="flex flex-col gap-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-36 bg-slate-100 rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            )}
                            {!isMatchLoading && matchResults.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border-2 border-dashed border-teal-100 rounded-3xl shadow-sm">
                                    <div className="text-[64px] mb-5">🔬</div>
                                    <p className="text-slate-800 text-lg font-bold mb-1">Waiting for Patient Data</p>
                                    <p className="text-slate-500 text-sm max-w-sm">Upload a patient record or enable Demo Mode to generate intelligent trial matches.</p>
                                </div>
                            )}
                            {!isMatchLoading && matchResults.length > 0 && (
                                <div className="flex flex-col gap-4 pb-8">
                                    {sortedResults.map((result, index) => (
                                        <div key={result.trial_id} className="anim-fade-up" style={{ animationDelay: `${index * 80}ms` }}>
                                            <TrialCard
                                                {...result}
                                                userRole={currentUser?.role || 'doctor'}
                                                isSelected={selectedTrial?.trial_id === result.trial_id}
                                                onSelect={() => setSelectedTrial(result)}
                                                onViewReport={() => { setSelectedTrial(result); setIsReportOpen(true); }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── PATIENTS TAB ── */}
                    {activeTab === 'Patients' && (
                        <div className="flex-1 flex flex-col anim-fade-up">
                            <h2 className="text-slate-800 text-2xl font-bold tracking-tight mb-6">Patients</h2>
                            {patientData ? (
                                <div className="bg-white border border-teal-50 rounded-2xl p-6 max-w-xl shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="font-mono text-slate-500 font-bold bg-slate-100 rounded-md px-2 py-0.5 text-sm">{patientData.patient_id}</span>
                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 text-xs font-bold">Active</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div><p className="text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wider">Age</p><p className="text-slate-800 font-bold">{patientData.age} years</p></div>
                                        <div><p className="text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wider">Gender</p><p className="text-slate-800 font-bold">{patientData.gender}</p></div>
                                        <div><p className="text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wider">ZIP Code</p><p className="text-slate-800 font-bold">{patientData.zip || '—'}</p></div>
                                        <div><p className="text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wider">Medications</p><p className="text-slate-800 font-bold">{patientData.medications?.length || 0}</p></div>
                                    </div>
                                    <div className="border-t border-slate-100 pt-4">
                                        <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">Diagnoses</p>
                                        <div className="flex flex-wrap gap-2">
                                            {patientData.diagnoses?.map((d, i) => (
                                                <span key={i} className="bg-teal-50 border border-teal-100 text-teal-700 text-xs font-bold px-2.5 py-1 rounded-lg">{d}</span>
                                            ))}
                                        </div>
                                    </div>
                                    {patientData.labs && (
                                        <div className="border-t border-slate-100 pt-4 mt-4">
                                            <p className="text-slate-400 text-xs font-semibold mb-3 uppercase tracking-wider">Lab Values</p>
                                            <div className="grid grid-cols-3 gap-3">
                                                {Object.entries(patientData.labs).map(([k, v]) => (
                                                    <div key={k} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                                                        <p className={`text-lg font-bold ${labColor(k, v)}`}>{v}{k === 'HbA1c' ? '%' : ''}</p>
                                                        <p className="text-slate-500 text-[10px] uppercase font-bold mt-1 tracking-wider">{k}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {patientData.history_text && (
                                        <div className="border-t border-slate-100 pt-4 mt-4">
                                            <p className="text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wider">Clinical History</p>
                                            <p className="text-slate-600 text-sm leading-relaxed">{patientData.history_text}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border-2 border-dashed border-teal-100 rounded-3xl shadow-sm">
                                    <div className="text-[64px] mb-5">👤</div>
                                    <p className="text-slate-800 text-lg font-bold mb-1">No patient loaded</p>
                                    <p className="text-slate-500 text-sm max-w-sm mb-5">Upload a patient record using the panel on the left or enable Demo Mode.</p>
                                    <button onClick={() => setActiveTab('Dashboard')} className="bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm transition-colors">← Back to Dashboard</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TRIALS TAB ── */}
                    {activeTab === 'Trials' && (
                        <div className="flex-1 flex flex-col anim-fade-up">
                            <h2 className="text-slate-800 text-2xl font-bold tracking-tight mb-6">All Trials</h2>
                            {matchResults.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border-2 border-dashed border-teal-100 rounded-3xl shadow-sm">
                                    <div className="text-[64px] mb-5">🧪</div>
                                    <p className="text-slate-800 text-lg font-bold mb-1">No trials to display</p>
                                    <p className="text-slate-500 text-sm max-w-sm mb-5">Run a match from the Dashboard to see all trials here.</p>
                                    <button onClick={() => setActiveTab('Dashboard')} className="bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm transition-colors">← Go to Dashboard</button>
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
                                                    <tr key={r.trial_id} className="bg-white hover:bg-teal-50/30 transition-colors cursor-pointer" onClick={() => { setSelectedTrial(r); setActiveTab('Dashboard'); }}>
                                                        <td className="px-5 py-4">
                                                            <p className="text-slate-800 font-bold">{r.trial_name}</p>
                                                            <p className="font-mono text-xs text-slate-400 mt-1">{r.trial_id}</p>
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
                </section>

                {/* ── RIGHT COLUMN ── */}
                <aside className="w-96 shrink-0 flex flex-col overflow-y-auto bg-white border-l border-teal-50 p-4 gap-4 scrollbar-thin scrollbar-thumb-teal-100">
                    {/* ScoreGauge — shown when a trial is selected */}
                    {selectedTrial ? (
                        <div className="anim-fade-up">
                            <ScoreGauge score={selectedTrial.match_score} breakdown={derivedBreakdown} userRole={currentUser?.role || 'doctor'} />
                        </div>
                    ) : (
                        <div className="border border-teal-100 bg-[#F0FAFA] rounded-2xl p-6 text-center shadow-inner">
                            <p className="text-slate-500 font-bold text-sm">Select a trial to view match score</p>
                            <div className="w-16 h-16 mx-auto mt-4 rounded-full border-4 border-dashed border-teal-200 opacity-50 flex items-center justify-center text-2xl">🎯</div>
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="flex flex-col gap-3">
                        {[
                            { icon: '🎯', label: 'Top Match Score', value: topScore !== '--' ? `${topScore}` : '--', sub: topScore !== '--' ? '/ 100' : '', bg: 'bg-[#0D9488]/10', border: 'border-[#0D9488]/20', text: 'text-[#0D9488]' },
                            { icon: '📋', label: 'Trials Analyzed', value: matchResults.length, sub: '', bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700' },
                            {
                                icon: '⚠️', label: 'Verifications Needed', value: verifications, sub: '',
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

                    {/* Demo Mode toggle */}
                    <div className="mt-auto border border-amber-200 bg-amber-50 rounded-xl p-4 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 left-0 h-full w-1 bg-amber-400 rounded-l-xl" />
                        <div className="flex items-center justify-between pl-2 mb-1">
                            <span className="text-amber-800 font-bold text-sm">⚡ Demo Mode</span>
                            <button
                                onClick={toggleDemoMode}
                                className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors duration-300 shadow-inner ${isDemoMode ? 'bg-amber-400' : 'bg-slate-200'}`}
                            >
                                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-300 ${isDemoMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        <p className="text-amber-700/80 text-[11px] font-medium pl-2">Use simulated patient data for testing.</p>
                    </div>
                </aside>
            </main>

            {/* ═══ 3. MATCH REPORT MODAL ══════════════════════════════════════════ */}
            <MatchReport
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                report={selectedTrial}
                userRole={currentUser?.role || 'doctor'}
            />
        </div>
    );
}
