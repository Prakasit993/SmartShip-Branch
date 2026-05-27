export const JT_SHIPMENT_DETAIL_FIELDS_SETTINGS_KEY = 'jt_dashboard_shipment_detail_fields';

export type JtShipmentDetailFieldDef = {
    key: string;
    label: string;
};

// จัดชุดให้ครอบคลุม "ข้อมูลเบื้องหลังการ์ดทุกใบบนแดชบอร์ดขนส่ง" (jt-dashboard):
//   จำนวนพัสดุ → awb_number · ปิดงานแล้ว → signer_name · ค่าจัดส่งรวม → shipping_fee/total_shipping_fee
//   COD ทั้งหมด/ชำระ/ค้าง/อัตรา → cod_amount/cod_status/cod_payment_* · ช่องทาง → platform/order_source
//   พัสดุมีปัญหา → exception_reason/sign_branch_code · ตกค้าง → latest_scan_type/latest_scan_time
//   ถูกตีกลับ → return_type/return_branch_name
export const JT_SHIPMENT_DETAIL_FIELDS: JtShipmentDetailFieldDef[] = [
    { key: 'awb_number', label: 'AWB Number' },
    { key: 'booking_date', label: 'Booking Date' },
    { key: 'sender_name', label: 'Sender Name' },
    { key: 'sender_phone', label: 'Sender Phone' },
    { key: 'receiver_name', label: 'Receiver Name' },
    { key: 'receiver_phone', label: 'Receiver Phone' },
    { key: 'platform', label: 'Platform' },
    { key: 'order_source', label: 'Order Source' },
    { key: 'shipping_fee', label: 'Shipping Fee' },
    { key: 'total_shipping_fee', label: 'Total Shipping Fee' },
    { key: 'cod_amount', label: 'COD Amount' },
    { key: 'cod_status', label: 'COD Status' },
    { key: 'cod_payment_method', label: 'COD Payment Method' },
    { key: 'cod_payment_time', label: 'COD Payment Time' },
    { key: 'signer_name', label: 'Signer Name' },
    { key: 'latest_scan_type', label: 'Latest Scan Type' },
    { key: 'latest_scan_time', label: 'Latest Scan Time' },
    { key: 'sign_branch_code', label: 'Sign Branch Code' },
    { key: 'exception_reason', label: 'Exception Reason' },
    { key: 'return_type', label: 'Return Type' },
    { key: 'return_branch_name', label: 'Return Branch Name' },
    { key: 'issue_registered_time', label: 'Issue Registered Time' },
];

// ค่าเริ่มต้น = ทุกฟิลด์ที่อิงการ์ดบนแดชบอร์ด (ดึงให้ครบเมื่อ admin ยังไม่ได้เลือกเอง)
export const DEFAULT_JT_SHIPMENT_DETAIL_FIELDS = JT_SHIPMENT_DETAIL_FIELDS.map((f) => f.key);

export function sanitizeJtShipmentDetailFieldsWithAllowed(raw: unknown, allowedFields: string[]): string[] {
    const allowed = new Set(allowedFields);
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
        const key = String(item ?? '').trim();
        if (!key || !allowed.has(key) || seen.has(key)) continue;
        out.push(key);
        seen.add(key);
    }
    return out.length > 0 ? out : [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
}

/**
 * แปลง array ดิบ → list ของ key (trim + ตัดซ้ำ) โดย "ไม่" กรองด้วย allowlist.
 * ว่าง → คืน DEFAULT.
 */
function toKeyList(raw: unknown): string[] {
    const list = Array.isArray(raw) ? raw : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
        const key = String(item ?? '').trim();
        if (!key || seen.has(key)) continue;
        out.push(key);
        seen.add(key);
    }
    return out.length > 0 ? out : [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
}

/**
 * ถอดค่า field list จาก settings (รองรับ double-encoded JSON).
 *
 * สำคัญ: ที่นี่ "ไม่" กรองด้วย allowlist ใด ๆ — ฟิลด์ที่แอดมินเลือกได้คือคอลัมน์จริง
 * ทั้งหมดของ jt_shipments (จาก RPC jt_shipments_import_columns) ซึ่งกว้างกว่าชุด
 * JT_SHIPMENT_DETAIL_FIELDS แบบ hardcode. ปล่อยให้ caller (route) sanitize เทียบกับ
 * availableFields อีกชั้น มิฉะนั้นฟิลด์นอกชุด default จะถูกตัดทิ้งตั้งแต่ตอนอ่าน
 * แล้ว modal รายละเอียดพัสดุจะไม่แสดงค่าให้ ("บางฟิลด์ไม่ดึงมา").
 */
export function parseJtShipmentDetailFieldsFromSettingsValue(raw: unknown): string[] {
    if (raw == null || raw === '') return [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
    if (Array.isArray(raw)) return toKeyList(raw);
    let s = typeof raw === 'string' ? raw : JSON.stringify(raw);
    try {
        const once = JSON.parse(s);
        if (Array.isArray(once)) return toKeyList(once);
        if (typeof once === 'string') s = once;
    } catch {
        return [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
    }
    try {
        const v = JSON.parse(s);
        return Array.isArray(v) ? toKeyList(v) : [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
    } catch {
        return [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
    }
}
