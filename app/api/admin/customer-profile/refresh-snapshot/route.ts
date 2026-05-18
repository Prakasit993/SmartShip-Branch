import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth, verifyN8nSnapshotRefreshSecret } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_BULK } from '@/lib/rateLimit';

/**
 * POST /api/admin/customer-profile/refresh-snapshot
 *
 * เรียก RPC `refresh_customer_financial_snapshot` ที่ rebuild ทั้งตาราง
 * customer_financial_snapshot — ใช้เวลา ~1-5 วินาทีตามขนาด jt_shipments
 *
 * เรียก nightly จาก n8n cron node — auth ด้วย N8N_SNAPSHOT_REFRESH_SECRET
 * (Bearer หรือ X-N8N-Snapshot-Refresh-Secret header)
 *
 * ถ้ายังไม่ตั้ง env var จะ fallback เป็น admin session — สำหรับ test ตอน dev
 */
export async function POST(req: Request) {
    try {
        const rateLimited = applyRateLimit(req, 'customer-profile:refresh-snapshot', RATE_LIMIT_BULK);
        if (rateLimited) return rateLimited;

        if (process.env.N8N_SNAPSHOT_REFRESH_SECRET?.trim()) {
            if (!verifyN8nSnapshotRefreshSecret(req)) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        } else {
            const denied = await requireAdminApiAuth('admin-only', req);
            if (denied) return denied;
        }

        const { data, error } = await supabaseAdmin.rpc('refresh_customer_financial_snapshot');

        if (error) {
            console.error('[customer-profile refresh-snapshot] RPC failed:', error);
            return NextResponse.json(
                { error: 'Snapshot refresh failed — check server logs' },
                { status: 500 }
            );
        }

        // RPC คืน table 1 row: { rows_upserted, took_ms, refreshed_at }
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

        return NextResponse.json({
            success: true,
            rows_upserted: row?.rows_upserted ?? 0,
            took_ms: row?.took_ms ?? 0,
            refreshed_at: row?.refreshed_at ?? null,
        });
    } catch (e) {
        console.error('[customer-profile refresh-snapshot] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
