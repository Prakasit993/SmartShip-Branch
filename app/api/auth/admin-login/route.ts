import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@app/lib/rateLimit';
import { verifyTurnstileToken } from '@app/lib/turnstile';

export async function POST(request: Request) {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';

    // Check rate limit FIRST
    const rateLimitResult = checkRateLimit(ip);
    if (!rateLimitResult.allowed) {
        await logger.security('ADMIN_LOGIN_RATE_LIMITED', { ip }, ip);
        return NextResponse.json(
            {
                error: `Too many login attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`,
                retryAfter: rateLimitResult.retryAfter
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimitResult.retryAfter)
                }
            }
        );
    }

    try {
        const { password, turnstileToken } = await request.json();

        // Verify Turnstile token
        if (turnstileToken) {
            const isValidTurnstile = await verifyTurnstileToken(turnstileToken, ip);
            if (!isValidTurnstile) {
                await logger.security('ADMIN_LOGIN_TURNSTILE_FAILED', { ip }, ip);
                return NextResponse.json(
                    { error: 'Security verification failed. Please try again.' },
                    { status: 400 }
                );
            }
        }

        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            console.error('ADMIN_PASSWORD not set in environment variables');
            await logger.error('ADMIN_LOGIN_ERROR', { error: 'Env var missing' });
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (password === adminPassword) {
            // Clear failed attempts on successful login
            clearAttempts(ip);

            const cookieStore = await cookies();

            cookieStore.set('admin_session', 'admin', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24, // 1 day
                path: '/',
            });

            await logger.security('ADMIN_LOGIN_SUCCESS', { method: 'password' }, ip);
            return NextResponse.json({ success: true });
        } else {
            // Record failed attempt
            recordFailedAttempt(ip);

            await logger.security('ADMIN_LOGIN_FAILED', {
                reason: 'Invalid password',
                remainingAttempts: rateLimitResult.remainingAttempts ? rateLimitResult.remainingAttempts - 1 : 0
            }, ip);

            return NextResponse.json({
                error: 'Invalid password',
                remainingAttempts: rateLimitResult.remainingAttempts ? rateLimitResult.remainingAttempts - 1 : 0
            }, { status: 401 });
        }
    } catch (error) {
        await logger.error('ADMIN_LOGIN_EXCEPTION', { error: String(error) });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
