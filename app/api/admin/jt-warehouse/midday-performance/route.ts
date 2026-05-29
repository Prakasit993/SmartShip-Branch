import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/jt-warehouse/midday-performance?branch=<code>[&date=YYYY-MM-DD]
 *
 * Phase 4 — Mid-day KPI gate
 * Returns RPC result: {branch_code, date, target_pct, cutoff_hour, intake_count, closed_count, ...}
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const branch = request.nextUrl.searchParams.get('branch')?.trim();
    const date = request.nextUrl.searchParams.get('date')?.trim();

    if (!branch) {
        return NextResponse.json({ error: 'ต้องระบุ branch' }, { status: 400 });
    }
    if (date && !ISO_DATE.test(date)) {
        return NextResponse.json({ error: 'date ต้องเป็น YYYY-MM-DD' }, { status: 400 });
    }

    const rpcParams: Record<string, unknown> = {
        p_delivery_branch_code: branch,
    };
    if (date) rpcParams.p_today = date;

    const { data, error } = await supabaseAdmin.rpc(
        'get_warehouse_jt_midday_performance',
        rpcParams,
    );

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store' },
    });
}
