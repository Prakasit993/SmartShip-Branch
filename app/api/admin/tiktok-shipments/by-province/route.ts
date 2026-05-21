import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { provinceToEn } from '@app/admin/(dashboard)/tiktok-dashboard/thaiProvinces';

/**
 * นับพัสดุ TikTok รายจังหวัดปลายทาง (สำหรับแผนที่)
 * - counts   : { [englishProvinceName]: number }  ← จับคู่กับ GeoJSON
 * - matched  : จำนวนพัสดุที่ระบุจังหวัดได้
 * - unmatched: จำนวนพัสดุที่ชื่อจังหวัดไม่ตรงมาตรฐาน (จับคู่ไม่ได้)
 *
 * เร็ว: RPC tiktok_by_province() นับใน Postgres (~77 แถว)
 * ปลอดภัย: ถ้า RPC ยังไม่ถูกสร้าง fallback ไป group ผ่าน select
 */
export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    try {
        let rows: Array<{ province: string | null; cnt: number | string }>;

        const rpc = await supabaseAdmin.rpc('tiktok_by_province');
        if (rpc.error) {
            rows = await fallbackByProvince();
        } else {
            rows = (rpc.data ?? []) as typeof rows;
        }

        const counts: Record<string, number> = {};
        let matched = 0;
        let unmatched = 0;

        for (const r of rows) {
            const n = Number(r.cnt) || 0;
            const en = provinceToEn(r.province);
            if (en) {
                counts[en] = (counts[en] || 0) + n;
                matched += n;
            } else {
                unmatched += n;
            }
        }

        return NextResponse.json({ counts, matched, unmatched });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[tiktok-shipments/by-province]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/** fallback: group dest_province ผ่าน select + นับใน JS (เมื่อ RPC ยังไม่ถูกสร้าง) */
async function fallbackByProvince(): Promise<Array<{ province: string; cnt: number }>> {
    const AGG_PAGE_SIZE = 1000;
    let offset = 0;
    const map: Record<string, number> = {};

    for (;;) {
        const { data, error } = await supabaseAdmin
            .from('tiktok_shipments')
            .select('dest_province')
            .not('dest_province', 'is', null)
            .range(offset, offset + AGG_PAGE_SIZE - 1);
        if (error) throw error;

        const list = (data || []) as Array<{ dest_province: string | null }>;
        for (const r of list) {
            const p = (r.dest_province || '').trim();
            if (!p) continue;
            map[p] = (map[p] || 0) + 1;
        }
        if (list.length < AGG_PAGE_SIZE) break;
        offset += AGG_PAGE_SIZE;
    }

    return Object.entries(map).map(([province, cnt]) => ({ province, cnt }));
}
