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

        const senderNames = raw
            .map((r) => r.display_name)
            .filter((n): n is string => typeof n === 'string' && n.length > 0);

        type KpiCounts = { overdue3: number; overdue7: number; withIssue: number };
        const kpiMap: Record<string, KpiCounts> = {};

        if (senderNames.length > 0) {
            const senderOrFilter = senderNames.map((n) => `sender_name.ilike.${n}`).join(',');
            const openFilter = 'signer_name.is.null,signer_name.eq.,signer_name.ilike.NULL';

            const today = new Date();
            const cut3 = new Date(today);
            cut3.setUTCDate(cut3.getUTCDate() - 3);
            const cut7 = new Date(today);
            cut7.setUTCDate(cut7.getUTCDate() - 7);
            const cutStr3 = cut3.toISOString().split('T')[0];
            const cutStr7 = cut7.toISOString().split('T')[0];

            const [res3, res7, resIssue] = await Promise.allSettled([
                supabaseAdmin
                    .from('jt_shipments')
                    .select('sender_name')
                    .or(senderOrFilter)
                    .or(openFilter)
                    .not('booking_date', 'is', null)
                    .lt('booking_date', cutStr3)
                    .limit(5000),
                supabaseAdmin
                    .from('jt_shipments')
                    .select('sender_name')
                    .or(senderOrFilter)
                    .or(openFilter)
                    .not('booking_date', 'is', null)
                    .lt('booking_date', cutStr7)
                    .limit(5000),
                supabaseAdmin
                    .from('jt_shipments')
                    .select('sender_name')
                    .or(senderOrFilter)
                    .not('return_type', 'is', null)
                    .not('return_type', 'eq', '')
                    .not('return_type', 'ilike', 'EMPTY')
                    .not('return_type', 'ilike', 'NULL')
                    .not('return_type', 'eq', '-')
                    .limit(5000),
            ]);

            function tally(settled: (typeof res3), field: keyof KpiCounts) {
                if (settled.status !== 'fulfilled' || !settled.value.data) return;
                for (const row of settled.value.data) {
                    const key = ((row as { sender_name?: string }).sender_name ?? '').toLowerCase();
                    if (!key) continue;
                    if (!kpiMap[key]) kpiMap[key] = { overdue3: 0, overdue7: 0, withIssue: 0 };
                    kpiMap[key][field]++;
                }
            }

            tally(res3, 'overdue3');
            tally(res7, 'overdue7');
            tally(resIssue, 'withIssue');
        }

        const rows = raw.map((r) => {
            const kpi = kpiMap[(r.display_name ?? '').toLowerCase()] ?? { overdue3: 0, overdue7: 0, withIssue: 0 };
            return {
                id: encodeURIComponent(r.display_name ?? r.sender_key),
                name: r.display_name,
                phone: r.sender_phone,
                vip_code: r.vip_code,
                shipment_count: Number(r.shipment_count) || 0,
                overdue3: kpi.overdue3,
                overdue7: kpi.overdue7,
                withIssue: kpi.withIssue,
            };
        });

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
