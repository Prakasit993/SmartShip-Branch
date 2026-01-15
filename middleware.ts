import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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
        if (adminSession?.value === 'true' || adminSession?.value === 'admin') {
            // Password-based login - allow full admin access
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

    // 2. Profile Route Protection (Basic Cookie Check for MVP)
    if (pathname.startsWith('/profile')) {
        const allCookies = request.cookies.getAll();
        // Check for common Supabase Auth cookie patterns
        const hasAuthCookie = allCookies.some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));

        if (!hasAuthCookie) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set('next', pathname);
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*', '/profile/:path*'],
};
