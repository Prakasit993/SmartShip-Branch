import { NextRequest, NextResponse } from 'next/server';
import { requireAiToolAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseBookingWindow } from '@/lib/bookingDateWindow';

/**
 * สรุปตัวเลขการ์ด TikTok Shop
 * - total       : พัสดุทั้งหมด
 * - closedCount : ปิดงานแล้ว (signer_name มีค่า ไม่ใช่ null/ว่าง/'NULL')
 *
 * ตัวกรองวันที่ (optional): ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD (inclusive)
 *   - กรองตาม booking_date (dashboard ส่งหน้าต่าง 14 วันมา)
 *   - ไม่ส่ง = นับทั้งตาราง (AI tool เดิม)
 *
 * เร็ว: ใช้ RPC tiktok_dashboard_totals(p_from, p_to) นับใน Postgres (query เดียว)
 * ปลอดภัย: ถ้า RPC ยังไม่ถูกสร้าง/เป็นเวอร์ชันเก่า จะ fallback ไป count query
 */
export async function GET(request: NextRequest) {
    // AI tool: รับ admin session หรือ Bearer N8N_AI_TOOLS_SECRET (สำหรับ n8n workflow / MCP)
    const denied = await requireAiToolAuth(request);
    if (denied) return denied;

    const { from, toExclusive } = parseBookingWindow(request.url);
    const hasWindow = from !== null || toExclusive !== null;

    try {
        const { data, error } = hasWindow
            ? await supabaseAdmin.rpc('tiktok_dashboard_totals', { p_from: from, p_to: toExclusive })
            : await supabaseAdmin.rpc('tiktok_dashboard_totals');
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        return NextResponse.json({
            total: Number(row?.total) || 0,
            closedCount: Number(row?.closed_count) || 0,
        });
    } catch {
        return fallbackTotals(from, toExclusive);
    }
}

/** fallback: นับด้วย count query (ใช้เมื่อ RPC ยังไม่ถูกสร้าง/signature เก่า) */
async function fallbackTotals(from: string | null, toExclusive: string | null) {
    try {
        let totalQ = supabaseAdmin.from('tiktok_shipments').select('*', { count: 'exact', head: true });
        if (from) totalQ = totalQ.gte('booking_date', from);
        if (toExclusive) totalQ = totalQ.lt('booking_date', toExclusive);

        let closedQ = supabaseAdmin
            .from('tiktok_shipments')
            .select('*', { count: 'exact', head: true })
            .not('signer_name', 'is', null)
            .neq('signer_name', '')
            .neq('signer_name', 'NULL')
            .neq('signer_name', 'null');
        if (from) closedQ = closedQ.gte('booking_date', from);
        if (toExclusive) closedQ = closedQ.lt('booking_date', toExclusive);

        const [totalRes, closedRes] = await Promise.all([totalQ, closedQ]);
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
