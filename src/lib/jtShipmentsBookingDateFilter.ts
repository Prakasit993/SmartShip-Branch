import { nextUtcCalendarDayYmd } from '@/lib/utcDayKey';

/** `booking_date` เป็น text — gte(วันเริ่ม YYYY-MM-DD) + lt(วันหลังวันสิ้นสุด) */
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function applyBookingDateRangeFilters<Q>(query: Q, dateFrom: string, dateTo: string): Q {
    let q = query as unknown as { gte: (c: string, v: string) => unknown; lt: (c: string, v: string) => unknown };
    const df = dateFrom.trim();
    const dt = dateTo.trim();
    if (df && YMD.test(df)) q = q.gte('booking_date', df) as typeof q;
    if (dt && YMD.test(dt)) q = q.lt('booking_date', nextUtcCalendarDayYmd(dt)) as typeof q;
    return q as Q;
}
