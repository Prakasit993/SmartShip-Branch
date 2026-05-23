import { NextRequest, NextResponse } from 'next/server';
import { requireAiToolAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * สรุปตัวเลขการ์ด TikTok Shop
 * - total       : พัสดุทั้งหมด
 * - closedCount : ปิดงานแล้ว (signer_name มีค่า ไม่ใช่ null/ว่าง/'NULL')
 *
 * เร็ว: ใช้ RPC tiktok_dashboard_totals() นับใน Postgres (query เดียว)
 * ปลอดภัย: ถ้า RPC ยังไม่ถูกสร้าง (ก่อนรัน migration) จะ fallback ไป count query
 */
export async function GET(request: NextRequest) {
    // AI tool: รับ admin session หรือ Bearer N8N_AI_TOOLS_SECRET (สำหรับ n8n workflow / MCP)
    const denied = await requireAiToolAuth(request);
    if (denied) return denied;

    try {
        const { data, error } = await supabaseAdmin.rpc('tiktok_dashboard_totals');
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        return NextResponse.json({
            total: Number(row?.total) || 0,
            closedCount: Number(row?.closed_count) || 0,
        });
    } catch {
        return fallbackTotals();
    }
}

/** fallback: นับด้วย count query (ใช้เมื่อ RPC ยังไม่ถูกสร้าง) */
async function fallbackTotals() {
    try {
        const [totalRes, closedRes] = await Promise.all([
            supabaseAdmin.from('tiktok_shipments').select('*', { count: 'exact', head: true }),
            supabaseAdmin
                .from('tiktok_shipments')
                .select('*', { count: 'exact', head: true })
                .not('signer_name', 'is', null)
                .neq('signer_name', '')
                .neq('signer_name', 'NULL')
                .neq('signer_name', 'null'),
        ]);
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
