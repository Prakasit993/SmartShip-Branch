import { NextResponse } from 'next/server';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
    /** Max requests allowed within the window. */
    limit: number;
    /** Window duration in milliseconds. */
    windowMs: number;
}

interface RateLimitEntry {
    /** Timestamps (ms) of requests within the current window. */
    timestamps: number[];
}

// ── Presets (per-route overrides) ────────────────────────────────────────────
// Routes can import a preset and pass it to `applyRateLimit`.

/** Default: 100 req / 60s per IP (normal browsing). */
export const RATE_LIMIT_DEFAULT: RateLimitConfig = { limit: 100, windowMs: 60_000 };

/** Tighter: 30 req / 60s — for mutating endpoints (POST, PUT, DELETE). */
export const RATE_LIMIT_MUTATE: RateLimitConfig = { limit: 30, windowMs: 60_000 };

/** Strict: 10 req / 60s — for bulk/destructive endpoints (mass delete, import, n8n-sync). */
export const RATE_LIMIT_BULK: RateLimitConfig = { limit: 10, windowMs: 60_000 };

/** Very strict: 5 req / 60s — for extremely sensitive operations. */
export const RATE_LIMIT_CRITICAL: RateLimitConfig = { limit: 5, windowMs: 60_000 };

// ── In-memory store ──────────────────────────────────────────────────────────
// Key = "<route-prefix>:<identifier>" to allow per-route windowing.
// NOTE: In a multi-instance deployment (e.g. Vercel serverless) each instance
// gets its own store — effective per-process but not globally. For true global
// limiting, swap this Map for a Redis-backed store.

const store = new Map<string, RateLimitEntry>();

/** Periodically purge expired entries to prevent unbounded memory growth. */
const CLEANUP_INTERVAL_MS = 5 * 60_000; // every 5 min
let lastCleanup = Date.now();

function maybeCleanup(windowMs: number): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    const cutoff = now - windowMs;
    for (const [key, entry] of store) {
        // Remove entries whose newest timestamp is older than any active window
        if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
            store.delete(key);
        }
    }
}

// ── Core logic ───────────────────────────────────────────────────────────────

/**
 * Extract a best-effort client identifier from the request.
 * Prefers X-Forwarded-For (first hop) → X-Real-IP → falls back to a generic
 * key so rate limiting still applies (just shared across all unknown clients).
 */
export function getClientIdentifier(req: Request): string {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0].trim();
        if (first) return first;
    }
    const realIp = req.headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
    return '__unknown__';
}

/**
 * Check rate limit for a request. Returns `null` if within limits,
 * or a `429 Too Many Requests` NextResponse if exceeded.
 *
 * @param req     - Incoming request
 * @param route   - Logical route key (used to scope windows, e.g. "jt-shipments:DELETE")
 * @param config  - Rate limit configuration (use a preset or custom)
 */
export function checkRateLimit(
    req: Request,
    route: string,
    config: RateLimitConfig = RATE_LIMIT_DEFAULT,
): NextResponse | null {
    const id = getClientIdentifier(req);
    const key = `${route}:${id}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    maybeCleanup(config.windowMs);

    let entry = store.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
    }

    // Slide the window: remove timestamps older than the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= config.limit) {
        const retryAfterSec = Math.ceil(
            (entry.timestamps[0] + config.windowMs - now) / 1000,
        );
        return NextResponse.json(
            {
                error: 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง',
                retry_after_seconds: Math.max(retryAfterSec, 1),
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(Math.max(retryAfterSec, 1)),
                    'X-RateLimit-Limit': String(config.limit),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(
                        Math.ceil((entry.timestamps[0] + config.windowMs) / 1000),
                    ),
                },
            },
        );
    }

    entry.timestamps.push(now);
    return null;
}

/**
 * Convenience: apply rate limiting inside a route handler.
 * Returns a 429 response if rate limit exceeded, otherwise null.
 *
 * Usage:
 * ```ts
 * const limited = applyRateLimit(req, 'jt-shipments:GET', RATE_LIMIT_DEFAULT);
 * if (limited) return limited;
 * ```
 */
export function applyRateLimit(
    req: Request,
    route: string,
    config?: RateLimitConfig,
): NextResponse | null {
    return checkRateLimit(req, route, config);
}
