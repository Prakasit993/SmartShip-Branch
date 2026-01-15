/**
 * Simple in-memory rate limiter for admin login
 * Tracks failed attempts per IP and enforces lockout
 */

interface LoginAttempt {
    count: number;
    firstAttempt: number;
    lockedUntil: number | null;
}

// In-memory store (resets on server restart - for production use Redis)
const loginAttempts = new Map<string, LoginAttempt>();

// Configuration
const MAX_ATTEMPTS = 5;          // Max failed attempts before lockout
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number; remainingAttempts?: number } {
    const now = Date.now();
    const attempt = loginAttempts.get(ip);

    // No previous attempts
    if (!attempt) {
        return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    // Check if locked out
    if (attempt.lockedUntil && now < attempt.lockedUntil) {
        const retryAfter = Math.ceil((attempt.lockedUntil - now) / 1000);
        return { allowed: false, retryAfter };
    }

    // Check if window expired (reset)
    if (now - attempt.firstAttempt > WINDOW_MS) {
        loginAttempts.delete(ip);
        return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    // Check attempts within window
    if (attempt.count >= MAX_ATTEMPTS) {
        // Lock out
        attempt.lockedUntil = now + LOCKOUT_MS;
        loginAttempts.set(ip, attempt);
        const retryAfter = Math.ceil(LOCKOUT_MS / 1000);
        return { allowed: false, retryAfter };
    }

    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - attempt.count };
}

export function recordFailedAttempt(ip: string): void {
    const now = Date.now();
    const attempt = loginAttempts.get(ip);

    if (!attempt || now - attempt.firstAttempt > WINDOW_MS) {
        // New window
        loginAttempts.set(ip, {
            count: 1,
            firstAttempt: now,
            lockedUntil: null
        });
    } else {
        // Increment within window
        attempt.count++;
        loginAttempts.set(ip, attempt);
    }
}

export function clearAttempts(ip: string): void {
    loginAttempts.delete(ip);
}

// Cleanup old entries periodically (every 30 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [ip, attempt] of loginAttempts.entries()) {
        if (now - attempt.firstAttempt > WINDOW_MS * 2) {
            loginAttempts.delete(ip);
        }
    }
}, 30 * 60 * 1000);
