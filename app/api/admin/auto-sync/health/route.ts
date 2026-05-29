import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/admin/auto-sync/health
 *
 * คืนสถานะ auto-sync ของทุก portal — UI ใช้แสดงใน health card
 * Response: { items: [{ kind, schedule_label, last_finished_at, last_status, is_stale, ... }] }
 */

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const { data, error } = await supabaseAdmin.rpc('get_auto_sync_health');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
        { items: data ?? [] },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
