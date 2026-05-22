/**
 * Types ของ tiktok-dashboard — แยกออกมาเพื่อใช้ร่วมระหว่าง client + components
 * (pattern เดียวกับ jt-dashboard/jtDashboardTypes.ts)
 */

/* ─── การ์ดสรุปหลัก (TiktokDashboardClient) ─── */
export type Stats = { total: number; closedCount: number };
export type SenderRow = { sender: string; shop: string; count: number };
export type ProductRow = { name: string; count: number };
export type TopLists = { topSenders: SenderRow[]; topProducts: ProductRow[] };

/* ─── ติดตามปัญหา (สอดคล้องกับ /api/admin/tiktok-shipments/issues + /stagnant-parcels) ─── */
export type ExceptionCase = {
    awb_number: string;
    sender_name: string;
    receiver_name: string;
    receiver_phone: string;
    exception_reason: string;
    issue_registered_time: string;
};

export type ReturnCase = ExceptionCase & { return_branch_name: string };

export type HiddenCase = {
    awb_number: string;
    reason: string;
    acknowledged_at: string;
    acknowledged_by: string;
};

export type StagnantCase = {
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
};

export type IssuesData = {
    exceptionCount: number;
    returnCount: number;
    topExceptionCases: ExceptionCase[];
    topReturnTypeCases: ReturnCase[];
    returnHiddenCases: HiddenCase[];
};

export type StagnantData = {
    total: number;
    cases: StagnantCase[];
    hidden: HiddenCase[];
};
