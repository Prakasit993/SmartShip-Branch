import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/jt-warehouse/staff-detail?branch=<code>&staff=<id>&date_from=<YYYY-MM-DD>&date_to=<YYYY-MM-DD>
 *
 * Lazy-load รายละเอียดพนักงานนำจ่าย 1 คน — ใช้ใน modal/drawer ของหน้า /admin/jt-warehouse
 * date_from/date_to optional — ถ้าไม่ส่ง = ดูทั้งหมด (= toggle "ทั้งหมด")
 *
 * Response: { staff, counts, cod, pending_parcels } จาก RPC get_warehouse_jt_staff_detail
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const branch = request.nextUrl.searchParams.get('branch')?.trim();
    const staff = request.nextUrl.searchParams.get('staff')?.trim();
    const dateFrom = request.nextUrl.searchParams.get('date_from')?.trim();
    const dateTo = request.nextUrl.searchParams.get('date_to')?.trim();

    if (!branch || !staff) {
        return NextResponse.json(
            { error: 'ต้องระบุ branch และ staff' },
            { status: 400 },
        );
    }
    if (dateFrom && !ISO_DATE.test(dateFrom)) {
        return NextResponse.json({ error: 'date_from ต้องเป็น YYYY-MM-DD' }, { status: 400 });
    }
    if (dateTo && !ISO_DATE.test(dateTo)) {
        return NextResponse.json({ error: 'date_to ต้องเป็น YYYY-MM-DD' }, { status: 400 });
    }

    const rpcParams: Record<string, unknown> = {
        p_delivery_branch_code: branch,
        p_delivery_staff_id: staff,
    };
    if (dateFrom) rpcParams.p_date_from = dateFrom;
    if (dateTo) rpcParams.p_date_to = dateTo;

    const { data, error } = await supabaseAdmin.rpc('get_warehouse_jt_staff_detail', rpcParams);

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
