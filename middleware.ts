import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
    adminSessionContextFromRequest,
    getAdminSessionMaxAgeSec,
    isPasswordAdminSessionCookie,
} from '@app/lib/adminSession';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Admin Route Protection (Secure Session Check)
    if (pathname.startsWith('/admin')) {
        // Exception: Login page is public
        if (pathname === '/admin/login') {
            return NextResponse.next();
        }

        let response = NextResponse.next({
            request: {
                headers: request.headers,
            },
        });

        // Check for password-based admin session first
        const adminSession = request.cookies.get('admin_session');
        if (
            await isPasswordAdminSessionCookie(
                adminSession?.value,
                adminSessionContextFromRequest(request)
            )
        ) {
            const maxAge = getAdminSessionMaxAgeSec();
            response.cookies.set('admin_role', 'admin', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge,
                path: '/',
            });
            return response;
        }

        // Initialize Supabase SSR Client
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
                        });
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );

        // Verify User Session (Securely)
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            console.warn(`[SECURITY] Unauthorized access attempt to ${pathname} (No Session/Invalid Token)`);
            const url = request.nextUrl.clone();
            url.pathname = '/admin/login';
            return NextResponse.redirect(url);
        }

        // Check Email Allowlist for Admin/Staff
        const userEmail = user.email;
        const adminEmail = process.env.ADMIN_EMAIL;
        const staffEmails = (process.env.STAFF_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

        let role = null;
        if (userEmail === adminEmail) {
            role = 'admin';
        } else if (userEmail && staffEmails.includes(userEmail)) {
            role = 'staff';
        }

        if (!role) {
            console.warn(`[SECURITY] Forbidden access attempt by ${userEmail} (Not in allowlist)`);
            const url = request.nextUrl.clone();
            url.pathname = '/admin/login';
            url.searchParams.set('error', 'Unauthorized Account');
            return NextResponse.redirect(url);
        }

        response.cookies.set('admin_role', role, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: getAdminSessionMaxAgeSec(),
            path: '/',
        });

        // RBAC: Staff Restrictions
        if (role === 'staff') {
            const restrictedRoutes = ['/admin/products', '/admin/settings', '/admin/categories', '/admin/bundles', '/admin/stock'];
            if (restrictedRoutes.some(route => pathname.startsWith(route))) {
                const url = request.nextUrl.clone();
                url.pathname = '/admin/orders';
                return NextResponse.redirect(url);
            }
        }

        return response;
    }

    // 2. Warehouse Route Protection — same auth as /admin, no sidebar RBAC
    if (pathname.startsWith('/warehouse')) {
        let response = NextResponse.next({ request: { headers: request.headers } });

        const adminSession = request.cookies.get('admin_session');
        if (
            await isPasswordAdminSessionCookie(
                adminSession?.value,
                adminSessionContextFromRequest(request)
            )
        ) {
            return response;
        }

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return request.cookies.getAll(); },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                        response = NextResponse.next({ request: { headers: request.headers } });
                        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                    },
                },
            }
        );

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            const url = request.nextUrl.clone();
            url.pathname = '/admin/login';
            return NextResponse.redirect(url);
        }

        const userEmail = user.email;
        const adminEmail = process.env.ADMIN_EMAIL;
        const staffEmails = (process.env.STAFF_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
        const isAllowed = userEmail === adminEmail || (userEmail != null && staffEmails.includes(userEmail));

        if (!isAllowed) {
            const url = request.nextUrl.clone();
            url.pathname = '/admin/login';
            url.searchParams.set('error', 'Unauthorized Account');
            return NextResponse.redirect(url);
        }

        return response;
    }

    // 3. Profile Route - Let the page handle its own auth check
    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/warehouse', '/warehouse/:path*'],
};
