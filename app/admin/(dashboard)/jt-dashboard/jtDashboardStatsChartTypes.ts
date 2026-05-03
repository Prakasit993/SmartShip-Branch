/** ชุดข้อมูลกราฟจาก GET /api/admin/jt-shipments/stats (ใช้เฉพาะฟิลด์ที่ UI ต้องการ) */

export type JtChartWindowMeta = {
    mode?: 'rolling' | 'month' | 'range';
    windowDays: number;
    utcStart: string;
    utcEnd: string;
    anchorHint: string;
    dailyStatsSource?: 'rpc' | 'fallback';
    paramNotes?: string[];
};

export type JtDashboardChartsPayload = {
    daily30: { date: string; count: number }[];
    dailyFee30: { date: string; feeTotal: number }[];
    /** รวม COD (cod_amount) ต่อวัน — จาก RPC `jt_shipment_daily_stats_utc` หรือ fallback */
    dailyCod30: { date: string; codTotal: number }[];
    chartWindow: JtChartWindowMeta;
};
