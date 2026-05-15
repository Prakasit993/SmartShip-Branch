import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAiToolAuth } from '@/lib/adminApiAuth';
import { applyBookingDateRangeFilters } from '@/lib/jtShipmentsBookingDateFilter';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/jt-shipments/top-not-closed
 *
 * คืนรายการ Top N พัสดุที่ "ยังไม่ปิดงาน" ในช่วงวันที่ที่ระบุ — ใช้สำหรับ
 * AI Agent tool `get_top_not_closed_cases` เพื่อให้ admin ขอรายการ AWB ของ
 * พัสดุที่ค้างได้ ไม่จำกัดเฉพาะ COD pending (ที่ get_dashboard_kpi
 * คืนผ่าน `topCodPendingCases`).
 *
 * นิยาม "ปิดงาน" (สอดคล้องกับ jt_dashboard_fixed_totals v2):
 *   closed = signer_name IS NOT NULL AND trim(signer_name) NOT IN ('', 'NULL')
 *   not_closed = inverse
 *
 * Query params:
 *   date_from  YYYY-MM-DD  (optional — ว่าง = ไม่กรองวันเริ่ม)
 *   date_to    YYYY-MM-DD  (optional — ว่าง = ไม่กรองวันสิ้นสุด)
 *   limit      จำนวน row คืนสูงสุด (default 100, ค่าจริงในระหว่าง 1-500)
 *
 * Response (200):
 * {
 *   total           : number   — จำนวนเคสที่ "ยังไม่ปิดงาน" ตามที่นับใน rows ที่ดึง
 *   limit           : number   — limit ที่ใช้จริง
 *   truncated       : boolean  — true ถ้ามีโอกาสมี row เกิน limit
 *   cases           : Array<NotClosedCase>
 *   date_from       : string | null
 *   date_to         : string | null
 *   _elapsed_ms     : number
 * }
 */

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * ดึง row จากตาราง 1 รอบ + filter null/empty/'NULL' ฝั่ง JS เพื่อให้ตรง
 * กับ logic ของ jt_dashboard_fixed_totals (ที่ใช้ trim(signer_name) NOT IN ('', 'NULL'))
 *
 * เหตุที่ไม่ใช้ Postgres filter:
 * - Supabase JS client ไม่มี clean way สำหรับ trim() ใน .filter()
 * - .or('signer_name.is.null,signer_name.eq.,signer_name.eq.NULL') ไม่ catch whitespace-only
 * - การ over-fetch + filter ใน JS แค่ ~few hundred rows ไม่กระทบ performance
 */
function isNotClosed(signerName: unknown): boolean {
    if (signerName === null || signerName === undefined) return true;
    const v = String(signerName).trim();
    if (v === '' || v.toUpperCase() === 'NULL') return true;
    return false;
}

type ShipmentRow = {
    awb_number: string | null;
    booking_date: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
    sender_name: string | null;
    shipping_fee: string | null;
    cod_amount: string | null;
    cod_status: string | null;
    latest_scan_type: string | null;
    issue_status: string | null;
    return_type: string | null;
    exception_reason: string | null;
    signer_name: string | null;
};

type NotClosedCase = {
    awb_number: string;
    booking_date: string;
    receiver_name: string;
    receiver_phone: string;
    shipping_fee: string;
    cod_amount: string;
    cod_status: string;
    latest_scan_type: string;
    issue_status: string;
};

function toCase(row: ShipmentRow): NotClosedCase {
    const safe = (v: unknown) => String(v ?? '').trim() || '-';
    return {
        awb_number: safe(row.awb_number),
        booking_date: safe(row.booking_date),
        receiver_name: safe(row.receiver_name),
        receiver_phone: safe(row.receiver_phone),
        shipping_fee: safe(row.shipping_fee),
        cod_amount: safe(row.cod_amount),
        cod_status: safe(row.cod_status),
        latest_scan_type: safe(row.latest_scan_type),
        issue_status: safe(row.issue_status),
    };
}

export async function GET(req: Request) {
    const t0 = performance.now();
    try {
        const rateLimited = applyRateLimit(req, 'jt-shipments:top-not-closed', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAiToolAuth(req);
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const dateFrom = searchParams.get('date_from')?.trim() ?? '';
        const dateTo = searchParams.get('date_to')?.trim() ?? '';

        const limitRaw = Number(searchParams.get('limit'));
        const limit =
            Number.isFinite(limitRaw) && limitRaw > 0
                ? Math.min(Math.floor(limitRaw), MAX_LIMIT)
                : DEFAULT_LIMIT;

        // Fetch up to 2x limit so JS filter (drop closed rows) still has enough
        // candidates to return `limit` not-closed cases. Capped to avoid huge
        // payloads when most parcels are closed.
        const overFetch = Math.min(limit * 2, MAX_LIMIT);

        let q = supabaseAdmin
            .from('jt_shipments')
            .select(
                'awb_number,booking_date,receiver_name,receiver_phone,sender_name,shipping_fee,cod_amount,cod_status,latest_scan_type,issue_status,return_type,exception_reason,signer_name',
            )
            .order('booking_date', { ascending: false, nullsFirst: false });
        q = applyBookingDateRangeFilters(q, dateFrom, dateTo);

        const { data, error } = await q.range(0, overFetch - 1);
        if (error) {
            console.error('[jt-shipments/top-not-closed]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = ((data ?? []) as ShipmentRow[]).filter((r) => isNotClosed(r.signer_name));
        const cases = rows.slice(0, limit).map(toCase);

        // If the JS filter consumed *all* over-fetched rows and still produced
        // `limit` cases, we likely have more not-closed rows beyond the fetch
        // window. Surface this to the agent so it can warn the user / paginate.
        const truncated = rows.length >= limit && (data?.length ?? 0) >= overFetch;

        const elapsed = Math.round(performance.now() - t0);
        console.log(
            `[jt-shipments/top-not-closed] done in ${elapsed}ms — ${cases.length}/${rows.length} returned`,
        );

        return NextResponse.json({
            total: rows.length,
            limit,
            truncated,
            cases,
            date_from: dateFrom || null,
            date_to: dateTo || null,
            _elapsed_ms: elapsed,
        });
    } catch (err) {
        console.error('[jt-shipments/top-not-closed] unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
