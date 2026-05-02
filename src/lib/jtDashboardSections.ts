/** Keys for J&T admin dashboard section visibility (settings + local override). */
export const JT_DASHBOARD_SECTION_KEYS = [
    'summary',
    'fees',
    'platforms',
    'daily',
    'topSenders',
    'topReceivers',
    'hints',
    'recent',
] as const;

export type JtDashboardSectionKey = (typeof JT_DASHBOARD_SECTION_KEYS)[number];

export const JT_DASHBOARD_SECTION_LABELS: Record<JtDashboardSectionKey, string> = {
    summary: 'การ์ดสรุปจำนวน (ทั้งหมด / วันนี้ / สัปดาห์ / เดือน)',
    fees: 'ค่าส่ง (รวม / เฉลี่ย / สูงสุด)',
    platforms: 'แยกตามแพลตฟอร์ม / ช่องทาง (Shopee, Lazada, TikTok ฯลฯ)',
    daily: 'กราฟจำนวนรายการ 30 วัน',
    topSenders: 'Top ผู้ส่ง',
    topReceivers: 'Top ผู้รับ',
    hints: 'คำแนะนำและลิงก์ไปจัดการรายการ',
    recent: 'ตารางรายการล่าสุด',
};

export function defaultJtDashboardSections(): Record<JtDashboardSectionKey, boolean> {
    return Object.fromEntries(JT_DASHBOARD_SECTION_KEYS.map((k) => [k, true])) as Record<
        JtDashboardSectionKey,
        boolean
    >;
}

/** Parse stored JSON from settings (value may be double-encoded string). */
export function parseJtDashboardSectionsJson(raw: unknown): Record<JtDashboardSectionKey, boolean> {
    const d = defaultJtDashboardSections();
    if (raw == null || raw === '') return d;

    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        const o = raw as Record<string, unknown>;
        for (const k of JT_DASHBOARD_SECTION_KEYS) {
            if (typeof o[k] === 'boolean') d[k] = o[k];
        }
        return d;
    }

    let s = String(raw);
    try {
        const once = JSON.parse(s);
        if (typeof once === 'string') s = once;
    } catch {
        s = s.replace(/^"|"$/g, '');
    }

    try {
        const obj = JSON.parse(s) as unknown;
        if (typeof obj !== 'object' || obj === null) return d;
        const o = obj as Record<string, unknown>;
        for (const k of JT_DASHBOARD_SECTION_KEYS) {
            if (typeof o[k] === 'boolean') d[k] = o[k];
        }
    } catch {
        return d;
    }
    return d;
}

const LS_KEY = 'smartship_jt_dashboard_sections_v2';

export function readJtDashboardLocalOverride(): Record<JtDashboardSectionKey, boolean> | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        return parseJtDashboardSectionsJson(raw);
    } catch {
        return null;
    }
}

export function writeJtDashboardLocalOverride(sections: Record<JtDashboardSectionKey, boolean>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(sections));
    } catch {
        /* ignore quota */
    }
}

export function clearJtDashboardLocalOverride() {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(LS_KEY);
    } catch {
        /* ignore */
    }
}

export function anyJtSectionVisible(sections: Record<JtDashboardSectionKey, boolean>): boolean {
    return JT_DASHBOARD_SECTION_KEYS.some((k) => sections[k]);
}
