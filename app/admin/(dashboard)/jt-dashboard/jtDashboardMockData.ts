/**
 * ข้อมูลจำลองสำหรับทดสอบ UI — ชนิดแถวดู `jtDashboardTypes.ts` (จอย schema.sql)
 */

import type { JtDashboardMetrics, JtDashboardShipmentRow } from './jtDashboardTypes';

export type { JtDashboardMetrics, JtDashboardShipmentRow } from './jtDashboardTypes';
export const MOCK_METRICS: JtDashboardMetrics = {
    totalParcels: 1533,
    sumCod: 7812,
    avgShippingFee: 52.35,
    returnCount: 24,
    jmsCount: 612,
    // Business KPIs (P6) — ตัวเลขจำลองให้สอดคล้องกับ RPC `jt_dashboard_fixed_totals`
    sumTotalFeeJms: 11128.5,
    codPaidCount: 626,
    codPaidAmount: 138700.68,
    codPendingCount: 747,
    codPendingAmount: 190266.55,
    codNoCollectionCount: 992,
    codCollectionRate: 45.59,
};

export const MOCK_RECENT_ROWS: JtDashboardShipmentRow[] = [
    {
        awb_number: 'JT88665544123001',
        booking_date: '2026-05-01T08:30:00.000Z',
        receiver_name: 'คุณสมชาย ใจดี',
        receiver_phone: '0812345678',
        shipping_fee: '45',
        cod_amount: '1200',
        latest_scan_type: 'สำเร็จ — ลงนามรับ',
    },
    {
        awb_number: 'JT88665544122998',
        booking_date: '2026-05-01T07:15:00.000Z',
        receiver_name: 'ร้าน BabyMeal สาขาเซ็นทรัล',
        receiver_phone: '0898765432',
        shipping_fee: '55',
        cod_amount: '0',
        latest_scan_type: 'ระหว่างจัดส่ง',
    },
    {
        awb_number: 'JT88665544122955',
        booking_date: '2026-04-30T22:40:00.000Z',
        receiver_name: 'คุณหนูแดง',
        receiver_phone: '0651112233',
        shipping_fee: '38',
        cod_amount: '3500',
        latest_scan_type: 'ตีกลับ — ผู้รับไม่อยู่',
    },
    {
        awb_number: 'JT88665544122912',
        booking_date: '2026-04-30T18:00:00.000Z',
        receiver_name: 'หจก. ขนส่งเร็ว',
        receiver_phone: '024567890',
        shipping_fee: '120',
        cod_amount: '890',
        latest_scan_type: 'Return to sender',
    },
    {
        awb_number: 'JT88665544122888',
        booking_date: '2026-04-30T12:00:00.000Z',
        receiver_name: 'คุณแอน — รามอินทรา',
        receiver_phone: '0923344556',
        shipping_fee: '42.5',
        cod_amount: '0',
        latest_scan_type: 'สำเร็จ',
    },
];
