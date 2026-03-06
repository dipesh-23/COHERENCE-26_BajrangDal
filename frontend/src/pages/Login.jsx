import React, { useState } from 'react';

// ─── API base ─────────────────────────────────────────────────────────────────
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8000';

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLES = [
    {
        key: 'crc',
        label: 'Research Coordinator',
        emoji: '🔬',
        access: 'Screen & match patients',
        color: '#0D9488',
        gradient: 'from-[#0D9488] to-[#0F766E]',
        shadow: 'shadow-[#0D9488]/30',
        ring: 'focus:ring-[#0D9488]/10',
        border: 'border-[#0D9488]',
        bg: 'bg-[#0D9488]/5',
        text: 'text-[#0D9488]',
        btnText: 'Sign In to Screening Dashboard',
        welcome: 'Welcome back, Coordinator',
        subtitle: 'Your patient screening dashboard awaits',
        emailPlaceholder: 'coordinator@research.org'
    },
    {
        key: 'investigator',
        label: 'Investigator',
        emoji: '👨‍⚕️',
        access: 'Review & approve matches',
        color: '#0F766E',
        gradient: 'from-[#0F766E] to-[#065F46]',
        shadow: 'shadow-[#0F766E]/30',
        ring: 'focus:ring-[#0F766E]/10',
        border: 'border-[#0F766E]',
        bg: 'bg-[#0F766E]/5',
        text: 'text-[#0F766E]',
        btnText: 'Sign In to Review Portal',
        welcome: 'Welcome back, Investigator',
        subtitle: 'Review matched patient recommendations',
        emailPlaceholder: 'pi@clinicaltrial.org'
    },
    {
        key: 'patient',
        label: 'Patient',
        emoji: '🧑‍🦽',
        access: 'My trial matches',
        color: '#14B8A6',
        gradient: 'from-[#14B8A6] to-[#0D9488]',
        shadow: 'shadow-[#14B8A6]/30',
        ring: 'focus:ring-[#14B8A6]/10',
        border: 'border-[#14B8A6]',
        bg: 'bg-[#14B8A6]/5',
        text: 'text-[#14B8A6]',
        btnText: 'View My Trial Matches',
        welcome: 'Find Your Clinical Trials',
        subtitle: 'See which trials you may qualify for',
        emailPlaceholder: 'patient@email.com'
    },
];

// ─── Demo fallback user ───────────────────────────────────────────────────────
function demoUser(role) {
    return {
        token: 'demo-token',
        user: {
            id: 'U-DEMO',
            name: role === 'crc' ? 'Coordinator Jane Smith' : role === 'investigator' ? 'Dr. Sarah Chen' : 'Demo Patient',
            role,
            department: role === 'crc' ? 'Clinical Trials Office' : role === 'investigator' ? 'Endocrinology' : 'Patient',
            hospital: 'Mount Sinai Medical Center',
        },
    };
}

export default function Login({ onLoginSuccess = () => { } }) {
    const [selectedRole, setSelectedRole] = useState('crc');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const role = ROLES.find(r => r.key === selectedRole);

    // ── Email validation ──
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!validEmail) { setError('Please enter a valid email address.'); return; }
        if (!password) { setError('Password is required.'); return; }

        setLoading(true);
        try {
            // ── BACKEND INTEGRATION: POST /auth/login ─────────────────────────────
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role: selectedRole }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.detail || body?.message || `Login failed (${res.status})`);
            }
            const data = await res.json(); // { token, user }
            // Token kept in memory only — never localStorage
            onLoginSuccess(data.user, data.token);
            // ─────────────────────────────────────────────────────────────────────
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleDemo = () => {
        const data = demoUser(selectedRole);
        onLoginSuccess(data.user, data.token);
    };

    return (
        <div className="h-screen w-full flex overflow-hidden font-sans">
            <style>{`
        @keyframes scaleIn {
          from { opacity:0; transform:scale(0.5); }
          to   { opacity:1; transform:scale(1); }
        }
        .badge-in { animation: scaleIn 0.2s ease-out forwards; }
        @keyframes fadeIn {
          from { opacity:0; transform:translateY(-6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .fade-in { animation: fadeIn 0.2s ease-out forwards; }
      `}</style>

            {/* ════════════════════════════════════════════════════════════════════
          LEFT HERO PANEL
      ════════════════════════════════════════════════════════════════════ */}
            <div className="w-1/2 relative overflow-hidden flex flex-col bg-gradient-to-br from-[#0D9488] via-[#0F766E] to-[#065F46]">

                {/* Background decorative circles */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
                    <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-white/5" />
                    <div className="absolute -bottom-16 left-1/4 w-72 h-72 rounded-full bg-white/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.03]" />
                </div>

                {/* Top nav strip */}
                <nav className="relative z-10 flex items-center justify-between px-8 pt-8">
                    <span className="text-white font-black text-3xl tracking-tight">
                        Trial<span className="text-teal-300">.</span>
                    </span>
                    <div className="flex items-center gap-6">
                        {['Home', 'About Us', 'Contact Us'].map(link => (
                            <button key={link} className="text-white/80 text-sm font-medium hover:text-white transition-colors">{link}</button>
                        ))}
                        <button className="bg-white/15 hover:bg-white/25 text-white border border-white/30 rounded-full px-5 py-2 text-sm font-semibold backdrop-blur-sm transition-all duration-200 ml-2">
                            Book Appointment
                        </button>
                    </div>
                </nav>

                {/* Hero center */}
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-12 text-center">
                    <h1 className="text-white font-bold text-4xl leading-tight max-w-sm">
                        Screen Patients. Match Trials. Save Hours.
                    </h1>
                    <p className="text-white/75 text-base mt-3 max-w-md">
                        Replace manual eligibility screening with AI-powered matching. Every patient. Every trial. Every criterion — explained.
                    </p>
                    <button className="mt-6 bg-white/20 hover:bg-white/30 text-white border border-white/40 rounded-full px-8 py-3 text-base font-semibold backdrop-blur-sm transition-all duration-200 hover:scale-[1.03]">
                        Start Screening →
                    </button>

                    {/* Doctor team avatars */}
                    <div className="flex items-center justify-center mt-12 -space-x-3">
                        {['👨‍⚕️', '👩‍⚕️', '🧑‍⚕️'].map((em, i) => (
                            <div key={i} className="w-14 h-14 rounded-full bg-white/20 border-2 border-teal-300/60 flex items-center justify-center text-2xl backdrop-blur-sm shadow-lg" style={{ zIndex: 3 - i }}>
                                {em}
                            </div>
                        ))}
                        <div className="ml-4 text-left">
                            <p className="text-white font-semibold text-sm">Expert Medical Team</p>
                            <p className="text-white/60 text-xs">Clinicians & researchers</p>
                        </div>
                    </div>
                </div>

                {/* Bottom stats */}
                <div className="relative z-10 flex items-center justify-around px-8 pb-10">
                    {[
                        { value: '8hrs', label: 'Saved Per Patient' },
                        { value: '99%', label: 'Screening Accuracy' },
                        { value: '3x', label: 'Faster Enrollment' },
                    ].map(stat => (
                        <div key={stat.value} className="flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full border-4 border-white/40 bg-white/10 flex flex-col items-center justify-center backdrop-blur-sm">
                                <span className="text-white font-bold text-lg leading-none">{stat.value}</span>
                            </div>
                            <span className="text-white/70 text-[10px] text-center leading-tight mt-1.5 max-w-[60px]">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
          RIGHT LOGIN PANEL
      ════════════════════════════════════════════════════════════════════ */}
            <div className="w-1/2 bg-[#F8FFFE] flex flex-col items-center justify-center px-14 relative overflow-hidden">

                {/* Decorative bg circle */}
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-teal-50 -translate-y-1/4 translate-x-1/4 pointer-events-none" />

                <div className="w-full max-w-sm relative z-10">

                    {/* ── 1. Role selector ── */}
                    <p className="text-slate-400 text-xs uppercase tracking-widest mb-4 font-semibold text-center">Sign in as</p>
                    <div className="grid grid-cols-3 gap-3 w-full mb-6">
                        {ROLES.map(r => {
                            const active = selectedRole === r.key;
                            return (
                                <div
                                    key={r.key}
                                    onClick={() => { setSelectedRole(r.key); setError(''); }}
                                    className={`relative cursor-pointer rounded-2xl p-4 flex flex-col items-center gap-1.5 border-2 transition-all duration-200 hover:scale-[1.02]
                    ${active ? `${r.border} ${r.bg} shadow-md` : 'border-slate-100 bg-white text-slate-400 shadow-sm'}`}
                                >
                                    {active && (
                                        <div className="badge-in absolute -top-2 -right-2 w-6 h-6 rounded-full text-white text-xs flex items-center justify-center shadow-md font-bold"
                                            style={{ backgroundColor: r.color }}>✓</div>
                                    )}
                                    <span className="text-2xl">{r.emoji}</span>
                                    <span className={`font-semibold text-sm ${active ? r.text : 'text-slate-600'}`}>{r.label}</span>
                                    <span className={`text-[10px] ${active ? r.text + ' opacity-70' : 'text-slate-400'}`}>{r.access}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* ── 2. Form header ── */}
                    <h2 className="text-slate-800 font-bold text-2xl">{role.welcome}</h2>
                    <p className="text-slate-400 text-sm mt-1">{role.subtitle}</p>

                    {/* ── 3. Form fields ── */}
                    <form onSubmit={handleSubmit} className="space-y-4 w-full mt-6">
                        <div>
                            <label className="text-slate-600 text-sm font-medium mb-1.5 block">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder={role.emailPlaceholder}
                                className={`w-full bg-white border-2 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-300 outline-none transition-all duration-200 shadow-sm focus:ring-4
                  ${email && !validEmail ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : `border-slate-100 focus:border-[${role.color}] ${role.ring}`}`}
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-slate-600 text-sm font-medium">Password</label>
                                <button type="button" className={`${role.text} text-xs hover:underline`}>Forgot password?</button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 pr-11 text-slate-800 placeholder-slate-300 outline-none transition-all duration-200 shadow-sm focus:ring-4 focus:border-[${role.color}] ${role.ring}`}
                                />
                                <button type="button" onClick={() => setShowPass(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-lg">
                                    {showPass ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        {/* ── 7. Error state ── */}
                        {error && (
                            <div className="fade-in bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
                                <span>❌</span>
                                <span className="text-red-600 text-sm">{error}</span>
                            </div>
                        )}

                        {/* ── 4. Submit button ── */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3.5 rounded-full font-semibold text-white text-base mt-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl
                bg-gradient-to-r ${role.gradient} ${role.shadow} disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Signing in...
                                </span>
                            ) : role.btnText}
                        </button>
                    </form>

                    {/* ── 5. Divider ── */}
                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 border-t border-slate-100" />
                        <span className="text-slate-300 text-xs">or</span>
                        <div className="flex-1 border-t border-slate-100" />
                    </div>

                    {/* ── 6. Demo mode button ── */}
                    <button
                        onClick={handleDemo}
                        className={`w-full py-3 rounded-full border-2 border-slate-100 text-slate-500 text-sm font-medium transition-all duration-200 hover:border-[${role.color}] hover:${role.text} hover:bg-white`}
                        style={{ ':hover': { borderColor: role.color, color: role.color } }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = role.color; e.currentTarget.style.color = role.color; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.color = ''; }}
                    >
                        ⚡ Continue with Demo Mode
                    </button>

                    {/* ── 8. Bottom notice & CRC specific UI ── */}
                    {selectedRole === 'crc' && (
                        <div className="mt-4 bg-teal-50 border border-teal-100 rounded-2xl p-4 w-full">
                            <p className="text-teal-700 font-semibold text-xs uppercase tracking-wide mb-2">
                                Built for Research Coordinators
                            </p>
                            <div className="space-y-1.5">
                                {[
                                    '⚡ Screen a patient in 90 seconds instead of 3 hours',
                                    '📋 Every inclusion/exclusion criterion explained automatically',
                                    '🗺️ Filter trials by distance from patient ZIP code',
                                    '⚖️ Bias alerts flag trials that unfairly exclude patients'
                                ].map((item, i) => (
                                    <p key={i} className="text-teal-600 text-[11px] font-medium flex items-start gap-2">
                                        <span className="flex-shrink-0">{item.split(' ')[0]}</span>
                                        <span>{item.split(' ').slice(1).join(' ')}</span>
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-slate-400 text-[11px] text-center mt-6">
                        🔒 HIPAA-compliant · All patient records anonymized before processing · No PHI transmitted to AI models
                    </p>
                </div>
            </div>
        </div>
    );
}
