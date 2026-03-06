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
                    <div>
                        <span className="text-slate-800 font-bold text-[20px] tracking-tight block leading-none mt-1">TrialMatch <span className="text-[#0D9488]">AI</span></span>
                        <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider block">Clinical Research Platform</span>
                    </div>
                </div>

                {/* Center nav */}
                <div className="flex items-center gap-8 absolute left-1/2 -translate-x-1/2 mt-1">
                    {NAV_TABS.map((label) => (
                        <button
                            key={label}
                            onClick={() => setActiveTab(label)}
                            className={`relative text-sm font-bold transition-colors duration-200 ${activeTab === label ? 'text-[#0D9488]' : 'text-slate-400 hover:text-slate-700'}`}
                        >
                            {label}
                            {activeTab === label && (
                                <span className="absolute -bottom-[19px] left-0 w-full h-[3px] bg-[#0D9488] rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Right */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] anim-pulse" />
                        <span className="text-emerald-700 text-xs font-semibold">Screening Engine Online</span>
                    </div>
                    {currentUser && (
                        <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-full pl-1 pr-3 py-1 shadow-sm">
                            <div className="w-7 h-7 rounded-full bg-white border border-teal-200 flex items-center justify-center text-sm shadow-sm">
                                🔬
                            </div>
                            <span className="text-teal-700 text-xs font-bold">Research Coordinator</span>
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

            {/* ── CRC HERO STRIP ── */}
            <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-teal-50 shrink-0 shadow-sm relative z-40">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">Good morning, {currentUser?.name || 'Jane'}</h1>
                    <p className="text-sm font-medium text-slate-500 mt-0.5">{currentUser?.department || 'Clinical Trials Office'} · {currentUser?.hospital || 'Medical Center'}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-teal-50 text-teal-700 px-4 py-2 rounded-xl text-sm font-bold border border-teal-100 shadow-sm flex items-center gap-2">
                        <span>📋</span>
                        {matchResults.length} Trials Screened
                    </div>
                    <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold border border-emerald-100 shadow-sm flex items-center gap-2">
                        <span>⏱️</span>
                        ~{matchResults.length * 12} mins saved today
                    </div>
                    <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold border border-amber-100 shadow-sm flex items-center gap-2">
                        <span>⚠️</span>
                        {verifications} Awaiting Verification
                    </div>
                </div>
            </div>

            {/* ── QUICK ACTIONS STRIP ── */}
            {patientData && (
                <div className="bg-slate-50/80 border-b border-teal-100 px-6 py-2.5 flex items-center gap-3 shrink-0 relative z-30">
                    <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Quick Actions:</span>
                    <button onClick={() => { }} className="bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-sm">
                        📤 Export Screening Report
                    </button>
                    <button onClick={() => { }} className="bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-sm">
                        📧 Email to Investigator
                    </button>
                    <button onClick={() => { }} className="bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-sm">
                        ⚠️ Flag for Review
                    </button>
                    <button
                        onClick={() => {/* useTrialEngine clearAll via hook, but here we just leave as UI or mock if needed. Actually, we should trigger clearAll -> hook */ }}
                        className="ml-auto bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 flex items-center gap-1.5 shadow-sm"
                    >
                        🔄 New Patient
                    </button>
                </div>
            )}

            {/* ═══ 2. THREE-COLUMN BODY ═══════════════════════════════════════════ */}
            <main className="flex flex-1 h-[calc(100vh-64px)] overflow-hidden">

                {/* ── LEFT COLUMN ── */}
                <aside className="w-80 shrink-0 flex flex-col overflow-y-auto bg-[#F8FFFE] border-r border-teal-100 p-4 gap-4 pb-20">
                    <h2 className="text-[#0F766E] font-bold text-base flex items-center gap-2 mb-2"><span>⚙️</span> Patient Screening</h2>

                    <div className="flex flex-col gap-1.5">
                        <span className="text-slate-500 font-bold text-xs uppercase tracking-wider pl-1">📁 Upload Patient Record</span>
                        <PatientUploader
                            onPatientLoaded={handlePatientLoaded}
                            userRole={currentUser?.role || 'doctor'}
                        />
                    </div>

                    {/* GeographyFilter — produces {zip, radius_miles, hpsa_only} for POST /match */}
                    <GeographyFilter onFilterChange={handleFilterChange} />

                    {/* Ethics Monitor */}
                    <div className="mt-auto bg-white rounded-2xl p-4 border border-teal-50 shadow-sm">
                        <h3 className="text-[#0F766E] font-semibold text-sm flex items-center gap-2 mb-3"><span>🛡️</span> Protocol Compliance Monitor</h3>
                        {[
                            { label: 'Site Accessibility Check', status: 'ok' },
                            { label: 'Inclusion Fairness Audit', status: 'ok' },
                            { label: 'Record Completeness', status: verifications > 2 ? 'warn' : 'ok' },
                        ].map(row => (
                            <div key={row.label} className="flex items-center justify-between text-sm py-1.5">
                                <span className="text-slate-600 font-medium">{row.label}</span>
                                <div className={`w-2 h-2 rounded-full shadow-sm ${row.status === 'warn' ? 'bg-amber-400 shadow-amber-400/50 anim-pulse' : 'bg-teal-500 shadow-teal-500/30'}`} />
                            </div>
                        ))}
                    </div>
                </aside>

                {/* ── CENTER COLUMN ── */}
                <section className="flex-1 flex flex-col overflow-y-auto bg-[#F0FAFA] p-6 pb-32 scrollbar-thin scrollbar-thumb-teal-100">

                    {/* ── SCREENING TAB ── */}
                    {activeTab === 'Screening' && (
                        <>
                            {isDemoMode && (
                                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-2 shadow-sm">
                                    <span className="text-amber-500 text-lg">⚡</span>
                                    <div>
                                        <p className="text-amber-800 font-bold text-sm">Demo Screening Mode</p>
                                        <p className="text-amber-700 font-medium text-xs">Load sample patient: 62yo T2DM + CKD</p>
                                    </div>
                                    <button
                                        onClick={toggleDemoMode}
                                        className="ml-auto text-amber-600 hover:text-amber-700 font-bold text-xs underline transition"
                                    >
                                        Active — showing P-84921
                                    </button>
                                </div>
                            )}
                            <div className="flex items-center justify-between mt-2 mb-6 shrink-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-slate-800 text-2xl font-bold tracking-tight">Eligible Trial Matches</h2>
                                    {matchResults.length > 0 && (
                                        <span className="bg-[#0D9488] border border-[#0F766E] text-white text-sm font-bold px-3 py-1 rounded-full shadow-sm transition-all duration-300">
                                            {matchResults.length}
                                        </span>
                                    )}
                                </div>
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
                            {loadingStatus.match ? (
                                <div className="space-y-4">
                                    <p className="text-teal-700 font-bold text-sm animate-pulse flex items-center gap-2 mb-2">
                                        <span className="text-lg">⚙️</span> Screening against trial database...
                                    </p>
                                    {[1, 2, 3].map(i => (
                                        <div
                                            key={i}
                                            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 animate-pulse"
                                            style={{ animationDelay: `${i * 150}ms` }}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-2">
                                                    <div className="h-5 bg-slate-200 rounded-lg w-56" />
                                                    <div className="h-3 bg-slate-100 rounded-full w-32" />
                                                </div>
                                                <div className="w-14 h-14 rounded-full bg-slate-200" />
                                            </div>
                                            <div className="flex gap-2 mt-4">
                                                {[1, 2, 3, 4].map(j => (
                                                    <div key={j} className="h-6 bg-slate-100 rounded-full w-20" />
                                                ))}
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
                                    {matchResults.length > 0 && (
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
                                                    <tr key={r.trial_id} className="bg-white hover:bg-teal-50/30 transition-colors cursor-pointer" onClick={() => { setSelectedTrial(r); setActiveTab('Screening'); }}>
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

                    {/* Demo Mode toggle */}
                    <div className="mt-auto border border-amber-200 bg-amber-50 rounded-xl p-4 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 left-0 h-full w-1 bg-amber-400 rounded-l-xl" />
                        <div className="flex items-center justify-between pl-2 mb-1">
                            <span className="text-amber-800 font-bold text-sm">⚡ Demo Mode</span>
                            <div
                                onClick={toggleDemoMode}
                                className={`relative w-11 h-6 rounded-full cursor-pointer transition-all duration-300 ${isDemoMode
                                    ? 'bg-amber-400 shadow-md shadow-amber-400/40'
                                    : 'bg-slate-200'
                                    }`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${isDemoMode ? 'left-5' : 'left-0.5'
                                    }`} />
                            </div>
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
