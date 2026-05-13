/**
 * Shared date and formatting utilities for the J&T deep-dive dashboard.
 *
 * Previously duplicated across FinancialTab.tsx and SLATab.tsx —
 * consolidated here so both tabs import from a single source.
 */

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

export function toYmd(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function addDays(d: Date, days: number): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
}

export function addMonths(d: Date, months: number): Date {
    const next = new Date(d);
    next.setMonth(next.getMonth() + months);
    return next;
}

/** Always returns the 1st of the target month (safe for calendar navigation). */
export function addCalendarMonths(d: Date, months: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + months, 1);
}

export function parseLocalYmd(ymd: string): Date | null {
    const [year, month, day] = ymd.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
}

export function monthStartFromYmd(ymd: string): Date {
    const date = parseLocalYmd(ymd) ?? new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthRange(date: Date): { from: string; to: string } {
    const from = new Date(date.getFullYear(), date.getMonth(), 1);
    const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: toYmd(from), to: toYmd(to) };
}

export function formatCalendarMonth(date: Date): string {
    return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Number / currency formatting                                       */
/* ------------------------------------------------------------------ */

export function formatThb(value: number): string {
    return value.toLocaleString('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 2,
    });
}

export function formatThbCompact(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${value < 0 ? '-' : ''}${Math.round(abs / 1_000)}K`;
    return Math.round(value).toLocaleString('th-TH');
}

export function formatCount(value: number): string {
    return value.toLocaleString('th-TH');
}

export function formatCountWithUnit(value: number, unit = 'ชิ้น'): string {
    return `${value.toLocaleString('th-TH')} ${unit}`;
}

export function formatDayLabel(ymd: string): string {
    const t = Date.parse(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(t)) return ymd;
    return new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function formatThaiDateRange(range: { from: string; to: string }): string {
    const format = (ymd: string) => {
        const t = Date.parse(`${ymd}T12:00:00.000Z`);
        if (Number.isNaN(t)) return ymd;
        return new Date(t).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return range.from === range.to ? format(range.from) : `${format(range.from)} ถึง ${format(range.to)}`;
}

export function pct(value: number, total: number): string {
    if (total <= 0) return '0%';
    return `${Math.round((value / total) * 1000) / 10}%`;
}
