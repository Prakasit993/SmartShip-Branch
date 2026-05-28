import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/jt-warehouse/cod-bucket?branch=<code>&bucket=<key>&limit=<n>
 *
 * Drill-down รายการ AWB ใน COD bucket ที่เลือก — ใช้ใน drawer ของหน้า /admin/jt-warehouse
 *
 * bucket: 'low' | 'mid' | 'high' | 'very_high'
 *   low       — < ฿1,000
 *   mid       — ฿1,000 – ฿2,000
 *   high      — ฿2,000 – ฿5,000
 *   very_high — > ฿5,000
 */

const ALLOWED_BUCKETS = new Set(['low', 'mid', 'high', 'very_high']);
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const branch = request.nextUrl.searchParams.get('branch')?.trim();
    const bucket = request.nextUrl.searchParams.get('bucket')?.trim();
    const limitRaw = request.nextUrl.searchParams.get('limit');

    if (!branch || !bucket) {
        return NextResponse.json(
            { error: 'ต้องระบุ branch และ bucket' },
            { status: 400 },
        );
    }
    if (!ALLOWED_BUCKETS.has(bucket)) {
        return NextResponse.json(
            { error: `bucket ต้องเป็นหนึ่งใน: ${Array.from(ALLOWED_BUCKETS).join(', ')}` },
            { status: 400 },
        );
    }

    const limit = Math.min(
        Math.max(Number.parseInt(limitRaw ?? '', 10) || DEFAULT_LIMIT, 1),
        MAX_LIMIT,
    );

    const { data, error } = await supabaseAdmin.rpc('get_warehouse_jt_cod_bucket_list', {
        p_delivery_branch_code: branch,
        p_bucket: bucket,
        p_limit: limit,
    });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store' },
    });
}
