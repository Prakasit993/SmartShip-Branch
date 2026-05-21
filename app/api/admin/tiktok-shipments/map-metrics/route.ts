import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { provinceToEn } from '@app/admin/(dashboard)/tiktok-dashboard/thaiProvinces';

/**
 * เมตริกรายจังหวัดสำหรับแผนที่อัตราปัญหา (เฟส 1)
 * - provinces        : { [en]: { total, notClosed, issue } }
 * - reasons          : [{ reason, total }]  (top N เรียงมาก→น้อย)
 * - reasonByProvince : { [reason]: { [en]: count } }
 *
 * ดึงจาก RPC tiktok_province_metrics() + tiktok_province_reason()
 * โหลดครั้งเดียว → dropdown สลับฝั่ง client ล้วน (เร็ว)
 */
export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    try {
        const [metricsRes, reasonRes] = await Promise.all([
            supabaseAdmin.rpc('tiktok_province_metrics'),
            supabaseAdmin.rpc('tiktok_province_reason', { top_n: 15 }),
        ]);
        if (metricsRes.error) throw metricsRes.error;
        if (reasonRes.error) throw reasonRes.error;

        // เมตริกคงที่รายจังหวัด
        const provinces: Record<string, { total: number; notClosed: number; issue: number }> = {};
        for (const r of (metricsRes.data ?? []) as Array<{
            province: string | null; total: number | string; not_closed: number | string; issue: number | string;
        }>) {
            const en = provinceToEn(r.province);
            if (!en) continue;
            const cur = provinces[en] ?? { total: 0, notClosed: 0, issue: 0 };
            cur.total += Number(r.total) || 0;
            cur.notClosed += Number(r.not_closed) || 0;
            cur.issue += Number(r.issue) || 0;
            provinces[en] = cur;
        }

        // เหตุผล × จังหวัด
        const reasonTotals: Record<string, number> = {};
        const reasonByProvince: Record<string, Record<string, number>> = {};
        for (const r of (reasonRes.data ?? []) as Array<{
            reason: string | null; province: string | null; cnt: number | string;
        }>) {
            const reason = (r.reason || '').trim();
            if (!reason) continue;
            const en = provinceToEn(r.province);
            if (!en) continue;
            const n = Number(r.cnt) || 0;
            reasonTotals[reason] = (reasonTotals[reason] || 0) + n;
            if (!reasonByProvince[reason]) reasonByProvince[reason] = {};
            reasonByProvince[reason][en] = (reasonByProvince[reason][en] || 0) + n;
        }
        const reasons = Object.entries(reasonTotals)
            .map(([reason, total]) => ({ reason, total }))
            .sort((a, b) => b.total - a.total);

        return NextResponse.json({ provinces, reasons, reasonByProvince });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[tiktok-shipments/map-metrics]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
