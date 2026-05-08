import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import {
    checkRateLimit,
    recordFailedAttempt,
    clearAttempts,
    getRemainingAttempts,
} from '@app/lib/rateLimit';
import { verifyTurnstileToken } from '@app/lib/turnstile';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import {
    adminSessionContextFromRequest,
    buildAdminCookieOptions,
    getAdminSessionMaxAgeSec,
    issueAdminSessionToken,
} from '@app/lib/adminSession';

/** Precomputed hash for a random secret string — used so bcrypt runs even when username is wrong (timing). */
const BCRYPT_DUMMY_NEVER_MATCH =
    '$2b$10$vQgkeHoegSPIO0oGb9JugOskY7wZO0TV4PSqyRPV9/x92E3WQ08YO';

async function saveLoginLog(
    username: string | null,
    ip: string,
    userAgent: string,
    status: 'success' | 'failed',
    failureReason?: string
) {
    try {
        await supabaseAdmin.from('admin_login_logs').insert({
            username,
            ip_address: ip,
            user_agent: userAgent,
            status,
            failure_reason: failureReason || null,
        });
    } catch (error) {
        await logger.error('ADMIN_LOGIN_LOG_FAILED', { error: String(error) });
    }
}

export async function POST(request: Request) {
    const sessionContext = adminSessionContextFromRequest(request);
    const ip = sessionContext.ip;
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const rateLimitResult = checkRateLimit(ip);
    if (!rateLimitResult.allowed) {
        await logger.security('ADMIN_LOGIN_RATE_LIMITED', { ip }, ip);
        void saveLoginLog(null, ip, userAgent, 'failed', 'Rate limited');
        return NextResponse.json(
            {
                error: `Too many login attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
                retryAfter: rateLimitResult.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimitResult.retryAfter),
                },
            }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (body === null || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { username, password, turnstileToken } = body as Record<string, unknown>;
    if (typeof username !== 'string' || typeof password !== 'string') {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const turnstileConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
    if (turnstileConfigured) {
        if (typeof turnstileToken !== 'string' || !turnstileToken.trim()) {
            await logger.security('ADMIN_LOGIN_TURNSTILE_MISSING', { ip }, ip);
            void saveLoginLog(username, ip, userAgent, 'failed', 'Turnstile token missing');
            return NextResponse.json(
                { error: 'Security verification required. Please complete the challenge.' },
                { status: 400 }
            );
        }
        const isValidTurnstile = await verifyTurnstileToken(turnstileToken, ip);
        if (!isValidTurnstile) {
            await logger.security('ADMIN_LOGIN_TURNSTILE_FAILED', { ip }, ip);
            void saveLoginLog(username, ip, userAgent, 'failed', 'Turnstile verification failed');
            return NextResponse.json(
                { error: 'Security verification failed. Please try again.' },
                { status: 400 }
            );
        }
    }

    const rawAdminUsername = process.env.ADMIN_USERNAME;
    if (!rawAdminUsername?.trim()) {
        await logger.error('ADMIN_LOGIN_ERROR', { error: 'ADMIN_USERNAME missing' });
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const adminUsername = rawAdminUsername.trim();

    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
    const adminPasswordPlain = process.env.ADMIN_PASSWORD;

    if (!adminPasswordHash && !adminPasswordPlain) {
        await logger.error('ADMIN_LOGIN_ERROR', { error: 'No admin password configured' });
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const usernameOk = username.trim() === adminUsername;

    let isPasswordValid = false;
    if (adminPasswordHash) {
        const hashToCompare = usernameOk ? adminPasswordHash : BCRYPT_DUMMY_NEVER_MATCH;
        isPasswordValid = usernameOk && (await bcrypt.compare(password, hashToCompare));
    } else if (adminPasswordPlain) {
        if (process.env.NODE_ENV === 'production') {
            console.warn(
                '[security] ADMIN_PASSWORD (plain) is weak; migrate to ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET.'
            );
        }
        isPasswordValid = usernameOk && password === adminPasswordPlain;
    }

    if (!isPasswordValid) {
        recordFailedAttempt(ip);
        const remaining = getRemainingAttempts(ip);
        await logger.security(
            'ADMIN_LOGIN_FAILED',
            { usernameAttempt: username, remainingAttempts: remaining },
            ip
        );
        void saveLoginLog(username, ip, userAgent, 'failed', 'Invalid credentials');

        return NextResponse.json(
            {
                error: 'Invalid username or password',
                remainingAttempts: remaining,
            },
            { status: 401 }
        );
    }

    clearAttempts(ip);

    const maxAgeSec = getAdminSessionMaxAgeSec();
    const sessionValue = await issueAdminSessionToken(maxAgeSec, sessionContext);
    const cookieOpts = buildAdminCookieOptions(maxAgeSec);

    const cookieStore = await cookies();
    cookieStore.set('admin_session', sessionValue, cookieOpts);
    cookieStore.set('admin_role', 'admin', cookieOpts);

    await logger.security(
        'ADMIN_LOGIN_SUCCESS',
        {
            method: adminPasswordHash ? 'bcrypt' : 'plain',
            username,
            signedSession: sessionValue !== 'admin',
        },
        ip
    );
    await saveLoginLog(username, ip, userAgent, 'success');

    return NextResponse.json({
        success: true,
        expiresInSec: maxAgeSec,
    });
}
