/** Shared types / helpers for J&T dashboard chart period (no React, no browser APIs). */

export const JT_CHART_WINDOW_OPTIONS = [30, 90, 180, 365] as const;

export type JtChartPeriod =
    | { kind: 'rolling'; days: (typeof JT_CHART_WINDOW_OPTIONS)[number] }
    | { kind: 'month'; ym: string }
    | { kind: 'range'; from: string; to: string };

export function buildJtStatsSearchParams(period: JtChartPeriod): string {
    const p = new URLSearchParams();
    if (period.kind === 'rolling') {
        p.set('window_days', String(period.days));
    } else if (period.kind === 'month') {
        p.set('chart_month', period.ym);
    } else {
        p.set('chart_from', period.from);
        p.set('chart_to', period.to);
    }
    return p.toString();
}

export function defaultUtcMonthYm(): string {
    const n = new Date();
    return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function defaultUtcMonthRange(): { from: string; to: string } {
    const y = new Date().getUTCFullYear();
    const m = new Date().getUTCMonth() + 1;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const pad = (x: number) => String(x).padStart(2, '0');
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}
