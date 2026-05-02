/** ฟิลด์ที่อนุญาตให้เลือกใน UI (ต้องเป็นคอลัมน์ที่มีในตาราง jt_shipments) */
export const JT_CHANNEL_FIELD_OPTIONS = [
    'platform',
    'order_source',
    'sales_channel',
    'channel',
    'marketplace',
] as const;

export type JtChannelFieldOption = (typeof JT_CHANNEL_FIELD_OPTIONS)[number];

export const DEFAULT_JT_CHANNEL_PRIORITY: readonly string[] = ['platform', 'order_source'];

/**
 * ค่าจาก settings (JSON array หรือ string) → อาร์เรย์ชื่อคอลัมน์ที่ปลอดภัย
 */
export function sanitizeJtChannelPriority(input: unknown): string[] {
    const allowed = new Set<string>(JT_CHANNEL_FIELD_OPTIONS);
    let raw: unknown[] = [];
    if (Array.isArray(input)) {
        raw = input;
    } else if (typeof input === 'string' && input.trim()) {
        try {
            const p = JSON.parse(input) as unknown;
            raw = Array.isArray(p) ? p : [];
        } catch {
            raw = [];
        }
    }
    const out: string[] = [];
    for (const x of raw) {
        const k = String(x ?? '').trim();
        if (allowed.has(k) && !out.includes(k)) out.push(k);
    }
    return out.length > 0 ? out : [...DEFAULT_JT_CHANNEL_PRIORITY];
}

/** สำหรับ SELECT ใน Supabase — ไม่ซ้ำ */
export function uniqueFieldsForSelect(priority: string[]): string[] {
    return [...new Set(sanitizeJtChannelPriority(priority))];
}

/** อ่านค่าจาก settings.value (string / JSON / double-encoded) */
export function parseJtChannelPriorityFromSettingValue(raw: unknown): string[] {
    if (raw == null || raw === '') return sanitizeJtChannelPriority(null);
    if (Array.isArray(raw)) return sanitizeJtChannelPriority(raw);
    let s = String(raw).trim().replace(/^"|"$/g, '');
    try {
        const j = JSON.parse(s) as unknown;
        return sanitizeJtChannelPriority(j);
    } catch {
        return sanitizeJtChannelPriority(null);
    }
}
