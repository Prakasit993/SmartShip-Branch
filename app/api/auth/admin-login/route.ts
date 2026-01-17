import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '@app/lib/rateLimit';
import { verifyTurnstileToken } from '@app/lib/turnstile';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

// Helper function to save login attempt to database
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
        console.error('Failed to save login log:', error);
    }
}

export async function POST(request: Request) {
    // Get IP and User Agent for logging
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check rate limit FIRST
    const rateLimitResult = checkRateLimit(ip);
    if (!rateLimitResult.allowed) {
        await logger.security('ADMIN_LOGIN_RATE_LIMITED', { ip }, ip);
        await saveLoginLog(null, ip, userAgent, 'failed', 'Rate limited');
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
        const { username, password, turnstileToken } = await request.json();

        // Verify Turnstile token
        if (turnstileToken) {
            const isValidTurnstile = await verifyTurnstileToken(turnstileToken, ip);
            if (!isValidTurnstile) {
                await logger.security('ADMIN_LOGIN_TURNSTILE_FAILED', { ip }, ip);
                await saveLoginLog(username, ip, userAgent, 'failed', 'Turnstile verification failed');
                return NextResponse.json(
                    { error: 'Security verification failed. Please try again.' },
                    { status: 400 }
                );
            }
        }

        const adminUsername = process.env.ADMIN_USERNAME;
        // Support both hashed and plain password for backward compatibility
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
        const adminPasswordPlain = process.env.ADMIN_PASSWORD;

        if (!adminUsername) {
            console.error('ADMIN_USERNAME not set in environment variables');
            await logger.error('ADMIN_LOGIN_ERROR', { error: 'Env var missing' });
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (!adminPasswordHash && !adminPasswordPlain) {
            console.error('ADMIN_PASSWORD_HASH or ADMIN_PASSWORD not set in environment variables');
            await logger.error('ADMIN_LOGIN_ERROR', { error: 'Password env var missing' });
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // Check username first
        if (username !== adminUsername) {
            recordFailedAttempt(ip);
            await logger.security('ADMIN_LOGIN_FAILED', { reason: 'Invalid username', usernameAttempt: username }, ip);
            await saveLoginLog(username, ip, userAgent, 'failed', 'Invalid credentials');
            return NextResponse.json({
                error: 'Invalid username or password',
                remainingAttempts: rateLimitResult.remainingAttempts ? rateLimitResult.remainingAttempts - 1 : 0
            }, { status: 401 });
        }

        // Check password - prefer hash, fallback to plain
        let isPasswordValid = false;

        if (adminPasswordHash) {
            // Use bcrypt comparison (secure)
            isPasswordValid = await bcrypt.compare(password, adminPasswordHash);
        } else if (adminPasswordPlain) {
            // Fallback to plain comparison (less secure, for backward compatibility)
            isPasswordValid = password === adminPasswordPlain;
            console.warn('⚠️ Using plain password comparison. Consider migrating to ADMIN_PASSWORD_HASH');
        }

        if (isPasswordValid) {
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

            await logger.security('ADMIN_LOGIN_SUCCESS', {
                method: adminPasswordHash ? 'bcrypt' : 'plain',
                username
            }, ip);
            await saveLoginLog(username, ip, userAgent, 'success');
            return NextResponse.json({ success: true });
        } else {
            // Record failed attempt
            recordFailedAttempt(ip);

            await logger.security('ADMIN_LOGIN_FAILED', {
                reason: 'Invalid password',
                usernameAttempt: username,
                remainingAttempts: rateLimitResult.remainingAttempts ? rateLimitResult.remainingAttempts - 1 : 0
            }, ip);
            await saveLoginLog(username, ip, userAgent, 'failed', 'Invalid credentials');

            return NextResponse.json({
                error: 'Invalid username or password',
                remainingAttempts: rateLimitResult.remainingAttempts ? rateLimitResult.remainingAttempts - 1 : 0
            }, { status: 401 });
        }
    } catch (error) {
        await logger.error('ADMIN_LOGIN_EXCEPTION', { error: String(error) });
        await saveLoginLog(null, ip, userAgent, 'failed', String(error));
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
