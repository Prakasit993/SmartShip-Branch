/**
 * ชุดคอลัมน์ที่แดชบอร์ดใช้จาก `jt_shipments` — จอยกับ `schema.sql`
 *
 * | UI / Metrics | คอลัมน์ใน schema | ชนิดใน schema |
 * |--------------|-------------------|----------------|
 * | พัสดุทั้งหมด (นับ) | awb_number | text PK |
 * | ช่วงวันที่ | booking_date | text |
 * | ยอด COD รวม | cod_amount | text → parse เป็นเลข |
 * | ค่าส่งเฉลี่ย | shipping_fee | text → เฉพาะค่า parse แล้ว > 0 |
 * | พัสดุตีกลับ | latest_scan_type | text (คีย์เวิร์ด ตีกลับ / Return) |
 * | ตารางล่าสุด | awb_number, booking_date, receiver_name, receiver_phone, shipping_fee, cod_amount, latest_scan_type | text |
 *
 * หมายเหตุ: PostgREST อาจส่งค่าเงินเป็น string หรือ number — UI ใช้ `moneyOrZero()` รองรับทั้งคู่
 * คอลัมน์อื่นใน schema (เช่น return_type, platform จาก migration) แดชบอร์ดชุดนี้ยังไม่ใช้
 */

export type JtDashboardMetrics = {
    totalParcels: number;
    sumCod: number;
    avgShippingFee: number;
    returnCount: number;
};

/** Previous-period totals used to render delta badges on KPI cards. */
export type JtDashboardPreviousMetrics = {
    range: { from: string; to: string; days: number };
    count: number;
    sumCod: number;
    avgShippingFee: number;
    returnCount: number;
};

export type JtDashboardShipmentRow = {
    awb_number: string | null;
    booking_date: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
    shipping_fee: string | number | null;
    cod_amount: string | number | null;
    latest_scan_type: string | null;
};
