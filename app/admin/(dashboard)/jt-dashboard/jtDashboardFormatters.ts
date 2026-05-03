/** ใช้ร่วมกับ J&T Dashboard (รายการล่าสุด / badge สถานะ) */

const THAI_MONTHS = [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.',
] as const;

export function formatBookingDateThai(raw: string | null | undefined): string {
    if (raw == null || raw === '') return '-';
    const t = Date.parse(String(raw));
    if (Number.isNaN(t)) return '-';
    const d = new Date(t);
    const day = d.getUTCDate();
    const month = THAI_MONTHS[d.getUTCMonth()] ?? '';
    const yearBe = d.getUTCFullYear() + 543;
    return `${day} ${month} ${yearBe}`;
}

export function strOrDash(v: string | null | undefined): string {
    const s = v?.trim();
    return s && s.length > 0 ? s : '-';
}

import { parseJtMoneyText } from '@/lib/jtMoneyText';

/** สอดคล้อง `schema.sql` — shipping_fee / cod_amount เป็น text */
export function moneyOrZero(n: unknown): number {
    return parseJtMoneyText(n);
}

export function formatThb(n: number): string {
    return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function scanStatusPresentation(scan: string | null | undefined): {
    label: string;
    className: string;
} {
    const raw = String(scan ?? '').trim();
    if (!raw) {
        return {
            label: '-',
            className: 'bg-slate-800/80 text-slate-400 ring-slate-600/50',
        };
    }
    const lower = raw.toLowerCase();
    if (raw.includes('ตีกลับ') || lower.includes('return')) {
        return {
            label: raw.length > 32 ? `${raw.slice(0, 29)}…` : raw,
            className: 'bg-red-500/15 text-red-300 ring-red-500/35',
        };
    }
    if (raw.includes('สำเร็จ') || lower.includes('delivered') || lower.includes('success')) {
        return {
            label: raw.length > 32 ? `${raw.slice(0, 29)}…` : raw,
            className: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/35',
        };
    }
    return {
        label: raw.length > 36 ? `${raw.slice(0, 33)}…` : raw,
        className: 'bg-slate-700/60 text-slate-300 ring-slate-600/45',
    };
}
