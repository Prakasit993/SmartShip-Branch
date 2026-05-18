import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdminApiAccess, requireAdminApiAuth } from '@/lib/adminApiAuth';
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
 *
 * Merge override จาก customers (override_phone, override_name, admin_notes) +
 * recent history (5 รายการล่าสุด)
 *
 * PATCH /api/admin/customer-profile/[id]
 * Admin-only — แก้ override fields + บันทึก history
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HISTORY_LIMIT = 10;

const CACHE_HEADERS = {
    'Cache-Control': 'private, max-age=30, stale-while-revalidate=120',
};

type CustomerRow = {
    id: string;
    name: string | null;
    phone: string | null;
    vip_code: string | null;
    address: string | null;
    created_at: string | null;
    sender_key: string | null;
    override_phone: string | null;
    override_name: string | null;
    admin_notes: string | null;
    updated_by: string | null;
    updated_at: string | null;
};

type HistoryRow = {
    id: number;
    changed_field: 'override_phone' | 'override_name' | 'admin_notes';
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
    changed_at: string;
};

const CUSTOMER_COLS =
    'id, name, phone, vip_code, address, created_at, sender_key, override_phone, override_name, admin_notes, updated_by, updated_at';

function isNonEmpty(v: unknown): boolean {
    if (v == null) return false;
    const s = String(v).trim();
    if (!s) return false;
    if (s.toUpperCase() === 'NULL' || s === '-') return false;
    return true;
}

async function fetchHistory(customerId: string): Promise<HistoryRow[]> {
    const { data, error } = await supabaseAdmin
        .from('customer_contact_history')
        .select('id, changed_field, old_value, new_value, changed_by, changed_at')
        .eq('customer_id', customerId)
        .order('changed_at', { ascending: false })
        .limit(HISTORY_LIMIT);
    if (error) {
        console.warn('[customer-profile] history fetch failed:', error.message);
        return [];
    }
    return (data ?? []) as HistoryRow[];
}

type ResolvedCustomer = {
    customer: CustomerRow;
    senderName: string;
    fromDb: boolean;
};

async function resolveCustomer(rawId: string): Promise<ResolvedCustomer | { error: string; status: number }> {
    if (UUID_RE.test(rawId)) {
        const { data, error } = await supabaseAdmin
            .from('customers')
            .select(CUSTOMER_COLS)
            .eq('id', rawId)
            .maybeSingle();
        if (error) {
            console.error('[customer-profile] customer fetch:', error);
            return { error: 'ไม่สามารถโหลดข้อมูลลูกค้า', status: 500 };
        }
        if (!data) {
            return { error: 'ไม่พบลูกค้า', status: 404 };
        }
        const row = data as CustomerRow;
        return { customer: row, senderName: (row.name ?? '').trim(), fromDb: true };
    }

    let decoded: string;
    try {
        decoded = decodeURIComponent(rawId).trim();
    } catch {
        return { error: 'ID ไม่ถูกต้อง', status: 400 };
    }
    if (!decoded) {
        return { error: 'ID ไม่ถูกต้อง', status: 400 };
    }
    const senderKey = decoded.toLowerCase();

    const { data: matched } = await supabaseAdmin
        .from('customers')
        .select(CUSTOMER_COLS)
        .eq('sender_key', senderKey)
        .limit(1);

    if (matched && matched.length > 0) {
        return { customer: matched[0] as CustomerRow, senderName: decoded, fromDb: true };
    }

    return {
        customer: {
            id: rawId,
            name: decoded,
            phone: null,
            vip_code: null,
            address: null,
            created_at: null,
            sender_key: senderKey,
            override_phone: null,
            override_name: null,
            admin_notes: null,
            updated_by: null,
            updated_at: null,
        },
        senderName: decoded,
        fromDb: false,
    };
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

        const resolved = await resolveCustomer(rawId);
        if ('error' in resolved) {
            return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        }
        const { customer, senderName, fromDb } = resolved;

        const history = fromDb ? await fetchHistory(customer.id) : [];

        if (!senderName) {
            return NextResponse.json(
                {
                    customer,
                    history,
                    kpi: { total: 0, closed: 0, pendingWithin3Days: 0, pendingWithin7Days: 0, withIssue: 0 },
                    weight: {
                        samples: { billed: 0, order: 0, gateway: 0 },
                        sum: { billed: 0, order: 0, gateway: 0 },
                        avg: { billed: 0, order: 0, gateway: 0 },
                        adjustedCount: 0,
                    },
                    cod: { totalAmount: 0, paidCount: 0, paidAmount: 0, pendingCount: 0, pendingAmount: 0, noCollectionCount: 0 },
                    financial: null,
                    financial_refreshed_at: null,
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

        const payload = (summary ?? {}) as {
            kpi: unknown;
            weight: unknown;
            cod: unknown;
            financial: unknown;
            financial_refreshed_at: string | null;
            date_range: unknown;
            shipments: unknown[];
            shipments_total: number;
            shipments_truncated: boolean;
            latest_vip_code: string | null;
        };

        let finalCustomer: CustomerRow = customer;
        if (!isNonEmpty(finalCustomer.vip_code) && isNonEmpty(payload.latest_vip_code)) {
            finalCustomer = { ...finalCustomer, vip_code: payload.latest_vip_code };
        }

        return NextResponse.json(
            {
                customer: finalCustomer,
                history,
                kpi: payload.kpi,
                weight: payload.weight,
                cod: payload.cod,
                financial: payload.financial,
                financial_refreshed_at: payload.financial_refreshed_at,
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

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const rateLimited = applyRateLimit(req, 'customer-profile:detail:patch', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        // admin-only — staff ห้ามแก้ข้อมูลติดต่อ
        const denied = await requireAdminApiAuth('admin-only', req);
        if (denied) return denied;

        const access = await getAdminApiAccess(req);
        const changedBy = access.email || 'unknown-admin';

        const { id: rawId } = await context.params;
        if (!rawId) {
            return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 });
        }

        const resolved = await resolveCustomer(rawId);
        if ('error' in resolved) {
            return NextResponse.json({ error: resolved.error }, { status: resolved.status });
        }
        const { customer, senderName } = resolved;

        const body = (await req.json().catch(() => ({}))) as {
            override_phone?: string | null;
            override_name?: string | null;
            admin_notes?: string | null;
            clear_phone?: boolean;
            clear_name?: boolean;
            clear_notes?: boolean;
        };

        // validate
        const phoneVal = body.override_phone;
        const nameVal = body.override_name;
        const notesVal = body.admin_notes;
        if (
            phoneVal === undefined &&
            nameVal === undefined &&
            notesVal === undefined &&
            !body.clear_phone &&
            !body.clear_name &&
            !body.clear_notes
        ) {
            return NextResponse.json({ error: 'ไม่มี field ที่จะแก้' }, { status: 400 });
        }

        // size guards
        if (typeof phoneVal === 'string' && phoneVal.length > 50) {
            return NextResponse.json({ error: 'override_phone ยาวเกิน 50 ตัวอักษร' }, { status: 400 });
        }
        if (typeof nameVal === 'string' && nameVal.length > 200) {
            return NextResponse.json({ error: 'override_name ยาวเกิน 200 ตัวอักษร' }, { status: 400 });
        }
        if (typeof notesVal === 'string' && notesVal.length > 2000) {
            return NextResponse.json({ error: 'admin_notes ยาวเกิน 2000 ตัวอักษร' }, { status: 400 });
        }

        const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
            'upsert_customer_contact_override',
            {
                p_customer_id: UUID_RE.test(customer.id) ? customer.id : null,
                p_sender_key: customer.sender_key ?? senderName.toLowerCase(),
                p_sender_name: senderName,
                p_override_phone: phoneVal ?? null,
                p_override_name: nameVal ?? null,
                p_admin_notes: notesVal ?? null,
                p_changed_by: changedBy,
                p_clear_phone: !!body.clear_phone,
                p_clear_name: !!body.clear_name,
                p_clear_notes: !!body.clear_notes,
            }
        );

        if (rpcErr) {
            console.error('[customer-profile patch] RPC failed:', rpcErr);
            return NextResponse.json({ error: 'บันทึกข้อมูลไม่สำเร็จ' }, { status: 500 });
        }

        const result = (rpcRes ?? {}) as {
            customer_id: string;
            updated_at: string;
            updated_by: string;
        };

        // โหลด row ที่อัพเดทแล้ว + history ล่าสุด ให้ client refresh ทันที
        const [customerRes, historyRes] = await Promise.all([
            supabaseAdmin.from('customers').select(CUSTOMER_COLS).eq('id', result.customer_id).maybeSingle(),
            fetchHistory(result.customer_id),
        ]);

        return NextResponse.json({
            success: true,
            customer: customerRes.data as CustomerRow | null,
            history: historyRes,
        });
    } catch (e) {
        console.error('[api/admin/customer-profile/[id]][PATCH]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
