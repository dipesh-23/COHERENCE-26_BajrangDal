import React, { useState, useEffect } from 'react';
import useTrialEngine from '../hooks/useTrialEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getConfidenceColor(conf) {
    if (conf === 'HIGH') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (conf === 'MEDIUM') return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-slate-700 bg-slate-50 border-slate-200';
}

function getRecPillStyles(rec) {
    if (rec === 'Proceed') return 'bg-gradient-to-r from-[#0D9488] to-[#0F766E] text-white';
    if (rec === 'Verify') return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white';
    return 'bg-gradient-to-r from-red-500 to-red-600 text-white';
}

// ─── Skeletons ────────────────────────────────────────────────────────────────
const SkeletonSection = ({ className = '' }) => (
    <div className={`bg-slate-100 animate-pulse rounded-2xl ${className}`} />
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function TrialDetail({
    report = null,
    patientData = null,
    userRole = 'doctor',
    onBack = () => { },
    onFeedback = () => { },
    onVerifyField = () => { }
}) {
    const isDoctor = userRole === 'doctor';
    const isNurse = userRole === 'nurse';
    const isPatient = userRole === 'patient';
    const isCrc = userRole === 'crc';
    const isClinical = isDoctor || isNurse || isCrc;

    // Fade-in effect when report arrives
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        if (report) {
            const t = setTimeout(() => setMounted(true), 50);
            return () => clearTimeout(t);
        } else {
            setMounted(false);
        }
    }, [report]);

    // What-If Simulator state (Doctor only)
    const [whatIfValues, setWhatIfValues] = useState({});
    const [simError, setSimError] = useState(null);
    const [simLoading, setSimLoading] = useState(false);
    const [simDelta, setSimDelta] = useState(null);

    const { matchTrials } = useTrialEngine();

    // Initialize what-if values from numeric criteria
    useEffect(() => {
        if (report && isDoctor) {
            const nums = (report.criteria_breakdown || []).filter(c =>
                /\d/.test(c.detail || '') || c.name.includes('eGFR') || c.name.includes('HbA1c')
            );
            const initial = {};
            nums.forEach(c => {
                const match = (c.detail || '').match(/(\d+(?:\.\d+)?)/);
                if (match) initial[c.name] = match[1];
            });
            setWhatIfValues(initial);
        }
    }, [report, isDoctor]);

    const handleSimulate = async () => {
        setSimLoading(true);
        setSimError(null);
        setSimDelta(null);
        setTimeout(() => {
            setSimError('⚠️ Simulator requires active backend');
            setSimLoading(false);
        }, 800);
    };

    const [feedbackSent, setFeedbackSent] = useState(false);

    // ══════════════════════════════════════════════════════════════════════════
    // SKELETON VIEW (when report is null)
    // ══════════════════════════════════════════════════════════════════════════
    if (!report) {
        return (
            <div className="min-h-screen bg-[#F0FAFA] flex flex-col font-sans">
                {/* Sticky Top Bar Skeleton */}
                <div className="h-14 bg-white border-b border-teal-50 shadow-sm px-6 flex items-center justify-between sticky top-0 z-10 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <SkeletonSection className="w-16 h-5" />
                        <SkeletonSection className="w-48 h-5" />
                    </div>
                    <div className="flex gap-3">
                        <SkeletonSection className="w-24 h-8 !rounded-full" />
                        <SkeletonSection className="w-32 h-8 !rounded-full" />
                    </div>
                </div>

                {/* Body Skeleton */}
                <div className="flex gap-5 p-6 pb-12 transition-all duration-300">
                    {/* Left Sidebar */}
                    <div className="w-72 shrink-0 flex flex-col gap-4 sticky top-14 self-start">
                        <SkeletonSection className="h-48" />
                        <SkeletonSection className="h-40" />
                        <SkeletonSection className="h-56" />
                    </div>
                    {/* Main Content */}
                    <div className="flex-1 flex flex-col gap-4">
                        <SkeletonSection className="h-32" />
                        <SkeletonSection className="h-80" />
                        <SkeletonSection className="h-40" />
                        {isDoctor && <SkeletonSection className="h-48" />}
                        <SkeletonSection className="h-32" />
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REAL CONTENT VIEW (Fade-in 300ms)
    // ══════════════════════════════════════════════════════════════════════════
    const confColor = getConfidenceColor(report.confidence);
    const criteria = report.criteria_breakdown || [];
    const missing = report.missing_data || [];
    const exclusions = report.exclusion_flags || [];

    // Calculate score circle
    const score = report.match_score || 0;
    const strokeCircumference = 2 * Math.PI * 46; // r=46
    const strokeDashoffset = strokeCircumference - (score / 100) * strokeCircumference;

    return (
        <div className={`min-h-screen bg-[#F0FAFA] flex flex-col font-sans transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}>

            {/* ── 1. STICKY TOP BAR ── */}
            <div className="h-14 bg-white border-b border-teal-50 shadow-sm px-6 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="text-[#0D9488] hover:text-[#0F766E] font-medium flex items-center gap-2 transition-colors duration-200"
                    >
                        ← Back to Screening Results
                    </button>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-600 font-medium truncate max-w-[40ch]" title={report.trial_name}>
                        Screening Dashboard / {report.trial_name}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Recommendation Pill */}
                    <div className={`px-4 py-1 rounded-full text-sm font-bold shadow-sm ${getRecPillStyles(report.recommendation)}`}>
                        {report.recommendation || 'Unknown'}
                    </div>

                    {/* Role Action Button */}
                    {isDoctor && (
                        <button className="px-4 py-1.5 rounded-full bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold shadow-sm transition-colors flex items-center gap-1.5">
                            ✅ Approve Match
                        </button>
                    )}
                    {isCrc && (
                        <>
                            <button className="px-4 py-1.5 rounded-full border border-teal-200 text-teal-700 hover:bg-teal-50 text-sm font-bold transition-colors flex items-center gap-1.5">
                                📧 Email to PI
                            </button>
                            <button className="px-4 py-1.5 rounded-full border border-[#0D9488] text-[#0D9488] hover:bg-teal-50 text-sm font-bold transition-colors flex items-center gap-1.5">
                                📤 Export Screening Report
                            </button>
                        </>
                    )}
                    {isNurse && (
                        <button className="px-4 py-1.5 rounded-full border border-amber-500 text-amber-600 hover:bg-amber-50 text-sm font-bold transition-colors">
                            🔔 Flag
                        </button>
                    )}
                    {isPatient && (
                        <button className="px-4 py-1.5 rounded-full bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold transition-colors shadow-sm">
                            📞 Ask My Doctor
                        </button>
                    )}
                </div>
            </div>

            {/* ── 2. TWO-COLUMN BODY ── */}
            <div className="flex gap-5 p-6 pb-12">

                {/* ── LEFT SIDEBAR (Sticky) ── */}
                <aside className="w-72 shrink-0 flex flex-col gap-4 sticky top-20 self-start">

                    {/* Score Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-6 flex flex-col items-center gap-3">
                        {isClinical ? (
                            <>
                                <div className="relative w-[120px] h-[120px] flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="46" fill="none" stroke="#CCFBF1" strokeWidth="8" />
                                        <circle
                                            cx="50" cy="50" r="46" fill="none" stroke="#0D9488" strokeWidth="8"
                                            strokeDasharray={strokeCircumference}
                                            strokeDashoffset={strokeDashoffset}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-out"
                                        />
                                    </svg>
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-3xl font-bold text-slate-800">{score}</span>
                                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Score</span>
                                    </div>
                                </div>
                                <div className={`px-3 py-1 text-xs font-bold border rounded-full ${confColor}`}>
                                    {report.confidence} CONFIDENCE
                                </div>
                                {isCrc && (
                                    <div className={`w-full rounded-xl px-3 py-2.5 text-center mt-2 ${report?.recommendation === 'Proceed'
                                        ? 'bg-teal-50 border border-teal-200'
                                        : report?.recommendation === 'Verify First'
                                            ? 'bg-amber-50 border border-amber-200'
                                            : 'bg-red-50 border border-red-200'
                                        }`}>
                                        <p className={`font-bold text-sm ${report?.recommendation === 'Proceed' ? 'text-teal-700'
                                            : report?.recommendation === 'Verify First' ? 'text-amber-700'
                                                : 'text-red-700'
                                            }`}>
                                            {report?.recommendation === 'Proceed' ? '✅ Eligible for Screening'
                                                : report?.recommendation === 'Verify First' ? '🔍 Pending CRC Verification'
                                                    : '🚫 Protocol Exclusion Active'}
                                        </p>
                                        <p className="text-slate-400 text-[10px] mt-0.5">CRC Screening Verdict</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            // Patient friendly score
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-100 to-teal-50 border-4 border-teal-200 flex items-center justify-center shadow-inner">
                                    <span className="text-3xl">⭐</span>
                                </div>
                                <span className="text-xl font-bold text-[#0D9488]">Great Match!</span>
                            </div>
                        )}
                        <div className="text-center mt-1">
                            <span className="text-xs text-slate-400 font-medium">Recommendation</span>
                            <p className="text-sm font-bold text-slate-800">{report.recommendation}</p>
                        </div>
                    </div>

                    {/* Trial Info Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-4 space-y-3">
                        {[
                            { icon: '🏥', label: 'Sponsor / IRB', val: report.sponsor },
                            { icon: '📈', label: 'Trial Phase', val: report.phase },
                            { icon: '📍', label: 'Trial Site', val: report.location },
                        ].map((row, i) => (
                            <div key={i} className="flex flex-col">
                                <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
                                    <span className="text-sm">{row.icon}</span> {row.label}
                                </span>
                                <span className="text-slate-700 text-sm font-medium pl-6">{row.val || '--'}</span>
                            </div>
                        ))}
                        {report?.distance_string && (
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-50 mt-1">
                                <span className="text-slate-400 text-xs w-20 flex-shrink-0 pl-6">Distance</span>
                                <span className="text-teal-600 text-sm font-semibold bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5 text-[11px]">
                                    📍 {report.distance_string}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* HPSA Left Card (If flagged) */}
                    {report.hpsa_flagged && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[100%] group-hover:animate-[shimmer_1.5s_infinite]" />
                            <p className="text-amber-700 font-bold text-sm flex items-center gap-2 mb-1">
                                ⭐ Priority Area
                            </p>
                            <p className="text-amber-600 text-xs leading-relaxed">
                                This trial focuses on High Priority Shortage Areas.
                            </p>
                        </div>
                    )}

                    {/* Patient Context Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-4">
                        {isClinical ? (
                            <>
                                <p className="text-[#0D9488] font-bold text-sm mb-3 flex items-center gap-2">
                                    <span>👤</span> Clinical Context
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-xs text-slate-400 block mb-1">Diagnoses</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(patientData?.diagnoses || []).slice(0, 3).map(dx => (
                                                <span key={dx} className="bg-teal-50 text-teal-700 border border-teal-100 rounded-lg px-2 py-0.5 text-[10px] font-bold truncate max-w-[180px]" title={dx}>
                                                    {dx}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    {patientData?.labs && (
                                        <div>
                                            <span className="text-xs text-slate-400 block mb-1">Key Labs</span>
                                            <div className="grid grid-cols-2 gap-2">
                                                {Object.entries(patientData.labs).slice(0, 4).map(([k, v]) => (
                                                    <div key={k} className="bg-slate-50 border border-slate-100 rounded-lg p-1.5 flex flex-col">
                                                        <span className="text-[10px] text-slate-500">{k}</span>
                                                        <span className={`text-xs font-bold ${typeof v === 'number' && v < 60 && k === 'eGFR' ? 'text-amber-500' : 'text-slate-700'}`}>{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            // Patient View Context
                            <>
                                <p className="text-[#0D9488] font-bold text-sm mb-2 flex items-center gap-2">
                                    <span>🏥</span> Your Health Profile
                                </p>
                                <p className="text-slate-600 text-xs mb-3">
                                    We securely compared your medical history to this trial's rules.
                                </p>
                                <ul className="text-xs text-slate-600 space-y-1.5 border-t border-slate-100 pt-2">
                                    <li className="flex items-start gap-1.5">
                                        <span className="text-teal-500">✓</span> Age {patientData?.age}
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="text-teal-500">✓</span> {(patientData?.diagnoses || [])[0]?.split(' - ')[1] || 'Primary condition'}
                                    </li>
                                    {patientData?.medications?.length > 0 && (
                                        <li className="flex items-start gap-1.5">
                                            <span className="text-teal-500">✓</span> Current medications checked
                                        </li>
                                    )}
                                </ul>
                            </>
                        )}
                    </div>

                </aside>

                {/* ── MAIN CONTENT ── */}
                <main className="flex-1 flex flex-col gap-4">

                    {/* Main HPSA Banner */}
                    {report.hpsa_flagged && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 transition-all hover:bg-amber-100/50">
                            <span className="text-2xl">⭐</span>
                            <div>
                                <p className="text-amber-800 font-bold text-sm">HPSA Priority Match</p>
                                <p className="text-amber-700 text-xs">This patient resides in a designated Health Professional Shortage Area, prioritizing selection.</p>
                            </div>
                        </div>
                    )}

                    {/* Hero Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-6 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-teal-50/50 to-transparent pointer-events-none" />

                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-3 py-1 rounded-full border border-teal-200">
                                {report?.phase}
                            </span>
                            <span className="bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full font-mono">
                                {report?.trial_id}
                            </span>
                            <span className="bg-amber-50 text-amber-600 text-xs px-3 py-1 rounded-full border border-amber-200 font-medium">
                                ⏱️ Screened just now
                            </span>
                        </div>

                        <h1 className="text-2xl font-bold text-slate-800 mb-5 max-w-[80%] leading-snug">
                            {report.trial_name}
                        </h1>
                        <div className="border-l-4 border-[#0D9488] bg-teal-50/40 rounded-r-xl px-5 py-3 shadow-inner">
                            <p className="italic text-[#0F766E] text-sm leading-relaxed">
                                "{report.narrative_text || "Patient aligns well with core demographic and diagnostic criteria for this study."}"
                            </p>
                        </div>
                    </div>

                    {/* CRITERIA TABLE (Doctor/Nurse) OR CARDS (Patient) */}
                    {isClinical ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-teal-50 overflow-hidden flex flex-col">
                            <div className="bg-slate-50 border-b border-teal-50 px-5 py-3 flex flex-col">
                                <h3 className="text-slate-700 font-bold flex items-center gap-2">
                                    <span>📋</span> Eligibility Criteria Assessment
                                </h3>
                                <p className="text-slate-500 text-xs mt-0.5">Automated rule-based evaluation against protocol inclusion/exclusion criteria</p>
                            </div>

                            <div className="flex flex-col">
                                {criteria.map((c, i) => {
                                    const isMet = c.status === 'met';
                                    const isVerify = c.status === 'verify';

                                    // Role checks: Nurses see Verify actions
                                    return (
                                        <div
                                            key={i}
                                            className="flex items-start gap-4 p-4 border-b border-slate-50 last:border-0 hover:bg-teal-50/20 transition-colors"
                                            style={{ animation: `fadeSlideUp 300ms ease-out ${i * 60}ms both` }}
                                        >
                                            <div className={`mt-0.5 shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border
                        ${isMet ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                                    isVerify ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        'bg-red-50 text-red-700 border-red-200'}
                      `}>
                                                {isMet ? '✓ Met' : isVerify ? '⚠️ Verify' : '✗ Unmet'}
                                            </div>
                                            <div className="flex-1 flex flex-col gap-0.5">
                                                <span className={`text-sm font-bold ${isMet ? 'text-slate-800' : isVerify ? 'text-amber-900' : 'text-red-900'}`}>
                                                    {c.name}
                                                </span>
                                                <span className="text-xs text-slate-500 leading-relaxed">
                                                    {c.detail}
                                                </span>
                                                {isVerify && isCrc && (
                                                    <p className="text-amber-500 text-[10px] mt-1 flex items-center gap-1">
                                                        📋 <span className="font-medium">CRC Action:</span> Request updated lab/documentation from referring physician
                                                    </p>
                                                )}
                                            </div>

                                            {isNurse && isVerify && (
                                                <button
                                                    onClick={() => onVerifyField(report.patient_id, c.name)}
                                                    className="shrink-0 px-3 py-1.5 rounded-full bg-white border border-[#0D9488] text-[#0D9488] hover:bg-teal-50 hover:shadow-sm text-xs font-bold transition-all"
                                                >
                                                    Mark Verified ✓
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        // Patient view ELIGIBILITY CARDS
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex flex-col gap-2">
                                <span className="text-base">✅</span>
                                <h4 className="font-bold text-teal-900 text-sm">Why You May Qualify</h4>
                                <p className="text-xs text-teal-800 leading-relaxed">Your age, primary diagnosis, and basic health metrics match what researchers need.</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-2">
                                <span className="text-base">⚠️</span>
                                <h4 className="font-bold text-amber-900 text-sm">Things To Confirm</h4>
                                <p className="text-xs text-amber-800 leading-relaxed">Your doctor will need to run a quick recent lab test to guarantee your spot.</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-2">
                                <span className="text-base">💊</span>
                                <h4 className="font-bold text-blue-900 text-sm">What Happens Next</h4>
                                <p className="text-xs text-blue-800 leading-relaxed">Click 'Ask My Doctor' to send a message to your clinical team about this trial.</p>
                            </div>
                        </div>
                    )}

                    {/* MISSING DATA (Doctor/Nurse only generally, or adapted for patient) */}
                    {missing.length > 0 && isClinical && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                            <h3 className="text-amber-800 font-bold text-sm flex items-center gap-2 mb-3">
                                <span>⚠️</span> Missing Data Requires Action
                            </h3>
                            <div className="flex flex-col gap-2">
                                {missing.map((md, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white border border-amber-100 rounded-xl px-4 py-2 shadow-sm">
                                        <span className="text-sm font-medium text-slate-700">{md}</span>
                                        {isNurse && (
                                            <button
                                                onClick={() => onVerifyField(report.patient_id, md)}
                                                className="px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold transition-colors"
                                            >
                                                Verify Now
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* EXCLUSIONS (Doctor/Nurse) */}
                    {isClinical && (
                        <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-5 mt-2">
                            <h3 className="text-slate-700 font-bold text-sm flex items-center gap-2 mb-3">
                                <span>🚫</span> Exclusion Criteria Checks
                            </h3>
                            {exclusions.length > 0 ? (
                                <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 overflow-hidden">
                                    {/* Dramatic header banner */}
                                    <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 flex items-center gap-3">
                                        <span className="text-2xl">🚫</span>
                                        <div>
                                            <p className="text-white font-bold text-base">Exclusion Criteria Flagged</p>
                                            <p className="text-red-200 text-xs mt-0.5">
                                                {report.exclusion_flags.length} hard exclusion{report.exclusion_flags.length > 1 ? 's' : ''} detected by rule-based engine — enrollment not possible
                                            </p>
                                        </div>
                                        <div className="ml-auto bg-red-500 shadow-inner text-white text-xs font-bold px-3 py-1.5 rounded-full border border-red-400">
                                            NOT SUITABLE
                                        </div>
                                    </div>
                                    {/* Flag list */}
                                    <div className="p-4 space-y-3 bg-[#FDF2F2]">
                                        {report.exclusion_flags.map((flag, index) => (
                                            <div
                                                key={index}
                                                className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 shadow-sm"
                                                style={{ animationDelay: `${index * 100}ms`, animation: `fadeSlideUp 300ms ease-out both` }}
                                            >
                                                <span className="text-red-500 text-lg flex-shrink-0 mt-0.5">⛔</span>
                                                <div>
                                                    <p className="text-red-800 font-bold text-sm">Hard Exclusion #{index + 1}</p>
                                                    <p className="text-red-600 text-xs mt-0.5 leading-relaxed">{flag}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Footer note */}
                                    <div className="bg-red-100/50 border-t border-red-100 px-5 py-3">
                                        <p className="text-red-600 text-[11px] font-semibold flex items-center gap-2">
                                            <span>🔒</span>
                                            These exclusions are binary rule-based decisions and cannot be overridden by verification or additional documentation.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-teal-50 border border-teal-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                                    <span className="text-2xl">✅</span>
                                    <div>
                                        <p className="text-teal-800 font-bold text-sm">All Clear — No Exclusions Triggered</p>
                                        <p className="text-teal-600 text-xs mt-0.5">Patient cleared all exclusion criteria for this trial.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* WHAT-IF SIMULATOR (Doctor Only) */}
                    {isClinical && Object.keys(whatIfValues).length > 0 && (
                        <div className="bg-white border-2 border-[#0D9488]/20 rounded-2xl p-5 shadow-sm">
                            <h3 className="text-[#0D9488] font-bold text-sm flex items-center gap-2 mb-1">
                                <span>🔬</span> Eligibility Threshold Simulator
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">Adjust patient values to model how eligibility would change — useful for borderline cases</p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                {Object.entries(whatIfValues).map(([key, val]) => (
                                    <div key={key} className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-slate-600">{key}</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={val}
                                                onChange={(e) => setWhatIfValues(p => ({ ...p, [key]: e.target.value }))}
                                                className="w-24 px-2 py-1.5 bg-slate-50 border-2 border-teal-100 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:border-[#0D9488] transition-colors"
                                            />
                                            <span className="text-xs text-slate-400">unit</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-4 border-t border-slate-100 pt-4">
                                <button
                                    onClick={handleSimulate}
                                    disabled={simLoading}
                                    className="bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-50 text-white rounded-full px-5 py-2 text-sm font-bold shadow-sm transition-all"
                                >
                                    {simLoading ? 'Calculating...' : 'Simulate →'}
                                </button>
                                {simError && (
                                    <span className="text-sm font-bold text-red-500 animate-pulse">{simError}</span>
                                )}
                                {simDelta && (
                                    <div className="flex items-center gap-2 bg-teal-50 px-3 py-1 rounded-full border border-teal-100 text-sm font-bold">
                                        Score impact: <span className={simDelta > 0 ? 'text-teal-600' : 'text-red-500'}>
                                            {simDelta > 0 ? `+${simDelta}` : simDelta}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* AI REASONING */}
                    <div className={`bg-white rounded-2xl shadow-sm border p-5 ${isClinical ? 'border-purple-100' : 'border-teal-50'}`}>
                        <div className="mb-3">
                            <h3 className={`font-bold text-sm flex items-center gap-2 ${isClinical ? 'text-purple-800' : 'text-[#2E86AB]'}`}>
                                {isClinical ? <span>🧠 AI Screening Rationale</span> : <span>💬 What This Means For You</span>}
                            </h3>
                            {isClinical && (
                                <p className="text-[10px] text-slate-500 mt-1">Generated by BioGPT clinical language model — for CRC reference only, not a clinical decision</p>
                            )}
                        </div>

                        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                            {report.llm_explanation || "The patient meets primary endpoints but secondary metrics require review."}
                        </p>

                        <div className="mt-4 flex justify-end">
                            {isClinical ? (
                                <span className="bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-wide">
                                    Auto-generated · Review with PI before enrollment
                                </span>
                            ) : (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-lg">
                                    ⚠️ Generated by AI — always consult your doctor.
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Enhanced recommendation block */}
                    <div className={`rounded-2xl p-5 flex items-center gap-4 ${report.recommendation === 'Proceed'
                        ? 'bg-gradient-to-r from-teal-500 to-teal-600 shadow-lg shadow-teal-200'
                        : report.recommendation === 'Verify First'
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-lg shadow-amber-200'
                            : 'bg-gradient-to-r from-red-500 to-red-700 shadow-lg shadow-red-200'
                        }`}>
                        <span className="text-4xl flex-shrink-0">
                            {report.recommendation === 'Proceed' ? '🎯'
                                : report.recommendation === 'Verify First' ? '🔍'
                                    : '🚫'}
                        </span>
                        <div className="flex-1">
                            <p className="text-white font-bold text-lg">
                                {report.recommendation === 'Proceed'
                                    ? 'Proceed to Enrollment Inquiry'
                                    : report.recommendation === 'Verify First'
                                        ? 'Verify Fields Before Proceeding'
                                        : 'Not Suitable — Hard Exclusion Active'}
                            </p>
                            <p className="text-white/80 text-sm mt-0.5 leading-relaxed">
                                {report.recommendation === 'Proceed'
                                    ? 'Patient meets all required criteria. Review and proceed.'
                                    : report.recommendation === 'Verify First'
                                        ? 'Confirm missing fields with GP before enrollment inquiry.'
                                        : 'Rule-based engine detected a hard safety exclusion. See flags above.'}
                            </p>
                        </div>
                        <div className="bg-white/20 rounded-full px-5 py-2 text-white text-sm font-bold border border-white/30 flex-shrink-0 shadow-inner">
                            {report.match_score} / 100
                        </div>
                    </div>

                    {isCrc && (
                        <div className="flex items-center justify-end gap-3 pb-2 mb-2 border-b border-slate-100">
                            <span className="text-slate-500 text-sm font-medium mr-2">CRC Sign-off:</span>
                            <button className="bg-teal-500 hover:bg-teal-600 text-white rounded-full px-4 py-2 text-sm font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-2">
                                ✅ Approve Screening
                            </button>
                            <button className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-4 py-2 text-sm font-medium transition-all flex items-center gap-2">
                                🔄 Request Re-screen
                            </button>
                            <button className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-full px-4 py-2 text-sm font-medium transition-all flex items-center gap-2">
                                🚫 Mark Ineligible
                            </button>
                        </div>
                    )}

                    {/* FEEDBACK ROW */}
                    <div className="bg-white rounded-2xl shadow-sm border border-teal-50 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onBack}
                                className="px-4 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-bold transition-colors"
                            >
                                ← Back to Results
                            </button>
                            {isDoctor && (
                                <button className="px-4 py-1.5 text-slate-600 hover:text-[#0D9488] text-sm font-medium transition-colors underline underline-offset-2">
                                    Download PDF
                                </button>
                            )}
                            {isPatient && (
                                <button className="px-5 py-1.5 rounded-full bg-[#0D9488] hover:bg-[#0F766E] text-white text-sm font-bold shadow-sm transition-colors">
                                    📞 Ask My Doctor
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                            {feedbackSent ? (
                                <span className="text-sm font-bold text-teal-600 italic px-2 flex items-center gap-1">
                                    ✓ Feedback logged <span className="opacity-60 font-normal">— helps improve future screenings</span>
                                </span>
                            ) : (
                                <>
                                    <span className="text-xs font-semibold text-slate-500">
                                        Was this automated screening accurate?
                                    </span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setFeedbackSent(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700 text-xs font-semibold text-slate-600 transition-colors">
                                            👍 Yes, accurate
                                        </button>
                                        <button onClick={() => setFeedbackSent(true)} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-xs font-semibold text-slate-600 transition-colors">
                                            👎 Needs correction
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                </main>
            </div>

            {/* Global CSS for Trial Detail strictly */}
            <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(15px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
        </div>
    );
}
