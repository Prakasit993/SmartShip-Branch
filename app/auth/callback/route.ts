import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/';

    // Env vars for role detection
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

        // Exchange code for session (PKCE flow)
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('Auth callback error:', error);
            return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(error.message)}`);
        }

        if (session) {
            const userEmail = session.user.email;
            const userId = session.user.id;
            const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || null;
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

            // 3. Sync user to customers table (using Admin client to bypass RLS)
            try {
                // Dynamically import to ensure server-side only usage
                const { supabaseAdmin } = await import('@/lib/supabaseAdmin');

                const { data: existingCustomer } = await supabaseAdmin
                    .from('customers')
                    .select('id')
                    .eq('line_user_id', userId)
                    .single();

                if (!existingCustomer) {
                    await supabaseAdmin.from('customers').insert({
                        line_user_id: userId,
                        name: userName,
                    });
                    console.log('Created customer record for:', userEmail);
                }
            } catch (err) {
                console.error('Customer sync error:', err);
                // Don't block login if customer sync fails
            }

            // 4. Handle Redirection
            const isTargetingAdmin = next.startsWith('/admin');

            if (role) {
                return NextResponse.redirect(`${requestUrl.origin}${next}`);
            } else {
                // Customer Login
                if (isTargetingAdmin) {
                    await supabase.auth.signOut();
                    return NextResponse.redirect(`${requestUrl.origin}/admin/login?error=Unauthorized`);
                } else {
                    return NextResponse.redirect(`${requestUrl.origin}${next}`);
                }
            }
        }
    }

    // No code provided - redirect to login with error
    return NextResponse.redirect(`${requestUrl.origin}/login?error=Auth Failed`);
}
