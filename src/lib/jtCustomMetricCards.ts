/**
 * การ์ดเมตริกที่แอดมินกำหนดเองบนแดชบอร์ด J&T — เก็บใน settings.key = jt_dashboard_custom_metric_cards
 */

export const JT_CUSTOM_METRIC_SETTINGS_KEY = 'jt_dashboard_custom_metric_cards';

/** คอลัมน์ที่อนุญาตให้อ้างในการ์ด (ลดความเสี่ยงจากข้อมูลแปลกปลอม) */
export const JT_SHIPMENT_FILTER_COLUMNS = [
    'latest_scan_type',
    'sender_name',
    'receiver_name',
    'dest_province',
    'order_source',
    'shop_name',
    'cod_status',
    'delivery_method',
    'platform',
] as const;

export const JT_SHIPMENT_VALUE_COLUMNS = [
    'shipping_fee',
    'cod_amount',
    'remote_area_fee',
    'return_fee',
    'insurance_fee',
    'total_shipping_fee',
    'discount_amount',
    'amount_before_discount',
    'other_fees',
] as const;

export type JtCustomMetricIcon =
    | 'package'
    | 'banknote'
    | 'scale'
    | 'rotate-ccw'
    | 'truck'
    | 'bar-chart'
    | 'map-pin';

export type JtCustomMetricCardDefinition = {
    id: string;
    title: string;
    /** ข้อความใต้ตัวเลข (เช่น อธิบายสูตร) */
    subtitle?: string;
    icon: JtCustomMetricIcon;
    agg: 'count' | 'sum' | 'avg';
    /** sum / avg — ต้องเป็นคอลัมน์ตัวเลข */
    valueColumn?: string;
    /** เฉพาะ avg — เฉลี่ยเฉพาะแถวที่ค่า parse แล้ว > 0 */
    nonZeroOnly?: boolean;
    filter?: {
        column: string;
        mode: 'contains' | 'regex';
        pattern: string;
    };
};

export const MAX_CUSTOM_METRIC_CARDS = 8;

const ICONS: JtCustomMetricIcon[] = [
    'package',
    'banknote',
    'scale',
    'rotate-ccw',
    'truck',
    'bar-chart',
    'map-pin',
];

function isAllowedFilterColumn(c: string): boolean {
    return (JT_SHIPMENT_FILTER_COLUMNS as readonly string[]).includes(c);
}

function isAllowedValueColumn(c: string): boolean {
    return (JT_SHIPMENT_VALUE_COLUMNS as readonly string[]).includes(c);
}

export function sanitizeJtCustomMetricCards(raw: unknown): JtCustomMetricCardDefinition[] {
    if (!Array.isArray(raw)) return [];
    const out: JtCustomMetricCardDefinition[] = [];
    for (const item of raw) {
        if (out.length >= MAX_CUSTOM_METRIC_CARDS) break;
        if (typeof item !== 'object' || item === null) continue;
        const o = item as Record<string, unknown>;
        const id = String(o.id ?? '').trim();
        const title = String(o.title ?? '').trim().slice(0, 80);
        if (!id || !title) continue;
        const subtitle =
            typeof o.subtitle === 'string' ? o.subtitle.trim().slice(0, 200) : undefined;
        const iconRaw = String(o.icon ?? 'package').trim();
        const icon = ICONS.includes(iconRaw as JtCustomMetricIcon)
            ? (iconRaw as JtCustomMetricIcon)
            : 'package';
        const agg = o.agg === 'sum' || o.agg === 'avg' || o.agg === 'count' ? o.agg : null;
        if (!agg) continue;
        const valueColumn =
            typeof o.valueColumn === 'string' && o.valueColumn.trim()
                ? o.valueColumn.trim()
                : undefined;
        if ((agg === 'sum' || agg === 'avg') && (!valueColumn || !isAllowedValueColumn(valueColumn))) {
            continue;
        }
        const nonZeroOnly = Boolean(o.nonZeroOnly);
        let filter: JtCustomMetricCardDefinition['filter'];
        if (typeof o.filter === 'object' && o.filter !== null) {
            const f = o.filter as Record<string, unknown>;
            const col = String(f.column ?? '').trim();
            const mode = f.mode === 'regex' ? 'regex' : 'contains';
            const pattern = String(f.pattern ?? '').trim().slice(0, 500);
            if (col && isAllowedFilterColumn(col) && pattern) {
                if (mode === 'regex') {
                    try {
                        new RegExp(pattern, 'i');
                        filter = { column: col, mode: 'regex', pattern };
                    } catch {
                        filter = undefined;
                    }
                } else {
                    filter = { column: col, mode: 'contains', pattern };
                }
            }
        }
        out.push({
            id,
            title,
            subtitle: subtitle || undefined,
            icon,
            agg,
            valueColumn: agg === 'count' ? undefined : valueColumn,
            nonZeroOnly: agg === 'avg' ? nonZeroOnly : undefined,
            filter,
        });
    }
    return out;
}

export function parseJtCustomMetricCardsFromSettingsValue(raw: unknown): JtCustomMetricCardDefinition[] {
    if (raw == null || raw === '') return [];
    if (Array.isArray(raw)) return sanitizeJtCustomMetricCards(raw);
    let s = typeof raw === 'string' ? raw : JSON.stringify(raw);
    try {
        const once = JSON.parse(s);
        if (typeof once === 'string') s = once;
    } catch {
        return [];
    }
    try {
        const v = JSON.parse(s);
        return sanitizeJtCustomMetricCards(v);
    } catch {
        return [];
    }
}
