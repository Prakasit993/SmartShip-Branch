import type { JtCustomMetricCardDefinition } from '@/lib/jtCustomMetricCards';
import { parseJtMoneyText } from '@/lib/jtMoneyText';

export type CustomMetricComputed = {
    id: string;
    title: string;
    subtitle?: string;
    icon: string;
    raw: number;
    format: 'count' | 'thb';
};

function rowMatchesFilter(
    row: Record<string, unknown>,
    filter: JtCustomMetricCardDefinition['filter'],
): boolean {
    if (!filter?.pattern) return true;
    const cell = String(row[filter.column] ?? '');
    if (filter.mode === 'contains') return cell.includes(filter.pattern);
    try {
        return new RegExp(filter.pattern, 'i').test(cell);
    } catch {
        return false;
    }
}

export type MetricAcc =
    | { t: 'count'; n: number }
    | { t: 'sum'; sum: number }
    | { t: 'avg'; sum: number; n: number };

export function createMetricAccumulators(defs: JtCustomMetricCardDefinition[]): Map<string, MetricAcc> {
    const m = new Map<string, MetricAcc>();
    for (const d of defs) {
        if (d.agg === 'count') m.set(d.id, { t: 'count', n: 0 });
        else if (d.agg === 'sum') m.set(d.id, { t: 'sum', sum: 0 });
        else m.set(d.id, { t: 'avg', sum: 0, n: 0 });
    }
    return m;
}

export function feedCustomMetricRow(
    acc: Map<string, MetricAcc>,
    row: Record<string, unknown>,
    defs: JtCustomMetricCardDefinition[],
): void {
    for (const d of defs) {
        if (!rowMatchesFilter(row, d.filter)) continue;
        const a = acc.get(d.id);
        if (!a) continue;
        if (d.agg === 'count') {
            if (a.t === 'count') a.n += 1;
        } else if (d.agg === 'sum') {
            if (a.t !== 'sum' || !d.valueColumn) continue;
            a.sum += parseJtMoneyText(row[d.valueColumn]);
        } else if (d.agg === 'avg') {
            if (a.t !== 'avg' || !d.valueColumn) continue;
            const v = parseJtMoneyText(row[d.valueColumn]);
            if (d.nonZeroOnly && v <= 0) continue;
            a.sum += v;
            a.n += 1;
        }
    }
}

export function finalizeCustomMetrics(
    acc: Map<string, MetricAcc>,
    defs: JtCustomMetricCardDefinition[],
): CustomMetricComputed[] {
    return defs.map((d) => {
        const a = acc.get(d.id);
        let raw = 0;
        let format: 'count' | 'thb' = 'count';
        if (d.agg === 'count') {
            raw = a?.t === 'count' ? a.n : 0;
            format = 'count';
        } else if (d.agg === 'sum') {
            raw = a?.t === 'sum' ? a.sum : 0;
            format = 'thb';
        } else {
            const av = a?.t === 'avg' ? a : null;
            raw = av && av.n > 0 ? Math.round((av.sum / av.n) * 100) / 100 : 0;
            format = 'thb';
        }
        return {
            id: d.id,
            title: d.title,
            subtitle: d.subtitle,
            icon: d.icon,
            raw,
            format,
        };
    });
}

/** คอลัมน์ที่ต้อง select จาก jt_shipments สำหรับชุดการ์ด */
export function unionColumnsForCustomMetrics(defs: JtCustomMetricCardDefinition[]): string[] {
    const s = new Set<string>();
    for (const d of defs) {
        if (d.filter?.column) s.add(d.filter.column);
        if (d.valueColumn) s.add(d.valueColumn);
    }
    return [...s].sort();
}
