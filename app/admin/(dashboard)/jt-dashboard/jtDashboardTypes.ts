/**
 * ชุดคอลัมน์ที่แดชบอร์ดใช้จาก `jt_shipments` — จอยกับ `schema.sql`
 *
 * | UI / Metrics | คอลัมน์ใน schema | ชนิดใน schema |
 * |--------------|-------------------|----------------|
 * | พัสดุทั้งหมด (นับ) | awb_number | text PK |
 * | ช่วงวันที่ | booking_date | text |
 * | ยอด COD รวม | cod_amount | text → parse เป็นเลข |
 * | ค่าส่งเฉลี่ย | shipping_fee | text → เฉพาะค่า parse แล้ว > 0 |
 * | พัสดุตีกลับ | return_type | text (ตัด EMPTY/NULL/- และค่าว่าง) |
 * | ตารางล่าสุด | awb_number, booking_date, receiver_name, receiver_phone, shipping_fee, cod_amount, latest_scan_type, return_type | text |
 *
 * หมายเหตุ: PostgREST อาจส่งค่าเงินเป็น string หรือ number — UI ใช้ `moneyOrZero()` รองรับทั้งคู่
 * หมายเหตุ: บางกล่องยังอ้าง latest_scan_type เพื่อคำอธิบายสถานะล่าสุด
 */

export type JtDashboardMetrics = {
    totalParcels: number;
    closedCount: number;
    sumCod: number;
    avgShippingFee: number;
    returnCount: number;
    /**
     * จำนวนพัสดุที่ช่องทาง = JMS (เราเก็บเอง — ไม่ใช่ marketplace)
     * คำนวณจาก `jt_stats_summary` RPC (`count_jms`) โดยใช้ default channel priority
     * (platform, order_source) แล้วผ่าน `jt_shipping_fee_bucket` ฝั่ง SQL
     */
    jmsCount: number;
    /**
     * Business KPIs (P6) — derived per channel/COD status in the RPC so the UI does not
     * double-parse text money columns. See `jt_dashboard_fixed_totals` in Supabase.
     */
    sumTotalFeeJms: number;        // รายได้ค่าส่งจาก JMS (bucket=jms → collects shipping fee)
    sumTotalShippingFee: number;   // รายได้รวมทั้งหมด (จาก total_shipping_fee)
    codPaidCount: number;          // จำนวนเคสที่ cod_status = 'ชำระเงินแล้ว' และ cod_amount > 0
    codPaidAmount: number;
    codPendingCount: number;       // cod_amount > 0 แต่ cod_status != 'ชำระเงินแล้ว'
    codPendingAmount: number;
    codNoCollectionCount: number;  // cod_amount = 0 (ส่งแบบไม่เก็บเงินปลายทาง)
    exceptionCount: number;        // จำนวนเคสที่มี exception_reason และ sign_branch_code เป็น NULL
    stagnantCount: number;         // พัสดุที่ latest_scan_time ค้าง >= 2 วัน (หรือ NULL) และยังไม่ปิดงาน
    stagnantCases: Array<{
        awb_number: string;
        booking_date: string;
        sender_name: string;
        sender_phone: string;
        gateway_width: string;
        gateway_height: string;
        gateway_length: string;
        gateway_weight: string;
        gateway_vol_weight: string;
        latest_scan_time: string;
    }>;
    /** พัสดุตกค้างที่แอดมินรับทราบและซ่อนไว้ (active ack kind=stagnant) — สำหรับ "ดูที่ซ่อนไว้" + ดึงกลับ */
    stagnantHiddenCases: Array<{
        awb_number: string;
        reason: string;
        acknowledged_at: string;
        acknowledged_by: string;
    }>;
    topExceptionReasons: Array<{ reason: string; count: number }>;
    topExceptionCases: Array<{
        awb_number: string;
        sender_name: string;
        receiver_name: string;
        receiver_phone: string;
        exception_reason: string;
        issue_registered_time?: string;
    }>;
    topReturnTypeCases: Array<{
        awb_number: string;
        sender_name: string;
        receiver_name: string;
        receiver_phone: string;
        exception_reason: string;
        return_branch_name: string;
        issue_registered_time?: string;
    }>;
    codCollectionRate: number;     // paid / (paid + pending) × 100  (percent, 2 dp)
};

/** Previous-period totals used to render delta badges on KPI cards. */
export type JtDashboardPreviousMetrics = {
    range: { from: string; to: string; days: number };
    count: number;
    sumCod: number;
    avgShippingFee: number;
    returnCount: number;
    jmsCount: number;
    sumTotalFeeJms: number;
    sumTotalShippingFee?: number;
    codPaidCount: number;
    codPaidAmount: number;
    codPendingCount: number;
    codPendingAmount: number;
    codNoCollectionCount: number;
    exceptionCount: number;
    codCollectionRate: number;
};

export type JtDashboardShipmentRow = {
    awb_number: string | null;
    booking_date: string | null;
    sender_name: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
    shipping_fee: string | number | null;
    cod_amount: string | number | null;
    latest_scan_type: string | null;
    return_type: string | null;
    exception_reason: string | null;
    return_branch_name: string | null;
    issue_registered_time: string | null;
};
