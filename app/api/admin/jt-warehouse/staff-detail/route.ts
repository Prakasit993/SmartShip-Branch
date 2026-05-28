import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/jt-warehouse/staff-detail?branch=<code>&staff=<id>
 *
 * Lazy-load รายละเอียดพนักงานนำจ่าย 1 คน — ใช้ใน modal/drawer ของหน้า /admin/jt-warehouse
 *
 * Response: { staff, counts, cod, pending_parcels } จาก RPC get_warehouse_jt_staff_detail
 */

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const branch = request.nextUrl.searchParams.get('branch')?.trim();
    const staff = request.nextUrl.searchParams.get('staff')?.trim();

    if (!branch || !staff) {
        return NextResponse.json(
            { error: 'ต้องระบุ branch และ staff' },
            { status: 400 },
        );
    }

    const { data, error } = await supabaseAdmin.rpc('get_warehouse_jt_staff_detail', {
        p_delivery_branch_code: branch,
        p_delivery_staff_id: staff,
    });

    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 },
        );
    }

    return NextResponse.json(data, {
        headers: { 'Cache-Control': 'no-store' },
    });
}
