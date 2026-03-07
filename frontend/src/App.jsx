import './index.css';
import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
    // Token is stored in React state only — never localStorage (HIPAA)
    const [session, setSession] = useState(null); // { user, token } | null

    if (!session) {
        return (
            <Login
                onLoginSuccess={(user, token) => setSession({ user, token })}
            />
        );
    }

    return (
        <Dashboard
            currentUser={session.user}
            token={session.token}
            onLogout={() => setSession(null)}
        />
    );
}
