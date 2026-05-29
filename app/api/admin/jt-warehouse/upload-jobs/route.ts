import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/jt-warehouse/upload-jobs?request_id=<uuid>
 *
 * Polling endpoint — Modal เรียกซ้ำเพื่อเช็คสถานะ job
 * Returns null status เมื่อไม่พบ (เผื่อ race condition ตอน insert)
 */

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const requestId = request.nextUrl.searchParams.get('request_id')?.trim();
    if (!requestId) {
        return NextResponse.json({ error: 'request_id required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from('jt_upload_jobs')
        .select('id, request_id, kind, status, file_name, started_at, finished_at, stats, error')
        .eq('request_id', requestId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ job: null }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    return NextResponse.json(
        { job: data },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
