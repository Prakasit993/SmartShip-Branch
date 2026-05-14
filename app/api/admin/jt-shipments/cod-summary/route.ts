import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/jt-shipments/cod-summary
 *
 * สรุปข้อมูล COD ของช่วงวันที่ที่เลือก — ใช้ได้ทั้ง:
 *  1. Dashboard lazy-load (โหลดการ์ด COD แยกหลัง KPI หลักแสดงแล้ว)
 *  2. AI Agent tool `get_cod_summary` (query param: date_from, date_to)
 *
 * Query params:
 *   date_from  YYYY-MM-DD  (optional — ว่าง = ไม่กรองวันเริ่ม)
 *   date_to    YYYY-MM-DD  (optional — ว่าง = ไม่กรองวันสิ้นสุด)
 *
 * Response (200):
 * {
 *   sumCod            : number   — ยอด COD ทั้งหมด (บาท)
 *   paidCount         : number   — จำนวนเคส COD ชำระแล้ว
 *   paidAmount        : number   — ยอด COD ชำระแล้ว (บาท)
 *   pendingCount      : number   — จำนวนเคส COD ค้างชำระ
 *   pendingAmount     : number   — ยอด COD ค้างชำระ (บาท)
 *   noCollectionCount : number   — จำนวนพัสดุที่ไม่เก็บ COD
 *   paymentRate       : number   — อัตราชำระ COD (%) = paidCount / (paidCount + pendingCount) × 100
 *   date_from         : string | null
 *   date_to           : string | null
 *   _elapsed_ms       : number
 * }
 */

type RpcRow = {
    sum_cod?: number | string;
    cod_paid_count?: number | string;
    cod_paid_amount?: number | string;
    cod_pending_count?: number | string;
    cod_pending_amount?: number | string;
    cod_no_collection_count?: number | string;
};

export async function GET(req: Request) {
    const t0 = performance.now();
    try {
        const rateLimited = applyRateLimit(req, 'jt-shipments:cod-summary', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const dateFrom = searchParams.get('date_from')?.trim() ?? '';
        const dateTo = searchParams.get('date_to')?.trim() ?? '';

        const { data, error } = await supabaseAdmin.rpc('jt_dashboard_fixed_totals', {
            p_date_from: dateFrom,
            p_date_to: dateTo,
        });

        if (error) {
            console.error('[jt-shipments/cod-summary] RPC error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const row = (Array.isArray(data) ? data[0] : null) as RpcRow | null;

        const sumCod = Number(row?.sum_cod) || 0;
        const paidCount = Number(row?.cod_paid_count) || 0;
        const paidAmount = Number(row?.cod_paid_amount) || 0;
        const pendingCount = Number(row?.cod_pending_count) || 0;
        const pendingAmount = Number(row?.cod_pending_amount) || 0;
        const noCollectionCount = Number(row?.cod_no_collection_count) || 0;
        const collectable = paidCount + pendingCount;
        const paymentRate =
            collectable > 0 ? Math.round((paidCount / collectable) * 10000) / 100 : 0;

        const elapsed = Math.round(performance.now() - t0);
        console.log(`[jt-shipments/cod-summary] done in ${elapsed}ms`);

        return NextResponse.json({
            sumCod,
            paidCount,
            paidAmount,
            pendingCount,
            pendingAmount,
            noCollectionCount,
            paymentRate,
            date_from: dateFrom || null,
            date_to: dateTo || null,
            _elapsed_ms: elapsed,
        });
    } catch (err) {
        console.error('[jt-shipments/cod-summary] unexpected error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
