import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
    let ip = 'unknown';
    try {
        ip = request.headers.get('x-forwarded-for') || 'unknown';
    } catch (e) { }

    try {
        const { password } = await request.json();
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            console.error('ADMIN_PASSWORD not set in environment variables');
            await logger.error('ADMIN_LOGIN_ERROR', { error: 'Env var missing' });
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        if (password === adminPassword) {
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
            await logger.security('ADMIN_LOGIN_FAILED', { reason: 'Invalid password' }, ip);
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }
    } catch (error) {
        await logger.error('ADMIN_LOGIN_EXCEPTION', { error: String(error) });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
