/** Keys for J&T admin dashboard section visibility (settings + local override). */
export const JT_DASHBOARD_SECTION_KEYS = [
    'summary',
    'fees',
    'platforms',
    'daily',
    'topSenders',
    'topReceivers',
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

/** ลำดับบล็อกบนแดชบอร์ด J&T — ค่าเริ่มต้นตรงกับเลย์เอาต์เดิม */
export const DEFAULT_JT_DASHBOARD_SECTION_ORDER: JtDashboardSectionKey[] = [...JT_DASHBOARD_SECTION_KEYS];

const LS_ORDER_KEY = 'smartship_jt_dashboard_section_order_v1';

export function sanitizeJtDashboardSectionOrder(input: unknown): JtDashboardSectionKey[] {
    const out: JtDashboardSectionKey[] = [];
    const seen = new Set<JtDashboardSectionKey>();
    if (Array.isArray(input)) {
        for (const x of input) {
            const k = String(x ?? '').trim() as JtDashboardSectionKey;
            if (JT_DASHBOARD_SECTION_KEYS.includes(k) && !seen.has(k)) {
                seen.add(k);
                out.push(k);
            }
        }
    }
    for (const k of JT_DASHBOARD_SECTION_KEYS) {
        if (!seen.has(k)) out.push(k);
    }
    return out;
}

export function readJtDashboardSectionOrder(): JtDashboardSectionKey[] | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(LS_ORDER_KEY);
        if (!raw) return null;
        return sanitizeJtDashboardSectionOrder(JSON.parse(raw));
    } catch {
        return null;
    }
}

export function writeJtDashboardSectionOrder(order: JtDashboardSectionKey[]) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(LS_ORDER_KEY, JSON.stringify(sanitizeJtDashboardSectionOrder(order)));
    } catch {
        /* ignore quota */
    }
}

export function clearJtDashboardSectionOrder() {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(LS_ORDER_KEY);
    } catch {
        /* ignore */
    }
}

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

/** ล้างทั้งการเลือกแสดงและลำดับบล็อกในเครื่องนี้ */
export function clearAllJtDashboardLocalPrefs() {
    clearJtDashboardLocalOverride();
    clearJtDashboardSectionOrder();
}

export function anyJtSectionVisible(sections: Record<JtDashboardSectionKey, boolean>): boolean {
    return JT_DASHBOARD_SECTION_KEYS.some((k) => sections[k]);
}

/**
 * ผสมการมองเห็นบล็อกระหว่างเซิร์ฟเวอร์ (ตั้งค่าเว็บไซต์) กับมุมมองในเครื่อง
 * — ถ้าแอดมินปิดบล็อกในระบบ → ปิดเสมอ (ไม่ถูก localStorage เก่าเปิดทับ)
 * — ถ้าระบบเปิดบล็อก → ใช้ค่าจาก local ถ้ามี (ซ่อนเฉพาะเครื่องได้)
 */
export function mergeDashboardSectionVisibility(
    server: Record<JtDashboardSectionKey, boolean>,
    local: Record<JtDashboardSectionKey, boolean> | null,
): Record<JtDashboardSectionKey, boolean> {
    const out = defaultJtDashboardSections();
    for (const k of JT_DASHBOARD_SECTION_KEYS) {
        if (!server[k]) {
            out[k] = false;
        } else {
            out[k] = local?.[k] ?? true;
        }
    }
    return out;
}

/** มีการซ่อน/แสดงบนพื้นที่เซิร์ฟเวอร์เปิดอยู่จริงหรือไม่ (ใช้โชว์ป้ายมุมมองเฉพาะเครื่อง) */
export function hasDashboardSectionLocalDelta(
    server: Record<JtDashboardSectionKey, boolean>,
    local: Record<JtDashboardSectionKey, boolean> | null,
): boolean {
    if (!local) return false;
    const merged = mergeDashboardSectionVisibility(server, local);
    for (const k of JT_DASHBOARD_SECTION_KEYS) {
        if (merged[k] !== server[k]) return true;
    }
    return false;
}

/** หา index ถัดไปใน order ที่ยังเปิดแสดงอยู่ */
export function nextVisibleSectionIndex(
    order: JtDashboardSectionKey[],
    fromIdx: number,
    vis: Record<JtDashboardSectionKey, boolean>,
): number | null {
    for (let j = fromIdx + 1; j < order.length; j++) {
        if (vis[order[j]]) return j;
    }
    return null;
}

/** หา index ก่อนหน้าใน order ที่ยังเปิดแสดงอยู่ */
export function prevVisibleSectionIndex(
    order: JtDashboardSectionKey[],
    fromIdx: number,
    vis: Record<JtDashboardSectionKey, boolean>,
): number | null {
    for (let j = fromIdx - 1; j >= 0; j--) {
        if (vis[order[j]]) return j;
    }
    return null;
}
