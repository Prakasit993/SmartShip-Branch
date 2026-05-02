import { DEFAULT_JT_CHANNEL_PRIORITY, sanitizeJtChannelPriority } from '@/lib/jtChannelSettings';

export {
    JT_CHANNEL_FIELD_OPTIONS,
    sanitizeJtChannelPriority,
    DEFAULT_JT_CHANNEL_PRIORITY,
    type JtChannelFieldOption,
} from '@/lib/jtChannelSettings';

/** ค่าแรกที่ไม่ว่างตามลำดับฟิลด์ที่ตั้งค่า */
export function channelRawFromRow(row: Record<string, unknown>, priority?: string[]): string {
    const order = priority?.length ? sanitizeJtChannelPriority(priority) : [...DEFAULT_JT_CHANNEL_PRIORITY];
    for (const key of order) {
        const v = row[key];
        const s = v == null ? '' : String(v).trim();
        if (s) return s;
    }
    return '';
}

export function channelOrNullFromRow(row: Record<string, unknown>, priority?: string[]): string | null {
    const r = channelRawFromRow(row, priority);
    return r || null;
}

export function channelBucketLabelFromRow(row: Record<string, unknown>, priority?: string[]): string {
    const r = channelRawFromRow(row, priority);
    return r || 'ไม่ระบุ';
}

/** ความเข้ากันแบบเดิม — ใช้ลำดับเริ่มต้น platform → order_source */
export function primaryChannelRaw(row: {
    platform?: string | null;
    order_source?: string | null;
}): string {
    return channelRawFromRow(row as Record<string, unknown>);
}

export function primaryChannelOrNull(row: {
    platform?: string | null;
    order_source?: string | null;
}): string | null {
    return channelOrNullFromRow(row as Record<string, unknown>);
}

export function primaryChannelBucketLabel(row: {
    platform?: string | null;
    order_source?: string | null;
}): string {
    return channelBucketLabelFromRow(row as Record<string, unknown>);
}
