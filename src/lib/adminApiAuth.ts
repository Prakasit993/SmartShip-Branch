import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { adminSessionContextFromRequest, isPasswordAdminSessionCookie } from '@app/lib/adminSession';

export type AdminApiRole = 'admin' | 'staff';
export type AdminApiPolicy = 'admin-only' | 'admin-or-staff';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Resolves admin/staff for /api/admin/* (these routes are NOT covered by middleware).
 * Password login: signed `admin_session` cookie. OAuth: Supabase session + email allowlist.
 */
export async function getAdminApiAccess(
    request?: Request
): Promise<{ allowed: boolean; role: AdminApiRole | null }> {
    const store = await cookies();
    const sessionVal = store.get('admin_session')?.value;
    if (request && (await isPasswordAdminSessionCookie(sessionVal, adminSessionContextFromRequest(request)))) {
        return { allowed: true, role: 'admin' };
    }

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

    if (error || !user?.email) {
        return { allowed: false, role: null };
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    const staffEmails = (process.env.STAFF_EMAILS || '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);

    if (adminEmail && user.email === adminEmail) {
        return { allowed: true, role: 'admin' };
    }
    if (staffEmails.includes(user.email)) {
        return { allowed: true, role: 'staff' };
    }

    return { allowed: false, role: null };
}

function configuredAllowedOrigins(): Set<string> {
    const origins = new Set<string>();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (siteUrl) {
        try {
            origins.add(new URL(siteUrl).origin);
        } catch {
            // Ignore invalid deployment config; request origin checks still use the current URL.
        }
    }

    for (const raw of (process.env.ADMIN_ALLOWED_ORIGINS || '').split(',')) {
        const value = raw.trim();
        if (!value) continue;
        try {
            origins.add(new URL(value).origin);
        } catch {
            origins.add(value.replace(/\/+$/, ''));
        }
    }

    return origins;
}

function requestOrigin(request: Request): string | null {
    const origin = request.headers.get('origin')?.trim();
    if (origin) return origin;

    const referer = request.headers.get('referer')?.trim();
    if (referer) {
        try {
            return new URL(referer).origin;
        } catch {
            return null;
        }
    }

    return null;
}

function currentAllowedOrigins(request: Request): Set<string> {
    const origins = configuredAllowedOrigins();
    try {
        const url = new URL(request.url);
        origins.add(url.origin);

        const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
        if (host) {
            const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
            origins.add(`${proto}://${host}`);
        }
    } catch {
        // No-op; malformed Request.url is not expected in Next route handlers.
    }
    return origins;
}

function isTrustedMutatingOrigin(request: Request): boolean {
    if (!MUTATING_METHODS.has(request.method.toUpperCase())) return true;

    const origin = requestOrigin(request);
    if (!origin) {
        return process.env.NODE_ENV !== 'production' || process.env.ADMIN_API_ALLOW_MISSING_ORIGIN === 'true';
    }

    return currentAllowedOrigins(request).has(origin.replace(/\/+$/, ''));
}

export async function requireAdminApiAuth(
    policy: AdminApiPolicy = 'admin-or-staff',
    request?: Request
): Promise<NextResponse | null> {
    if (request && !isTrustedMutatingOrigin(request)) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const access = await getAdminApiAccess(request);
    if (!access.allowed) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (policy === 'admin-only' && access.role === 'staff') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return null;
}

/** @deprecated Prefer requireAdminApiAuth for explicit policy */
export async function isAdminApiRequest(): Promise<boolean> {
    return (await getAdminApiAccess()).allowed;
}

/**
 * Optional shared secret for n8n → POST /api/admin/jt-shipments/n8n-sync
 * Use header Authorization: Bearer <secret> or X-N8N-JT-Sync-Secret: <secret>
 */
export function verifyN8nJtSyncSecret(req: Request): boolean {
    const syncSecret = process.env.N8N_JT_SYNC_SECRET?.trim();
    if (!syncSecret) return false;
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
    const header = req.headers.get('x-n8n-jt-sync-secret')?.trim() ?? '';
    return bearer === syncSecret || header === syncSecret;
}

/**
 * Shared secret for the n8n AI Agent → read-only dashboard / COD tools.
 * Separate from N8N_JT_SYNC_SECRET so the AI tool credential cannot be reused
 * to write to /api/admin/jt-shipments/n8n-sync.
 *
 * Accepted on tools enumerated in src/lib/aiAgentTools.ts. Send via:
 *   Authorization: Bearer <secret>
 *   X-N8N-AI-Tools-Secret: <secret>
 */
export function verifyN8nAiToolsSecret(req: Request): boolean {
    const secret = process.env.N8N_AI_TOOLS_SECRET?.trim();
    if (!secret) return false;
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
    const header = req.headers.get('x-n8n-ai-tools-secret')?.trim() ?? '';
    return bearer === secret || header === secret;
}

/**
 * Auth gate for AI tool endpoints. Allows EITHER:
 *  1. The admin/staff session (so a logged-in admin can curl the endpoint), OR
 *  2. The n8n AI Agent bearer (N8N_AI_TOOLS_SECRET) — only when the env var is set.
 *
 * Returns a NextResponse to short-circuit the handler if neither path is satisfied.
 * Designed for GET handlers; mutating verbs should keep using requireAdminApiAuth.
 */
export async function requireAiToolAuth(request: Request): Promise<NextResponse | null> {
    if (process.env.N8N_AI_TOOLS_SECRET?.trim() && verifyN8nAiToolsSecret(request)) {
        return null;
    }
    return requireAdminApiAuth('admin-or-staff', request);
}
