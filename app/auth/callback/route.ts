import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/admin'; // Default to admin for legacy flows

    // Env vars
    const allowedAdminEmail = process.env.ADMIN_EMAIL;
    const allowedStaffEmails = (process.env.STAFF_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

    if (code) {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    },
                },
            }
        );

        const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);

        if (session) {
            const userEmail = session.user.email;
            let role = null;

            // 1. Determine Role
            if (allowedAdminEmail && userEmail === allowedAdminEmail) {
                role = 'admin';
            } else if (userEmail && allowedStaffEmails.includes(userEmail)) {
                role = 'staff';
            }

            // 2. Set Admin/Staff Cookie if applicable
            if (role) {
                cookieStore.set('admin_session', role, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24, // 1 day
                    path: '/',
                });
            }

            // 3. Handle Redirection Logic
            // If they are logging in via the Shop Login page, 'next' will be '/' or '/shop'
            // If they are logging in via Admin Login page, 'next' defaults to '/admin'

            // Logic:
            // - If role exists (Admin/Staff): Allow entry to anywhere.
            // - If role is NULL (Customer): 
            //    - If trying to go to /admin -> DENY.
            //    - If trying to go to /shop or / -> ALLOW.

            const isTargetingAdmin = next.startsWith('/admin');

            if (role) {
                return NextResponse.redirect(`${requestUrl.origin}${next}`);
            } else {
                // Customer Login
                if (isTargetingAdmin) {
                    // Tried to login to Admin but not an admin
                    await supabase.auth.signOut();
                    return NextResponse.redirect(`${requestUrl.origin}/admin/login?error=Unauthorized Email`);
                } else {
                    // Regular customer login success
                    return NextResponse.redirect(`${requestUrl.origin}${next}`);
                }
            }
        }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(`${requestUrl.origin}/login?error=Auth Failed`);
}
