import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';
import { JT_RETURN_ACKNOWLEDGEMENTS_TABLE } from '@/lib/jtReturnAcknowledgements';

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

        type KpiCounts = { overdue3: number; overdue7: number };
        const kpiMap: Record<string, KpiCounts> = {};
        // anomaly (น้ำหนักผิดปกติ/ปรับยอด) คำนวณใน SQL ผ่าน RPC แยก — แม่นทุก shipment
        const anomalyMap: Record<string, number> = {};

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

            const [res3, res7, resAnomaly, resAcks] = await Promise.allSettled([
                supabaseAdmin
                    .from('jt_shipments')
                    .select('sender_name, awb_number')
                    .or(senderOrFilter)
                    .or(openFilter)
                    .not('booking_date', 'is', null)
                    .lt('booking_date', cutStr3)
                    .limit(5000),
                supabaseAdmin
                    .from('jt_shipments')
                    .select('sender_name, awb_number')
                    .or(senderOrFilter)
                    .or(openFilter)
                    .not('booking_date', 'is', null)
                    .lt('booking_date', cutStr7)
                    .limit(5000),
                supabaseAdmin.rpc('customer_anomaly_counts', { p_sender_names: senderNames }),
                // AWB ที่แอดมินรับทราบแล้ว (kind='overdue') — ตัดออกให้ตรงกับหน้า detail
                supabaseAdmin
                    .from(JT_RETURN_ACKNOWLEDGEMENTS_TABLE)
                    .select('awb_number')
                    .eq('status', 'active')
                    .eq('kind', 'overdue'),
            ]);

            const ackedOverdue = new Set<string>();
            if (resAcks.status === 'fulfilled' && Array.isArray(resAcks.value.data)) {
                for (const r of resAcks.value.data) {
                    const awb = String((r as { awb_number?: string }).awb_number ?? '').trim();
                    if (awb) ackedOverdue.add(awb);
                }
            }

            function tally(settled: (typeof res3), field: keyof KpiCounts) {
                if (settled.status !== 'fulfilled' || !settled.value.data) return;
                for (const row of settled.value.data) {
                    const r = row as { sender_name?: string; awb_number?: string };
                    const awb = String(r.awb_number ?? '').trim();
                    if (awb && ackedOverdue.has(awb)) continue; // ack แล้ว → ไม่นับ (ตรงกับ detail)
                    const key = (r.sender_name ?? '').toLowerCase();
                    if (!key) continue;
                    if (!kpiMap[key]) kpiMap[key] = { overdue3: 0, overdue7: 0 };
                    kpiMap[key][field]++;
                }
            }

            tally(res3, 'overdue3');
            tally(res7, 'overdue7');

            if (resAnomaly.status === 'fulfilled' && Array.isArray(resAnomaly.value.data)) {
                for (const r of resAnomaly.value.data as Array<{ sender_key?: string; anomaly_count?: number | string }>) {
                    const key = (r.sender_key ?? '').toLowerCase();
                    if (key) anomalyMap[key] = Number(r.anomaly_count) || 0;
                }
            } else if (resAnomaly.status === 'rejected') {
                console.warn('[customer-profile list] anomaly RPC failed:', resAnomaly.reason);
            }
        }

        // Batch-fetch override_phone from customers table by sender_key
        const senderKeys = raw.map((r) => r.sender_key).filter((k): k is string => !!k);
        const overrideMap: Record<string, string | null> = {};
        if (senderKeys.length > 0) {
            const { data: overrides } = await supabaseAdmin
                .from('customers')
                .select('sender_key, override_phone')
                .in('sender_key', senderKeys);
            if (overrides) {
                for (const o of overrides) {
                    if (o.sender_key) overrideMap[o.sender_key] = (o.override_phone as string | null) ?? null;
                }
            }
        }

        const rows = raw.map((r) => {
            const key = (r.display_name ?? '').toLowerCase();
            const kpi = kpiMap[key] ?? { overdue3: 0, overdue7: 0 };
            return {
                id: encodeURIComponent(r.display_name ?? r.sender_key),
                name: r.display_name,
                phone: r.sender_phone,
                override_phone: overrideMap[r.sender_key] ?? null,
                vip_code: r.vip_code,
                shipment_count: Number(r.shipment_count) || 0,
                overdue3: kpi.overdue3,
                overdue7: kpi.overdue7,
                anomalyCount: anomalyMap[key] ?? 0,
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
