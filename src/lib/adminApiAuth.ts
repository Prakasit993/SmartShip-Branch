import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/** True if request carries admin password session or post-middleware admin/staff role cookie */
export async function isAdminApiRequest(): Promise<boolean> {
    const store = await cookies();
    const s = store.get('admin_session')?.value;
    const hasPwd = s === 'true' || s === 'admin';
    const hasRole = Boolean(store.get('admin_role')?.value);
    if (hasPwd || hasRole) return true;

    // Fallback for /api/admin/* calls that do not pass through /admin middleware.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return store.getAll();
                },
                setAll() {},
            },
        }
    );

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user?.email) return false;

    const adminEmail = process.env.ADMIN_EMAIL;
    const staffEmails = (process.env.STAFF_EMAILS || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

    return user.email === adminEmail || staffEmails.includes(user.email);
}
