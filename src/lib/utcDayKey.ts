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
