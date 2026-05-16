import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAiToolAuth } from '@/lib/adminApiAuth';
import { applyBookingDateRangeFilters } from '@/lib/jtShipmentsBookingDateFilter';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/jt-shipments/top-not-closed
 *
 * รายการ Top N พัสดุที่ "ยังไม่ปิดงาน" ในช่วงวันที่ที่ระบุ (รับ date_from, date_to แบบ YYYY-MM-DD และ limit เป็นตัวเลข default 100 max 500)
 *
 * นิยาม "ยังไม่ปิดงาน": signer_name เป็น null/ว่าง/'NULL' (สอดคล้องกับ closed_count ของ get_dashboard_kpi)
 *
 * ครอบคลุมทุกประเภทพัสดุที่ยังไม่ส่งสำเร็จ:
 * - COD pending (รอเก็บเงินปลายทาง)
 * - พัสดุ non-COD ที่ยังไม่ส่งมอบ
 * - พัสดุ exception / มีปัญหา
 * - พัสดุตีกลับ
 *
 * Query params:
 *   date_from  YYYY-MM-DD  (optional — ว่าง = ไม่กรองวันเริ่ม)
 *   date_to    YYYY-MM-DD  (optional — ว่าง = ไม่กรองวันสิ้นสุด)
 *   limit      จำนวน row คืนสูงสุด (default 100, ค่าจริงในระหว่าง 1-500)
 *
 * Fields ที่คืน (cases[]):
 *   awb_number           = เลขพัสดุ
 *   booking_date         = วันที่คีย์พัสดุ
 *   sender_name          = ชื่อผู้ส่ง
 *   sender_phone         = เบอร์ผู้ส่ง
 *   receiver_name        = ชื่อผู้รับ
 *   receiver_phone       = เบอร์ผู้รับ
 *   total_shipping_fee   = ค่าส่งรวม
 *   cod_amount           = ยอด COD (ถ้ามี)
 *   cod_status           = สถานะ COD
 *   latest_scan_time     = เวลา scan ล่าสุด
 *   issue_status         = สถานะปัญหา (ถ้ามี)
 *   issue_registered_time = เวลาลงพัสดุมีปัญหา
 *   exception_reason     = เหตุผลพัสดุมีปัญหา
 *   return_type          = ประเภทการตีกลับ
 *   signer_name          = ชื่อผู้รับสินค้า (null = ยังไม่ปิดงาน)
 *   updated_at           = อัปเดทล่าสุด
 *
 * Top-level fields:
 *   total     = จำนวนเคสที่ filter ได้
 *   limit     = limit ที่ใช้จริง
 *   truncated = true ถ้ามี case เกิน limit (บอกผู้ใช้ว่าแสดง N ตัวแรก)
 *
 * ใช้เมื่อผู้ใช้ขอ "รายการเลข AWB" ของพัสดุที่ยังไม่ปิดงาน เช่น:
 * - "พัสดุชิ้นไหนยังไม่ส่งสำเร็จ"
 * - "AWB ที่ค้างในเดือนนี้"
 * - "เลขพัสดุที่ยังไม่ปิดงาน"
 *
 * ไม่ควรเรียก tool นี้ถ้าผู้ใช้แค่ถาม "จำนวน" — ใช้ count - closedCount จาก get_dashboard_kpi แทน (เบากว่า)
 *
 * Response (200):
 * {
 *   total       : number   — จำนวนเคสที่ "ยังไม่ปิดงาน" ตามที่นับใน rows ที่ดึง
 *   limit       : number   — limit ที่ใช้จริง
 *   truncated   : boolean  — true ถ้ามีโอกาสมี row เกิน limit
 *   cases       : Array<NotClosedCase>
 *   date_from   : string | null
 *   date_to     : string | null
 *   _elapsed_ms : number
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
    sender_name: string | null;
    sender_phone: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
    total_shipping_fee: string | null;
    cod_amount: string | null;
    cod_status: string | null;
    latest_scan_time: string | null;
    issue_status: string | null;
    issue_registered_time: string | null;
    exception_reason: string | null;
    return_type: string | null;
    signer_name: string | null;
    updated_at: string | null;
};

type NotClosedCase = {
    awb_number: string;
    booking_date: string;
    sender_name: string;
    sender_phone: string;
    receiver_name: string;
    receiver_phone: string;
    total_shipping_fee: string;
    cod_amount: string;
    cod_status: string;
    latest_scan_time: string;
    issue_status: string;
    issue_registered_time: string;
    exception_reason: string;
    return_type: string;
    signer_name: string;
    updated_at: string;
};

function toCase(row: ShipmentRow): NotClosedCase {
    const safe = (v: unknown) => String(v ?? '').trim() || '-';
    return {
        awb_number: safe(row.awb_number),
        booking_date: safe(row.booking_date),
        sender_name: safe(row.sender_name),
        sender_phone: safe(row.sender_phone),
        receiver_name: safe(row.receiver_name),
        receiver_phone: safe(row.receiver_phone),
        total_shipping_fee: safe(row.total_shipping_fee),
        cod_amount: safe(row.cod_amount),
        cod_status: safe(row.cod_status),
        latest_scan_time: safe(row.latest_scan_time),
        issue_status: safe(row.issue_status),
        issue_registered_time: safe(row.issue_registered_time),
        exception_reason: safe(row.exception_reason),
        return_type: safe(row.return_type),
        signer_name: safe(row.signer_name),
        updated_at: safe(row.updated_at),
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
                'awb_number,booking_date,sender_name,sender_phone,receiver_name,receiver_phone,total_shipping_fee,cod_amount,cod_status,latest_scan_time,issue_status,issue_registered_time,exception_reason,return_type,signer_name,updated_at',
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
