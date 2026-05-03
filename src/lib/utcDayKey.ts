/**
 * Bucket timestamptz values by **UTC calendar day** (YYYY-MM-DD).
 * Use the same rules for both the 30-day axis and per-row keys so counts line up.
 */
export function utcDayKeyFromMs(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

export function utcDayKeyFromIso(iso: string | null | undefined): string | null {
    if (iso == null || iso === '') return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    return utcDayKeyFromMs(t);
}

/** Inclusive range of `days` UTC days ending at anchor’s UTC calendar day (newest last). */
export function buildUtcDayWindow(anchorMs: number, days: number): { keys: string[]; startIso: string } {
    const anchor = new Date(anchorMs);
    const y = anchor.getUTCFullYear();
    const m = anchor.getUTCMonth();
    const d = anchor.getUTCDate();
    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const x = new Date(Date.UTC(y, m, d - i));
        keys.push(x.toISOString().slice(0, 10));
    }
    const startIso = `${keys[0]}T00:00:00.000Z`;
    return { keys, startIso };
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Every UTC calendar day from `fromYmd` through `toYmd` inclusive (YYYY-MM-DD). Max `maxDays` keys. */
export function buildUtcDayKeysInclusiveRange(fromYmd: string, toYmd: string, maxDays = 400): string[] | null {
    const a = YMD.exec(fromYmd.trim());
    const b = YMD.exec(toYmd.trim());
    if (!a || !b) return null;
    const start = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]), 0, 0, 0, 0);
    const end = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]), 0, 0, 0, 0);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end) return null;
    const keys: string[] = [];
    let t = start;
    let n = 0;
    while (t <= end && n < maxDays) {
        keys.push(new Date(t).toISOString().slice(0, 10));
        t += 86400000;
        n += 1;
    }
    return keys.length ? keys : null;
}

/** All UTC calendar days in `yyyy-mm` (Gregorian month). */
export function buildUtcDayKeysForMonth(ym: string): string[] | null {
    const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) return null;
    const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const keys: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
        keys.push(new Date(Date.UTC(y, mo - 1, d)).toISOString().slice(0, 10));
    }
    return keys.length ? keys : null;
}

/** First UTC calendar day strictly after `ymd` (YYYY-MM-DD), for exclusive upper bounds on text `booking_date`. */
export function nextUtcCalendarDayYmd(ymd: string): string {
    const a = YMD.exec(ymd.trim());
    if (!a) return ymd;
    const t = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]) + 1, 0, 0, 0, 0);
    return new Date(t).toISOString().slice(0, 10);
}
