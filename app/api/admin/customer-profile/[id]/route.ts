import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/customer-profile/[id]
 *
 * รายละเอียดลูกค้า 1 คน — เรียก RPC `get_customer_profile_summary` ตัวเดียว
 * ที่ aggregate KPI / weight / COD / financial / shipments(200) ใน SQL
 *
 * รับ id 2 รูปแบบ:
 *   1) UUID — registered LINE user ใน public.customers
 *   2) URI-encoded sender_name — ผู้ส่งจาก jt_shipments ที่ยังไม่ register
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CACHE_HEADERS = {
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
};

function isNonEmpty(v: unknown): boolean {
    if (v == null) return false;
    const s = String(v).trim();
    if (!s) return false;
    if (s.toUpperCase() === 'NULL' || s === '-') return false;
    return true;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const rateLimited = applyRateLimit(req, 'customer-profile:detail', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { id: rawId } = await context.params;
        if (!rawId) {
            return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 });
        }

        let customer: {
            id: string;
            name: string | null;
            phone: string | null;
            vip_code: string | null;
            address: string | null;
            created_at: string | null;
        } | null = null;
        let senderName = '';

        if (UUID_RE.test(rawId)) {
            const { data, error: custErr } = await supabaseAdmin
                .from('customers')
                .select('id, name, phone, vip_code, address, created_at')
                .eq('id', rawId)
                .maybeSingle();
            if (custErr) {
                console.error('[customer-profile detail] customer fetch:', custErr);
                return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลลูกค้า' }, { status: 500 });
            }
            if (!data) {
                return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });
            }
            customer = data;
            senderName = (data.name ?? '').trim();
        } else {
            let decoded: string;
            try {
                decoded = decodeURIComponent(rawId).trim();
            } catch {
                return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 });
            }
            if (!decoded) {
                return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 });
            }
            senderName = decoded;
            const { data: matched } = await supabaseAdmin
                .from('customers')
                .select('id, name, phone, vip_code, address, created_at')
                .ilike('name', decoded)
                .limit(1);
            customer = matched && matched.length > 0 ? matched[0] : {
                id: rawId,
                name: decoded,
                phone: null,
                vip_code: null,
                address: null,
                created_at: null,
            };
        }

        if (!senderName) {
            return NextResponse.json(
                {
                    customer,
                    kpi: { total: 0, closed: 0, pendingWithin3Days: 0, pendingWithin7Days: 0, withIssue: 0 },
                    weight: {
                        samples: { billed: 0, order: 0, gateway: 0 },
                        sum: { billed: 0, order: 0, gateway: 0 },
                        avg: { billed: 0, order: 0, gateway: 0 },
                        adjustedCount: 0,
                    },
                    cod: { totalAmount: 0, paidCount: 0, paidAmount: 0, pendingCount: 0, pendingAmount: 0, noCollectionCount: 0 },
                    financial: null,
                    date_range: null,
                    shipments: [],
                    shipments_total: 0,
                    shipments_truncated: false,
                },
                { headers: CACHE_HEADERS }
            );
        }

        const { data: summary, error: summaryErr } = await supabaseAdmin.rpc(
            'get_customer_profile_summary',
            { p_sender_name: senderName }
        );

        if (summaryErr) {
            console.error('[customer-profile detail] RPC failed:', summaryErr);
            return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลลูกค้า' }, { status: 500 });
        }

        // RPC คืน jsonb — Supabase client unwrap เป็น object/array แล้ว
        const payload = (summary ?? {}) as {
            kpi: unknown;
            weight: unknown;
            cod: unknown;
            financial: unknown;
            date_range: unknown;
            shipments: unknown[];
            shipments_total: number;
            shipments_truncated: boolean;
            latest_vip_code: string | null;
        };

        // ถ้าลูกค้ายังไม่มี vip_code จาก customers — ใช้ vip_code ล่าสุดจาก shipments ที่ RPC คืนมา
        if (customer && !isNonEmpty(customer.vip_code) && isNonEmpty(payload.latest_vip_code)) {
            customer = { ...customer, vip_code: payload.latest_vip_code };
        }

        return NextResponse.json(
            {
                customer,
                kpi: payload.kpi,
                weight: payload.weight,
                cod: payload.cod,
                financial: payload.financial,
                date_range: payload.date_range,
                shipments: payload.shipments,
                shipments_total: payload.shipments_total,
                shipments_truncated: payload.shipments_truncated,
            },
            { headers: CACHE_HEADERS }
        );
    } catch (e) {
        console.error('[api/admin/customer-profile/[id]][GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
