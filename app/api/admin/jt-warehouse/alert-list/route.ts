import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/jt-warehouse/alert-list?branch=<code>&kind=<key>&limit=<n>&date_from=&date_to=
 *
 * Drill-down รายการ AWB ของ alert kind ที่เลือก — ใช้ใน drawer
 *
 * kind: 'pending' | 'stuck' | 'problem'
 *   pending — ยังไม่ปิดงาน (6 ฟิลด์ signed_* ไม่ครบ)
 *   stuck   — stuck_flag = 'Y'
 *   problem — problem_time มีค่า
 */

const ALLOWED_KINDS = new Set(['pending', 'stuck', 'problem']);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const branch = request.nextUrl.searchParams.get('branch')?.trim();
    const kind = request.nextUrl.searchParams.get('kind')?.trim();
    const limitRaw = request.nextUrl.searchParams.get('limit');
    const dateFrom = request.nextUrl.searchParams.get('date_from')?.trim();
    const dateTo = request.nextUrl.searchParams.get('date_to')?.trim();

    if (!branch || !kind) {
        return NextResponse.json({ error: 'ต้องระบุ branch และ kind' }, { status: 400 });
    }
    if (!ALLOWED_KINDS.has(kind)) {
        return NextResponse.json(
            { error: `kind ต้องเป็นหนึ่งใน: ${Array.from(ALLOWED_KINDS).join(', ')}` },
            { status: 400 },
        );
    }
    if (dateFrom && !ISO_DATE.test(dateFrom)) {
        return NextResponse.json({ error: 'date_from ต้องเป็น YYYY-MM-DD' }, { status: 400 });
    }
    if (dateTo && !ISO_DATE.test(dateTo)) {
        return NextResponse.json({ error: 'date_to ต้องเป็น YYYY-MM-DD' }, { status: 400 });
    }

    const limit = Math.min(
        Math.max(Number.parseInt(limitRaw ?? '', 10) || DEFAULT_LIMIT, 1),
        MAX_LIMIT,
    );

    const rpcParams: Record<string, unknown> = {
        p_delivery_branch_code: branch,
        p_kind: kind,
        p_limit: limit,
    };
    if (dateFrom) rpcParams.p_date_from = dateFrom;
    if (dateTo) rpcParams.p_date_to = dateTo;

    const { data, error } = await supabaseAdmin.rpc('get_warehouse_jt_alert_list', rpcParams);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store' },
    });
}
