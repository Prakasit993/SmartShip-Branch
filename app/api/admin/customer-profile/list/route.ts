import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/customer-profile/list
 *
 * Query: ?tab=vip|general &search=... &limit=20 &offset=0
 *
 * เรียก RPC `list_customer_profiles` ที่ aggregate sender_name จาก jt_shipments
 * แยก VIP/general จาก jt_shipments.vip_code, paginate + search ใน SQL.
 * เห็นผู้ส่งทุกคน (รวมที่ไม่ได้ register LINE — ไม่มี row ใน customers)
 *
 * Response 200:
 * {
 *   rows: Array<{
 *     id: string;            // encoded sender_name (URI-encoded), ใช้เปิดหน้า detail
 *     name: string;
 *     phone: string | null;
 *     vip_code: string | null;
 *     shipment_count: number;
 *   }>,
 *   total: number,
 *   tab: 'vip' | 'general',
 *   limit: number,
 *   offset: number,
 * }
 */

type TabKey = 'vip' | 'general';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function parseTab(v: string | null): TabKey {
    return v === 'general' ? 'general' : 'vip';
}

function parseIntInRange(v: string | null, fallback: number, min: number, max: number): number {
    if (v == null) return fallback;
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
}

export async function GET(req: Request) {
    try {
        const rateLimited = applyRateLimit(req, 'customer-profile:list', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const url = new URL(req.url);
        const tab = parseTab(url.searchParams.get('tab'));
        const search = (url.searchParams.get('search') ?? '').trim();
        const limit = parseIntInRange(url.searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
        const offset = parseIntInRange(url.searchParams.get('offset'), 0, 0, 100_000);

        const { data, error } = await supabaseAdmin.rpc('list_customer_profiles', {
            p_search: search || null,
            p_tab: tab,
            p_limit: limit,
            p_offset: offset,
        });

        if (error) {
            console.error('[customer-profile list] RPC failed:', error);
            return NextResponse.json({ error: 'ไม่สามารถโหลดรายชื่อลูกค้า' }, { status: 500 });
        }

        const raw = (data ?? []) as Array<{
            sender_key: string;
            display_name: string | null;
            sender_phone: string | null;
            vip_code: string | null;
            shipment_count: number | string;
            total_count: number | string;
        }>;

        const rows = raw.map((r) => ({
            // ใช้ display_name (ที่ยังไม่ lower-case) เพื่อให้ detail page query ตรงกับข้อมูลจริง
            id: encodeURIComponent(r.display_name ?? r.sender_key),
            name: r.display_name,
            phone: r.sender_phone,
            vip_code: r.vip_code,
            shipment_count: Number(r.shipment_count) || 0,
        }));

        const total = raw.length > 0 ? Number(raw[0].total_count) || 0 : 0;

        return NextResponse.json(
            {
                rows,
                total,
                tab,
                limit,
                offset,
            },
            {
                headers: {
                    'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
                },
            }
        );
    } catch (e) {
        console.error('[api/admin/customer-profile/list][GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
