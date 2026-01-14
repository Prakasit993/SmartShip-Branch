import { createClient } from '@supabase/supabase-js';

// Note: This client uses the SERVICE_ROLE_KEY which bypasses RLS.
// It should ONLY be used in server-side contexts (Server Actions, API Routes)
// and strictly for Admin operations.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
    // Warn but don't crash yet, allowing build to pass if env not set
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will fail.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || 'placeholder');
