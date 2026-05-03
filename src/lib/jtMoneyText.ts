/**
 * ค่าเงินใน `jt_shipments` ตาม schema เป็นข้อความ (เช่น shipping_fee, cod_amount) — ใช้ตรงกันทั้ง API และ UI
 */
export function parseJtMoneyText(v: unknown): number {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = String(v).trim().replace(/,/g, '');
    if (s === '') return 0;
    const x = parseFloat(s);
    return Number.isFinite(x) ? x : 0;
}
