import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import {
    adminSessionContextFromRequest,
    buildAdminCookieOptions,
    getAdminSessionMaxAgeSec,
    issueAdminSessionToken,
} from '@app/lib/adminSession';

const rpName = 'SmartShip Admin';

/** Challenge ต้องอยู่ระหว่าง GET (options) กับ POST (verify) — ใช้ cookie แทน Map ในหน่วยความจำ เพื่อให้ dev / serverless ไม่หลุดคนละ process */
const WEBAUTHN_CHALLENGE_COOKIE = 'admin_webauthn_challenge';
const CHALLENGE_MAX_AGE_SEC = 300;

function challengeCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: CHALLENGE_MAX_AGE_SEC,
        path: '/',
    };
}

/** ใช้ Origin จากเบราว์เซอร์เป็นหลัก ให้ตรงกับ host ที่ผู้ใช้เปิดจริง (localhost vs 127.0.0.1 ฯลฯ) */
function webauthnOriginAndRpId(request: Request): { origin: string; rpID: string } {
    const originHeader = request.headers.get('origin')?.trim();
    if (originHeader) {
        try {
            const u = new URL(originHeader);
            return { origin: u.origin, rpID: u.hostname };
        } catch {
            /* fall through */
        }
    }

    const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (envUrl) {
        const u = new URL(envUrl);
        return { origin: u.origin, rpID: u.hostname };
    }

    return { origin: 'http://localhost:3000', rpID: 'localhost' };
}

function jsonWithClearedChallenge(body: unknown, init?: ResponseInit) {
    const res = NextResponse.json(body, init);
    res.cookies.delete(WEBAUTHN_CHALLENGE_COOKIE);
    return res;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const adminEmail = process.env.ADMIN_USERNAME;

    if (!adminEmail) {
        return NextResponse.json({ error: 'Admin not configured' }, { status: 500 });
    }

    const { origin, rpID } = webauthnOriginAndRpId(request);

    if (action === 'register') {
        const { data: existingCredentials } = await supabaseAdmin
            .from('webauthn_credentials')
            .select('credential_id')
            .eq('admin_email', adminEmail);

        const excludeCredentials = (existingCredentials || []).map((cred) => ({
            id: cred.credential_id,
            type: 'public-key' as const,
        }));

        const options = await generateRegistrationOptions({
            rpName,
            rpID,
            userName: adminEmail,
            userDisplayName: 'Admin',
            attestationType: 'none',
            excludeCredentials,
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'preferred',
            },
        });

        const res = NextResponse.json(options);
        res.cookies.set(WEBAUTHN_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions());
        return res;
    }

    if (action === 'authenticate') {
        const { data: credentials } = await supabaseAdmin
            .from('webauthn_credentials')
            .select('credential_id')
            .eq('admin_email', adminEmail);

        if (!credentials || credentials.length === 0) {
            return NextResponse.json({ error: 'No fingerprint registered' }, { status: 404 });
        }

        const allowCredentials = credentials.map((cred) => ({
            id: cred.credential_id,
            type: 'public-key' as const,
        }));

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials,
            userVerification: 'required',
        });

        const res = NextResponse.json(options);
        res.cookies.set(WEBAUTHN_CHALLENGE_COOKIE, options.challenge, challengeCookieOptions());
        return res;
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const adminEmail = process.env.ADMIN_USERNAME;

    if (!adminEmail) {
        return NextResponse.json({ error: 'Admin not configured' }, { status: 500 });
    }

    const { origin: expectedOrigin, rpID: expectedRPID } = webauthnOriginAndRpId(request);

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE)?.value ?? null;

    if (!expectedChallenge) {
        return jsonWithClearedChallenge({ error: 'Challenge expired' }, { status: 400 });
    }

    try {
        if (action === 'register') {
            const body = await request.json();

            const verification = await verifyRegistrationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin,
                expectedRPID,
            });

            if (verification.verified && verification.registrationInfo) {
                const { credential } = verification.registrationInfo;

                await supabaseAdmin.from('webauthn_credentials').insert({
                    id: crypto.randomUUID(),
                    admin_email: adminEmail,
                    credential_id: credential.id,
                    public_key: Buffer.from(credential.publicKey).toString('base64'),
                    counter: credential.counter,
                    device_name: 'Fingerprint Device',
                });

                return jsonWithClearedChallenge({ verified: true });
            }

            return jsonWithClearedChallenge({ error: 'Verification failed' }, { status: 400 });
        }

        if (action === 'authenticate') {
            const body = await request.json();

            const { data: credentialData } = await supabaseAdmin
                .from('webauthn_credentials')
                .select('*')
                .eq('credential_id', body.id)
                .single();

            if (!credentialData) {
                return jsonWithClearedChallenge({ error: 'Credential not found' }, { status: 404 });
            }

            const verification = await verifyAuthenticationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin,
                expectedRPID,
                credential: {
                    id: credentialData.credential_id,
                    publicKey: Buffer.from(credentialData.public_key, 'base64'),
                    counter: credentialData.counter,
                },
            });

            if (verification.verified) {
                await supabaseAdmin
                    .from('webauthn_credentials')
                    .update({ counter: verification.authenticationInfo.newCounter })
                    .eq('id', credentialData.id);

                const maxAgeSec = getAdminSessionMaxAgeSec();
                const sessionToken = await issueAdminSessionToken(maxAgeSec, adminSessionContextFromRequest(request));
                const cookieOpts = buildAdminCookieOptions(maxAgeSec);

                const res = NextResponse.json({ verified: true });
                res.cookies.delete(WEBAUTHN_CHALLENGE_COOKIE);
                res.cookies.set('admin_session', sessionToken, cookieOpts);
                res.cookies.set('admin_role', 'admin', cookieOpts);

                const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
                const userAgent = request.headers.get('user-agent') || 'unknown';
                await supabaseAdmin.from('admin_login_logs').insert({
                    username: adminEmail,
                    ip_address: ip,
                    user_agent: userAgent,
                    status: 'success',
                    failure_reason: null,
                });

                return res;
            }

            return jsonWithClearedChallenge({ error: 'Authentication failed' }, { status: 401 });
        }
    } catch (error) {
        console.error('WebAuthn error:', error);
        return jsonWithClearedChallenge({ error: 'WebAuthn error' }, { status: 500 });
    }

    return jsonWithClearedChallenge({ error: 'Invalid action' }, { status: 400 });
}
