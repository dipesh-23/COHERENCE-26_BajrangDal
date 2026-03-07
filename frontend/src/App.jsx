import './index.css';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

// ─── Loading Screen Component ──────────────────────────────────────────────────
function LoadingScreen({ onDone }) {
    useEffect(() => {
        const t = setTimeout(onDone, 2200);
        return () => clearTimeout(t);
    }, [onDone]);

    return (
        <div className="loading-screen active" style={{ animation: 'none' }}>
            <style>{`
                @keyframes lspin { to { transform: rotate(360deg); } }
                @keyframes lup { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
                @keyframes lout { from { opacity:1; } to { opacity:0; pointer-events:none; } }
                .ls-fade-out { animation: lout 0.5s ease forwards; animation-delay: 1.6s; }
                .ls-ring { animation: lspin 0.75s linear infinite; }
                .ls-up { animation: lup 0.5s cubic-bezier(0.16,1,0.3,1) forwards; opacity:0; }
                .ls-up-2 { animation: lup 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s forwards; opacity:0; }
                .ls-up-3 { animation: lup 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s forwards; opacity:0; }
            `}</style>
            <div className="ls-fade-out flex flex-col items-center gap-8">
                {/* Logo */}
                <div className="ls-up flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#0D9488]/10 border border-[#0D9488]/20 flex items-center justify-center text-2xl shadow-sm">🏥</div>
                    <div>
                        <h1 className="text-[#0F1E34] font-black text-3xl tracking-tight leading-none mt-5">
                            TrialSync<span className="text-[#0D9488]">.ai</span>
                        </h1>
                        <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-widest mt-0.5">Clinical Research Platform</p>
                    </div>
                </div>

                {/* Spinner */}
                <div className="ls-up-2 relative w-14 h-14">
                    <svg className="ls-ring" width="56" height="56" viewBox="0 0 56 56" fill="none">
                        <circle cx="28" cy="28" r="24" stroke="#E2E8F0" strokeWidth="3" />
                        <circle cx="28" cy="28" r="24" stroke="#0D9488" strokeWidth="3"
                            strokeLinecap="round" strokeDasharray="50 100" />
                    </svg>
                </div>

                {/* Status */}
                <div className="ls-up-3 flex flex-col items-center gap-2">
                    <p className="text-slate-500 text-sm font-medium">Initializing matching engine…</p>
                    <div className="flex gap-2 items-center">
                        {['🔬 NLP Parser', '📍 Geo Filter', '💊 Drug Safety'].map((t, i) => (
                            <span key={t} className="text-[10px] font-bold text-[#0D9488] bg-[#0D9488]/8 border border-[#0D9488]/20 rounded-full px-2.5 py-1"
                                style={{ animationDelay: `${i * 100}ms` }}>
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    const [session, setSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    if (isLoading) {
        return <LoadingScreen onDone={() => setIsLoading(false)} />;
    }

    if (!session) {
        return <Login onLoginSuccess={(user, token) => setSession({ user, token })} />;
    }

    return (
        <Dashboard
            currentUser={session.user}
            token={session.token}
            onLogout={() => setSession(null)}
        />
    );
}
