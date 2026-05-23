/**
 * Date-window helpers for filtering on `booking_date`
 * (stored as text "YYYY-MM-DD HH:MM:SS" — string compare is valid).
 *
 * Shared by the TikTok stats/issues/stagnant routes and the dashboard
 * date picker so the 14-day window is computed the same way everywhere.
 */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Return the input if it's a valid YYYY-MM-DD string, else null. */
export function normalizeYmd(value: string | null | undefined): string | null {
    if (!value) return null;
    const v = value.trim();
    return YMD_RE.test(v) ? v : null;
}

/** Add `days` (may be negative) to a YYYY-MM-DD string → YYYY-MM-DD (UTC-safe). */
export function ymdAddDays(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
}

/**
 * Parse `?date_from` / `?date_to` (inclusive YMD) from a request URL into a
 * booking_date window. `toExclusive` is the day AFTER date_to so the string
 * compare `booking_date < toExclusive` includes the whole end day.
 */
export function parseBookingWindow(requestUrl: string): {
    from: string | null;
    toExclusive: string | null;
} {
    const sp = new URL(requestUrl).searchParams;
    const from = normalizeYmd(sp.get('date_from'));
    const to = normalizeYmd(sp.get('date_to'));
    return { from, toExclusive: to ? ymdAddDays(to, 1) : null };
}
