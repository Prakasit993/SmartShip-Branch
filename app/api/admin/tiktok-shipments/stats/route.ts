import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * สรุปตัวเลขการ์ด TikTok Shop
 * - total       : พัสดุทั้งหมด
 * - closedCount : ปิดงานแล้ว (signer_name มีค่า ไม่ใช่ null/ว่าง/'NULL')
 *   → ใช้หลักการเดียวกับ jt_shipments (single source of truth)
 */
export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    try {
        const totalQuery = supabaseAdmin
            .from('tiktok_shipments')
            .select('*', { count: 'exact', head: true });

        // ปิดงานแล้ว: signer_name ไม่ใช่ null / ว่าง / 'NULL' / 'null'
        const closedQuery = supabaseAdmin
            .from('tiktok_shipments')
            .select('*', { count: 'exact', head: true })
            .not('signer_name', 'is', null)
            .neq('signer_name', '')
            .neq('signer_name', 'NULL')
            .neq('signer_name', 'null');

        const [totalRes, closedRes] = await Promise.all([totalQuery, closedQuery]);

        if (totalRes.error) throw totalRes.error;
        if (closedRes.error) throw closedRes.error;

        return NextResponse.json({
            total: totalRes.count ?? 0,
            closedCount: closedRes.count ?? 0,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[tiktok-shipments/stats]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
