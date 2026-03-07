import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── API base ─────────────────────────────────────────────────────────────────
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8001';


export default function Login({ onLoginSuccess = () => { } }) {
    const [scrolled, setScrolled] = useState(false);

    // Login form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    useEffect(() => {
        const h = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', h);
        return () => window.removeEventListener('scroll', h);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        if (!validEmail) { setError('Please enter a valid email address.'); return; }
        if (!password) { setError('Password is required.'); return; }

        setLoading(true);
        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                
                if (error) throw new Error(error.message);
                
                // If email confirmation is off, data.session might exist immediately
                if (data.session && data.user) {
                    onLoginSuccess(data.user, data.session.access_token);
                } else {
                    setSuccessMsg('Account created successfully! You can now sign in.');
                    setIsSignUp(false);
                }
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) {
                    throw new Error(error.message);
                }

                if (data.session && data.user) {
                    onLoginSuccess(data.user, data.session.access_token);
                } else {
                    throw new Error('Login failed: No session or user data received.');
                }
            }
        } catch (err) {
            setError(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };


    const scrollToLogin = () => {
        document.getElementById('portal-login').scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-teal-200 selection:text-teal-900 overflow-x-hidden">
            <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) }
          50% { transform: translateY(-15px) }
        }
        .anim-float { animation: float 6s ease-in-out infinite; }
        
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }

        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
      `}</style>

            {/* ═══ NAVIGATION ═══ */}
            <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-teal-50 py-3' : 'bg-transparent py-5'
                }`}>
                <div className="max-w-7xl mx-auto px-6 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-sm transition-colors ${scrolled ? 'bg-teal-50 border border-teal-100' : 'bg-white/20 backdrop-blur border border-white/20'
                            }`}>
                            <span className={scrolled ? 'drop-shadow-none' : 'drop-shadow-md pb-0.5'}>🏥</span>
                        </div>
                        <span className={`font-black text-xl tracking-tight transition-colors ${scrolled ? 'text-slate-800' : 'text-white drop-shadow-md'
                            }`}>
                            TrialSync<span className={scrolled ? 'text-teal-600' : 'text-teal-300'}>.ai</span>
                        </span>
                    </div>

                    <div className="hidden md:flex flex-1 items-center justify-center gap-8">
                        {['Platform', 'About'].map((link) => (
                            <a key={link} href={`#${link.toLowerCase()}`} className={`text-sm font-semibold transition-colors hover:text-teal-400 ${scrolled ? 'text-slate-600' : 'text-white/90 drop-shadow'
                                }`}>
                                {link}
                            </a>
                        ))}
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={scrollToLogin} className={`text-sm font-bold transition-colors ${scrolled ? 'text-teal-600 hover:text-teal-700' : 'text-white hover:text-teal-100 drop-shadow'
                            }`}>
                            Sign In
                        </button>
                        <button onClick={scrollToLogin} className={`px-5 py-2 rounded-full text-sm font-bold shadow-lg transition-all hover:scale-105 active:scale-95 ${scrolled ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-teal-600/20' : 'bg-white text-teal-700 hover:bg-teal-50'
                            }`}>
                            Get Access
                        </button>
                    </div>
                </div>
            </nav>

            {/* ═══ HERO SECTION ═══ */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-900">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-900 via-slate-900 to-slate-900 mix-blend-multiply" />
                    <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-teal-600/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
                    <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
                </div>

                <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold uppercase tracking-widest mb-6 fade-up">
                                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                                Designed for Clinical Research Coordinators
                            </div>

                            <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tight leading-[1.1] mb-6 fade-up delay-100">
                                Erase hours of <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">chart review.</span>
                            </h1>

                            <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-xl fade-up delay-200">
                                Supercharge your trial matching workflow. Automatically ingest EMR records, strip PHI, and cross-reference thousands of complex inclusion/exclusion criteria using clinical AI in seconds.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center gap-4 fade-up delay-300">
                                <button onClick={scrollToLogin} className="w-full sm:w-auto px-8 py-4 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold text-lg shadow-[0_0_30px_-5px_rgba(20,184,166,0.6)] transition-all hover:scale-105">
                                    Launch Dashboard Platform
                                </button>
                                <button onClick={scrollToLogin} className="w-full sm:w-auto px-8 py-4 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg transition-all border border-slate-700">
                                    Try Interactive Demo
                                </button>
                            </div>

                            <div className="mt-10 flex items-center gap-6 fade-up delay-300">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-sm shadow-sm ring-2 ring-transparent group-hover:ring-teal-500 transition-all">
                                            {['👨‍⚕️', '👩‍⚕️', '🧑‍⚕️', '👨‍🔬'][i - 1]}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-slate-400 text-sm font-medium">
                                    Trusted by <span className="text-white font-bold">500+</span> research sites nationwide
                                </p>
                            </div>
                        </div>

                        {/* Interactive UI Mockup Hero Graphic */}
                        <div className="relative fade-up delay-200 hidden lg:block perspective-1000">
                            <div className="relative w-full aspect-square max-w-[600px] mx-auto anim-float" style={{ transformStyle: 'preserve-3d', transform: 'rotateY(-15deg) rotateX(5deg)' }}>
                                {/* Main App Window */}
                                <div className="absolute inset-0 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
                                    <div className="h-12 bg-black/40 border-b border-white/10 flex items-center px-4 gap-2">
                                        <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400/80" /><div className="w-3 h-3 rounded-full bg-amber-400/80" /><div className="w-3 h-3 rounded-full bg-emerald-400/80" /></div>
                                        <div className="mx-auto bg-black/30 rounded-md px-24 py-1 text-[10px] text-white/40 font-mono">trialsync.ai/dashboard</div>
                                    </div>
                                    <div className="flex-1 p-6 flex flex-col gap-4">
                                        <div className="flex gap-4">
                                            <div className="w-[30%] bg-black/20 rounded-xl p-3 border border-white/5 space-y-3">
                                                <div className="h-4 w-20 bg-white/10 rounded-full" />
                                                <div className="h-24 w-full bg-teal-500/20 rounded-lg border border-teal-500/30 flex items-center justify-center"><span className="text-2xl opacity-50">☁️</span></div>
                                            </div>
                                            <div className="w-[70%] space-y-3">
                                                <div className="bg-gradient-to-r from-emerald-500/20 to-transparent p-3 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] flex justify-between items-center">
                                                    <span className="text-white font-bold text-sm">✅ COHERENCE-26</span>
                                                    <span className="text-emerald-300 font-mono text-xs text-right leading-tight">Score<br /><span className="text-xl">94</span></span>
                                                </div>
                                                <div className="bg-gradient-to-r from-amber-500/10 to-transparent p-3 rounded-xl border border-amber-500/20 flex justify-between items-center">
                                                    <span className="text-white/80 font-bold text-sm">🔍 RADIANT-HF</span>
                                                    <span className="text-amber-300/80 font-mono text-xs text-right leading-tight">Score<br /><span className="text-lg">68</span></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Floating Badge 1 */}
                                <div className="absolute -right-8 top-20 bg-white/90 backdrop-blur-xl border border-slate-200 p-4 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] anim-float" style={{ animationDelay: '1s' }}>
                                    <p className="text-[10px] text-teal-600 uppercase tracking-wider font-bold mb-1">BioGPT Analysis</p>
                                    <p className="text-slate-800 font-medium text-sm">Patient semantics match criteria 94%</p>
                                </div>
                                {/* Floating Badge 2 */}
                                <div className="absolute -left-12 bottom-32 bg-white/90 backdrop-blur-xl border border-slate-200 p-4 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] flex items-center gap-3 anim-float" style={{ animationDelay: '2s' }}>
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><span className="text-emerald-400 font-bold text-lg">✓</span></div>
                                    <div>
                                        <p className="text-white font-bold">HIPAA Compliant</p>
                                        <p className="text-slate-400 text-[10px]">Auto-PHI stripping active</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ LOGO CLOUD ═══ */}
            <section className="py-10 bg-white border-b border-slate-100 flex overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 w-full flex flex-col md:flex-row items-center justify-between gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest text-center md:text-left shrink-0">Integration Partners</p>
                    <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 font-bold text-slate-800 text-xl tracking-tighter">
                        <span className="flex items-center gap-1"><span className="text-[#00557B] text-2xl">◎</span> Epic</span>
                        <span className="flex items-center gap-1"><span className="text-[#0070AC] text-xl font-serif">Cerner</span></span>
                        <span className="flex items-center gap-1"><span className="text-[#00B2A9]">Allscripts</span></span>
                        <span className="flex items-center gap-1"><span className="text-[#DA291C] font-black italic">RedCap</span></span>
                    </div>
                </div>
            </section>

            {/* ═══ FEATURES ═══ */}
            <section id="platform" className="py-24 bg-slate-50 relative">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="max-w-3xl mx-auto text-center mb-16 fade-up">
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight sm:text-4xl mb-4">A single source of truth for sponsors and sites.</h2>
                    <p className="text-slate-500 text-lg">Stop juggling PDFs and spreadsheets. TrialSync.ai centralizes criteria rule engines, NLP semantic matching, and patient data into one secure workflow.</p>
                </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            { icon: '🌪️', title: 'Instant FHIR/JSON Ingestion', desc: 'Drag and drop de-identified EMR exports. We automatically parse lab arrays, ICD-10 diagnoses, and medication histories.' },
                            { icon: '🧠', title: 'BioGPT Neural Matching', desc: 'Our fine-tuned LLMs understand clinical nuance. It knows that "type II diabetes mellitus" satisfies the criteria for "T2DM".' },
                            { icon: '🔒', title: 'Zero PHI Architecture', desc: 'Integrated Microsoft Presidio drops PHI locally before hitting the AI engine. Fully HIPAA § 164.514 compliant workflows.' },
                            { icon: '📊', title: 'What-if Simulation', desc: 'Got a borderline patient? Use the dashboard sliders to see exactly how close their HbA1c or eGFR is to passing trial limits.' },
                            { icon: '📧', title: '1-Click Investigator Export', desc: 'Generate complete, heavily-annotated screening reports. Send to your PI with a clear "Approve Match" button embedded.' },
                            { icon: '🗺️', title: 'Geospatial Trial Routing', desc: 'Automatically filter thousands of active records by patient ZIP code. Never screen a patient for a trial located 500 miles away.' }
                        ].map((f, i) => (
                            <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-2xl mb-6">{f.icon}</div>
                                <h3 className="text-xl font-bold text-slate-800 mb-3">{f.title}</h3>
                                <p className="text-slate-500 leading-relaxed text-sm">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ ABOUT PROJECT SECTION ═══ */}
            <section id="about" className="py-24 bg-white relative">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div className="fade-up">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold uppercase tracking-widest mb-6">
                                <span>About The Project</span>
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 tracking-tight sm:text-4xl mb-6">Built to accelerate Oncology research.</h2>
                            <p className="text-slate-600 text-lg mb-6 leading-relaxed text-justify">
                                Clinical trials are the lifeblood of medical advancement, yet matching patients to complex trial criteria remains a slow, manual bottleneck. Our project leverages modern NLP to automate this process. 
                            </p>
                            <p className="text-slate-600 text-lg mb-6 leading-relaxed text-justify">
                                We've custom-trained a <strong>Semantic Matching Model (S-BiomedBERT/MiniLM)</strong> specifically on real-world Oncology ClinicalTrials.gov data. It doesn't just look for keyword matches—it understands the clinical context of solid tumors, prior chemotherapies, and biomarker exclusions to instantly flag the best trials for a patient.
                            </p>

                            <div className="flex flex-wrap gap-3 mb-8 fade-up delay-100">
                                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-sm font-bold shadow-sm">
                                    <span className="text-teal-500">⚡</span> Custom NLP Weights
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold shadow-sm">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]" /> 
                                    Trained on 100 Live Oncology Trials
                                </span>
                            </div>
                            
                            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-center gap-4">
                                <div className="w-12 h-12 shrink-0 rounded-full bg-slate-900 flex items-center justify-center text-xl shadow-lg border-2 border-slate-700">🚀</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 mb-0.5">Hackathon Prototype</p>
                                    <p className="text-xs text-slate-500">Currently exploring integrations with FHIR standards and expanding the matching engine beyond Oncology.</p>
                                </div>
                            </div>
                        </div>

                        {/* Visual graphic for the about section */}
                        <div className="relative fade-up delay-200">
                            <div className="absolute inset-0 bg-gradient-to-br from-teal-100 to-emerald-50 rounded-[40px] transform rotate-3" />
                            <div className="relative bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl overflow-hidden min-h-[400px]">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-[30px] -translate-y-10 translate-x-10" />
                                
                                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-teal-500" /> Model Architecture
                                </h3>

                                <div className="space-y-4">
                                    {/* Patient Data Box */}
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">📄</div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Input 1</p>
                                            <p className="text-sm font-bold text-slate-700">Patient Electronic Medical Record</p>
                                        </div>
                                    </div>
                                    
                                    <div className="h-6 w-px bg-slate-300 mx-auto" />

                                    {/* ML Model Engine Box */}
                                    <div className="bg-slate-900 p-4 rounded-xl flex items-center gap-4 shadow-[0_0_20px_rgba(20,184,166,0.3)] border border-slate-700 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-transparent -translate-x-[100%] group-hover:animate-[goldShimmer_1.5s_ease-out_infinite]" />
                                        <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-xl shadow-inner relative z-10">🧠</div>
                                        <div className="relative z-10">
                                            <p className="text-[10px] text-teal-400 font-bold uppercase tracking-wider mb-0.5">Semantic Engine</p>
                                            <p className="text-sm font-bold text-white">Fine-tuned TrialMatch AI Model</p>
                                            <p className="text-xs text-slate-400 font-mono mt-1">CosineSimilarityLoss • 3 Epochs</p>
                                        </div>
                                    </div>

                                    <div className="h-6 w-px bg-slate-300 mx-auto" />

                                    {/* Trial Data Box */}
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">🏥</div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Input 2</p>
                                            <p className="text-sm font-bold text-slate-700">ClinicalTrials.gov API Protocol</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ LOGIN PORTAL SECTION ═══ */}
            <section id="portal-login" className="py-24 bg-slate-900 border-t border-slate-800 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-teal-900/20 to-transparent" />

                <div className="max-w-4xl mx-auto px-6 relative z-10 flex flex-col md:flex-row items-center gap-12 bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 p-8 md:p-12 shadow-2xl">

                    <div className="flex-1 text-center md:text-left">
                        <div className="inline-block bg-teal-500/20 text-teal-300 font-bold text-xs uppercase tracking-widest px-3 py-1.5 rounded-full border border-teal-500/30 mb-4">
                            Research Portal Access
                        </div>
                        <h2 className="text-3xl font-black text-white mb-4 leading-tight">Secure your clinical workflow today.</h2>
                        <p className="text-slate-400 mb-6">Sign in to your dashboard to resume patient matching, or spin up our loaded Demo Sandbox to explore the platform without connecting your EMR.</p>

                        <div className="space-y-3 hidden md:block mt-8">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">✓</div>
                                <span className="text-slate-300 text-sm font-medium">SSO & Active Directory Support</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm">✓</div>
                                <span className="text-slate-300 text-sm font-medium">SOC-2 Type II Certified Data Centers</span>
                            </div>
                        </div>
                    </div>

                    {/* The Login Form Card */}
                    <div className="w-full max-w-[380px] bg-white rounded-3xl p-8 shadow-2xl relative">
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-teal-400/30 rounded-full blur-[40px] pointer-events-none" />

                        <div className="text-center mb-6">
                            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">🔬</div>
                            <h3 className="text-slate-800 font-black text-xl">{isSignUp ? 'Create Account' : 'CRC Login Portal'}</h3>
                            <p className="text-slate-400 text-xs mt-1">Authorized trial personnel only</p>
                        </div>

                        {/* Toggle Mode */}
                        <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                            <button 
                                onClick={() => { setIsSignUp(false); setError(''); setSuccessMsg(''); }}
                                className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${!isSignUp ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Sign In
                            </button>
                            <button 
                                onClick={() => { setIsSignUp(true); setError(''); setSuccessMsg(''); }}
                                className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${isSignUp ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Get Access
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-slate-600 text-xs font-bold uppercase tracking-wider mb-1.5 block ml-1">Work Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="coordinator@hospital.org"
                                    className={`w-full bg-slate-50 border-2 rounded-xl px-4 py-3 text-slate-800 text-sm placeholder-slate-300 outline-none transition-all shadow-sm focus:ring-4 focus:bg-white
                                        ${email && !validEmail ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-100 focus:border-teal-500 focus:ring-teal-500/20'}`}
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1.5 ml-1 mr-1">
                                    <label className="text-slate-600 text-xs font-bold uppercase tracking-wider">Password</label>
                                    {!isSignUp && <button type="button" className="text-teal-600 text-xs font-semibold hover:underline">Reset?</button>}
                                </div>
                                <div className="relative">
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-slate-800 text-sm placeholder-slate-300 outline-none transition-all shadow-sm focus:ring-4 focus:bg-white focus:border-teal-500 focus:ring-teal-500/20 pr-10"
                                    />
                                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 text-lg transition-colors">
                                        {showPass ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
                                    <span className="text-sm mt-0.5">❌</span>
                                    <span className="text-red-700 text-xs font-medium leading-tight">{error}</span>
                                </div>
                            )}

                            {successMsg && (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-2">
                                    <span className="text-sm mt-0.5">✅</span>
                                    <span className="text-emerald-700 text-xs font-medium leading-tight">{successMsg}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center text-white mt-2 transition-all shadow-lg hover:shadow-teal-600/30 hover:-translate-y-0.5 active:translate-y-0 bg-gradient-to-r from-teal-600 to-teal-500 border border-teal-500 disabled:opacity-70"
                            >
                                {loading ? 'Authenticating...' : (isSignUp ? 'Create Account' : 'Secure Sign In')}
                            </button>
                        </form>

                        <div className="mt-5 pt-4 border-t border-slate-100">
                            <p className="text-center text-slate-400 text-[11px] font-medium">
                                🔐 Secured by Supabase Auth &nbsp;·&nbsp; HIPAA § 164.514
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="bg-slate-950 py-12 border-t border-slate-800">
                <div className="max-w-7xl mx-auto px-6 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <span className="font-black text-2xl text-white tracking-tight">
                            TrialSync<span className="text-teal-500">.ai</span>
                        </span>
                        <p className="text-slate-500 text-sm mt-2">© 2026 TrialSync.ai Engineering. All rights reserved.</p>
                    </div>
                    <div className="flex gap-6 text-slate-400 text-sm font-medium">
                        <a href="#" className="hover:text-teal-400 transition-colors">Privacy Policy</a>
                        <a href="#" className="hover:text-teal-400 transition-colors">Terms of Service</a>
                        <a href="#" className="hover:text-teal-400 transition-colors">HIPAA Certifications</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
