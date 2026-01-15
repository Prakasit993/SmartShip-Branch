import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

// WebAuthn configuration
const rpName = 'SmartShip Admin';
const rpID = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
    : 'localhost';
const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Store challenge temporarily (in production, use Redis or database)
const challengeStore = new Map<string, string>();

// Generate registration options
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const adminEmail = process.env.ADMIN_USERNAME;

    if (!adminEmail) {
        return NextResponse.json({ error: 'Admin not configured' }, { status: 500 });
    }

    if (action === 'register') {
        // Get existing credentials
        const { data: existingCredentials } = await supabaseAdmin
            .from('webauthn_credentials')
            .select('credential_id')
            .eq('admin_email', adminEmail);

        const excludeCredentials = (existingCredentials || []).map(cred => ({
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

        // Store challenge
        challengeStore.set(adminEmail, options.challenge);

        return NextResponse.json(options);
    }

    if (action === 'authenticate') {
        // Get existing credentials for this admin
        const { data: credentials } = await supabaseAdmin
            .from('webauthn_credentials')
            .select('credential_id')
            .eq('admin_email', adminEmail);

        if (!credentials || credentials.length === 0) {
            return NextResponse.json({ error: 'No fingerprint registered' }, { status: 404 });
        }

        const allowCredentials = credentials.map(cred => ({
            id: cred.credential_id,
            type: 'public-key' as const,
        }));

        const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials,
            userVerification: 'required',
        });

        // Store challenge
        challengeStore.set(adminEmail, options.challenge);

        return NextResponse.json(options);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// Verify registration or authentication
export async function POST(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const adminEmail = process.env.ADMIN_USERNAME;

    if (!adminEmail) {
        return NextResponse.json({ error: 'Admin not configured' }, { status: 500 });
    }

    const expectedChallenge = challengeStore.get(adminEmail);
    if (!expectedChallenge) {
        return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
    }

    try {
        if (action === 'register') {
            const body = await request.json();

            const verification = await verifyRegistrationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
            });

            if (verification.verified && verification.registrationInfo) {
                const { credential } = verification.registrationInfo;

                // Save credential to database
                await supabaseAdmin.from('webauthn_credentials').insert({
                    id: crypto.randomUUID(),
                    admin_email: adminEmail,
                    credential_id: credential.id,
                    public_key: Buffer.from(credential.publicKey).toString('base64'),
                    counter: credential.counter,
                    device_name: 'Fingerprint Device',
                });

                // Clear challenge
                challengeStore.delete(adminEmail);

                return NextResponse.json({ verified: true });
            }

            return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
        }

        if (action === 'authenticate') {
            const body = await request.json();

            // Get credential from database
            const { data: credentialData } = await supabaseAdmin
                .from('webauthn_credentials')
                .select('*')
                .eq('credential_id', body.id)
                .single();

            if (!credentialData) {
                return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
            }

            const verification = await verifyAuthenticationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin: origin,
                expectedRPID: rpID,
                credential: {
                    id: credentialData.credential_id,
                    publicKey: Buffer.from(credentialData.public_key, 'base64'),
                    counter: credentialData.counter,
                },
            });

            if (verification.verified) {
                // Update counter
                await supabaseAdmin
                    .from('webauthn_credentials')
                    .update({ counter: verification.authenticationInfo.newCounter })
                    .eq('id', credentialData.id);

                // Clear challenge
                challengeStore.delete(adminEmail);

                // Set admin session cookie
                const cookieStore = await cookies();
                cookieStore.set('admin_session', 'admin', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 60 * 60 * 24,
                    path: '/',
                });

                // Log the login
                const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
                const userAgent = request.headers.get('user-agent') || 'unknown';
                await supabaseAdmin.from('admin_login_logs').insert({
                    username: adminEmail,
                    ip_address: ip,
                    user_agent: userAgent,
                    status: 'success',
                    failure_reason: null,
                });

                return NextResponse.json({ verified: true });
            }

            return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
        }
    } catch (error) {
        console.error('WebAuthn error:', error);
        return NextResponse.json({ error: 'WebAuthn error' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
