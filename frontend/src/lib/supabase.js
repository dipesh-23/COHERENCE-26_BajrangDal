// frontend/src/lib/supabase.js
// Supabase client singleton — used for auth only (data goes through FastAPI backend)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || '';
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.warn('[TrialSync.ai] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set in .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
        persistSession: false,   // HIPAA: no localStorage persistence
        autoRefreshToken: true,
    },
});
