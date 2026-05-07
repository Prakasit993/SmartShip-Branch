const SESSION_VERSION = '1';

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

/** Issue signed token, or legacy fixed value when no secret material exists (local dev only). Edge-safe (Web Crypto). */
export async function issueAdminSessionToken(maxAgeSec: number): Promise<string> {
    const secret = resolveAdminSessionSecret();
    const expUnix = Math.floor(Date.now() / 1000) + maxAgeSec;
    if (!secret) return 'admin';
    const payload = `${SESSION_VERSION}:${expUnix}`;
    const sig = await hmacSha256Base64Url(secret, payload);
    return `${payload}.${sig}`;
}

/** Edge-safe verification (crypto.subtle, no Node `crypto`). */
export async function verifyAdminSessionToken(token: string): Promise<boolean> {
    const secret = resolveAdminSessionSecret();
    if (!secret) {
        return token === 'admin' || token === 'true';
    }

    const dot = token.lastIndexOf('.');
    if (dot <= 0 || dot === token.length - 1) return false;

    const payload = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);
    const parts = payload.split(':');
    if (parts.length !== 2 || parts[0] !== SESSION_VERSION) return false;

    const expUnix = Number(parts[1]);
    if (!Number.isFinite(expUnix) || expUnix < Math.floor(Date.now() / 1000)) return false;

    const expectedB64 = await hmacSha256Base64Url(secret, payload);
    const got = base64UrlToBytes(sigB64);
    const expected = base64UrlToBytes(expectedB64);
    if (got == null || expected == null) return false;
    return timingSafeEqualBytes(got, expected);
}

/**
 * Password-based admin session: signed cookie, or legacy `admin` / `true` (older deploys until cookies rotate).
 */
export async function isPasswordAdminSessionCookie(value: string | undefined): Promise<boolean> {
    if (value == null || value === '') return false;
    if (resolveAdminSessionSecret()) {
        return (await verifyAdminSessionToken(value)) || value === 'admin' || value === 'true';
    }
    return verifyAdminSessionToken(value);
}
