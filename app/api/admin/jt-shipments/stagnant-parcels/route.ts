import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAiToolAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/jt-shipments/stagnant-parcels
 *
 * พัสดุที่ไม่มีความเคลื่อนไหว (latest_scan_time ค้าง >= MIN_AGE_DAYS วัน หรือ NULL)
 * และยังไม่ปิดงาน (signer_name เป็น null/ว่าง/'NULL')
 *
 * Response: { total, min_age_days, cutoff_date, cases[], _elapsed_ms }
 */

const MIN_AGE_DAYS = 2;
const MAX_LIMIT = 200;

function isNotClosed(signerName: unknown): boolean {
    if (signerName === null || signerName === undefined) return true;
    const v = String(signerName).trim();
    return v === '' || v.toUpperCase() === 'NULL';
}

function utcYmd(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

type StagnantRow = {
    awb_number: string | null;
    booking_date: string | null;
    sender_name: string | null;
    sender_phone: string | null;
    gateway_width: string | null;
    gateway_height: string | null;
    gateway_length: string | null;
    gateway_weight: string | null;
    gateway_vol_weight: string | null;
    latest_scan_time: string | null;
    signer_name: string | null;
};

export async function GET(req: Request) {
    const t0 = performance.now();
    try {
        const rateLimited = applyRateLimit(req, 'jt-shipments:stagnant-parcels', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAiToolAuth(req);
        if (denied) return denied;

        const todayMs = Date.now();
        const cutoffYmd = utcYmd(todayMs - MIN_AGE_DAYS * 86_400_000);

        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select(
                'awb_number,booking_date,sender_name,sender_phone,gateway_width,gateway_height,gateway_length,gateway_weight,gateway_vol_weight,latest_scan_time,signer_name',
            )
            .or('signer_name.is.null,signer_name.eq.,signer_name.eq.NULL')
            // ดึงแบบ scan เก่าสุด/NULL ขึ้นก่อน เพื่อให้พัสดุตกค้างจริงติดมาในลิมิตเสมอ
            // (display order จัดใหม่หลังกรอง — ดูการ sort ด้านล่าง)
            .order('latest_scan_time', { ascending: true, nullsFirst: true })
            .range(0, MAX_LIMIT - 1);

        if (error) {
            console.error('[jt-shipments/stagnant-parcels]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const safe = (v: unknown) => String(v ?? '').trim() || '-';
        const cases: Array<{
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
        }> = [];

        for (const r of (data ?? []) as StagnantRow[]) {
            if (!isNotClosed(r.signer_name)) continue;

            const scanTime = r.latest_scan_time ? String(r.latest_scan_time).trim() : '';
            if (scanTime && scanTime.slice(0, 10) > cutoffYmd) continue;

            cases.push({
                awb_number: safe(r.awb_number),
                booking_date: safe(r.booking_date),
                sender_name: safe(r.sender_name),
                sender_phone: safe(r.sender_phone),
                gateway_width: safe(r.gateway_width),
                gateway_height: safe(r.gateway_height),
                gateway_length: safe(r.gateway_length),
                gateway_weight: safe(r.gateway_weight),
                gateway_vol_weight: safe(r.gateway_vol_weight),
                latest_scan_time: safe(r.latest_scan_time),
            });
        }

        // Display order: scan ล่าสุด มาก→น้อย, ตัวที่ไม่มี scan ('-') ไว้ท้ายสุด
        cases.sort((a, b) => {
            const aNull = a.latest_scan_time === '-';
            const bNull = b.latest_scan_time === '-';
            if (aNull !== bNull) return aNull ? 1 : -1;
            if (aNull) return 0;
            return b.latest_scan_time.localeCompare(a.latest_scan_time);
        });

        return NextResponse.json({
            total: cases.length,
            min_age_days: MIN_AGE_DAYS,
            cutoff_date: cutoffYmd,
            cases,
            _elapsed_ms: Math.round(performance.now() - t0),
        });
    } catch (err) {
        console.error('[jt-shipments/stagnant-parcels] unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
