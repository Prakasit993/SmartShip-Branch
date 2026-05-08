const SESSION_VERSION = '2';

/** Cookie max-age in seconds — override with ADMIN_SESSION_MAX_AGE_SEC */
export function getAdminSessionMaxAgeSec(): number {
    const raw = process.env.ADMIN_SESSION_MAX_AGE_SEC;
    if (!raw) return 60 * 60;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 300 && n <= 60 * 60 * 24 * 14 ? n : 60 * 60;
}

/**
 * Prefer ADMIN_SESSION_SECRET; else derive from ADMIN_PASSWORD_HASH so deploys without extra env still get signed cookies.
 * Plain ADMIN_PASSWORD-only setups should set ADMIN_SESSION_SECRET in production.
 */
export function resolveAdminSessionSecret(): string | null {
    const explicit = process.env.ADMIN_SESSION_SECRET?.trim();
    if (explicit) return explicit;
    const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
    if (hash) return hash;
    return process.env.ADMIN_PASSWORD?.trim() || null;
}

export function buildAdminCookieOptions(maxAgeSec: number) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: maxAgeSec,
        path: '/',
    };
}

export type AdminSessionContext = {
    ip: string;
    userAgent: string;
};

function clientIpFromHeaders(headers: Headers): string {
    return (
        headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        headers.get('x-real-ip')?.trim() ||
        'unknown'
    );
}

export function adminSessionContextFromRequest(request: Request): AdminSessionContext {
    return {
        ip: clientIpFromHeaders(request.headers),
        userAgent: request.headers.get('user-agent')?.trim() || 'unknown',
    };
}

function normalizeIpForBinding(ip: string): string {
    const mode = (process.env.ADMIN_SESSION_IP_BIND_MODE || 'subnet').toLowerCase();
    if (mode === 'none') return 'ip:none';
    if (mode === 'exact') return `ip:${ip}`;

    const ipv4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
    if (ipv4) return `ip:${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.0/24`;

    const ipv6Parts = ip.split(':');
    if (ipv6Parts.length >= 4) return `ip:${ipv6Parts.slice(0, 4).join(':')}::/64`;

    return `ip:${ip}`;
}

function bytesToBase64Url(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array | null {
    try {
        let base64 = s.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4;
        if (pad) base64 += '='.repeat(4 - pad);
        const bin = atob(base64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    } catch {
        return null;
    }
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
    const enc = new TextEncoder();
    const keyMaterial = enc.encode(secret);
    const msgBytes = enc.encode(message);
    const key = await crypto.subtle.importKey(
        'raw',
        keyMaterial.buffer.slice(
            keyMaterial.byteOffset,
            keyMaterial.byteOffset + keyMaterial.byteLength
        ),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign(
        'HMAC',
        key,
        msgBytes.buffer.slice(msgBytes.byteOffset, msgBytes.byteOffset + msgBytes.byteLength)
    );
    return bytesToBase64Url(sig);
}

async function contextFingerprint(secret: string, context: AdminSessionContext): Promise<string> {
    const userAgent = context.userAgent.trim().slice(0, 300);
    const ipKey = normalizeIpForBinding(context.ip.trim() || 'unknown');
    return hmacSha256Base64Url(secret, `admin-session-context:${userAgent}|${ipKey}`);
}

/** Issue signed token bound to the current browser/network context. Edge-safe (Web Crypto). */
export async function issueAdminSessionToken(
    maxAgeSec: number,
    context: AdminSessionContext
): Promise<string> {
    const secret = resolveAdminSessionSecret();
    const expUnix = Math.floor(Date.now() / 1000) + maxAgeSec;
    if (!secret) return 'admin';
    const fp = await contextFingerprint(secret, context);
    const payload = `${SESSION_VERSION}:${expUnix}:${fp}`;
    const sig = await hmacSha256Base64Url(secret, payload);
    return `${payload}.${sig}`;
}

/** Edge-safe verification (crypto.subtle, no Node `crypto`). */
export async function verifyAdminSessionToken(
    token: string,
    context: AdminSessionContext
): Promise<boolean> {
    const secret = resolveAdminSessionSecret();
    if (!secret) {
        return token === 'admin' || token === 'true';
    }

    const dot = token.lastIndexOf('.');
    if (dot <= 0 || dot === token.length - 1) return false;

    const payload = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const parts = payload.split(':');
    if (parts.length !== 3 || parts[0] !== SESSION_VERSION) return false;

    const expUnix = Number(parts[1]);
    if (!Number.isFinite(expUnix) || expUnix < Math.floor(Date.now() / 1000)) return false;

    const expectedFingerprint = await contextFingerprint(secret, context);
    const gotFingerprint = base64UrlToBytes(parts[2]);
    const expectedFingerprintBytes = base64UrlToBytes(expectedFingerprint);
    if (gotFingerprint == null || expectedFingerprintBytes == null) return false;
    if (!timingSafeEqualBytes(gotFingerprint, expectedFingerprintBytes)) return false;

    const expectedB64 = await hmacSha256Base64Url(secret, payload);
    const got = base64UrlToBytes(sigB64);
    const expected = base64UrlToBytes(expectedB64);
    if (got == null || expected == null) return false;
    return timingSafeEqualBytes(got, expected);
}

/** Password-based admin session: signed cookie bound to the current request context. */
export async function isPasswordAdminSessionCookie(
    value: string | undefined,
    context: AdminSessionContext
): Promise<boolean> {
    if (value == null || value === '') return false;
    if (resolveAdminSessionSecret()) {
        return verifyAdminSessionToken(value, context);
    }
    return verifyAdminSessionToken(value, context);
}
