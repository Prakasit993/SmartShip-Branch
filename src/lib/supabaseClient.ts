import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Auto-detect and handle OAuth tokens from URL hash
        detectSessionInUrl: true,
        // Persist session in localStorage
        persistSession: true,
        // Auto-refresh tokens
        autoRefreshToken: true,
        // Storage key for session
        storageKey: 'supabase.auth.token',
    }
});