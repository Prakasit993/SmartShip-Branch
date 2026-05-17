import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';
import { parseJtMoneyText } from '@/lib/jtMoneyText';

/**
 * GET /api/admin/customer-profile/[id]
 *
 * รายละเอียดลูกค้า 1 คน:
 *   1) ข้อมูลลูกค้า (name, phone, vip_code, created_at)
 *   2) KPI พัสดุ (total / สำเร็จ / ≤3 วัน / ≤7 วัน / มีปัญหา)
 *   3) สรุปน้ำหนัก (billed vs order vs gateway) — เน้นการตรวจน้ำหนักถูกปรับ
 *   4) สรุป COD (รวม / paid / pending / no-collection)
 *   5) สรุปกำไรจาก RPC get_financial_customer_breakdown_billable_weight (ถ้าเข้า top 50)
 *   6) ตารางพัสดุของลูกค้านี้ (limit 200)
 *
 * จับคู่ shipments ↔ customer ผ่าน sender_name = customer.name (case-insensitive trim)
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHIPMENT_LIST_LIMIT = 200;
const SHIPMENT_PAGE_SIZE = 1000;
const SHIPMENT_MAX_PAGES = 20;

type ShipmentRow = {
    awb_number: string | null;
    booking_date: string | null;
    sender_name: string | null;
    signer_name: string | null;
    signed_time: string | null;
    issue_status: string | null;
    return_type: string | null;
    exception_reason: string | null;
    latest_scan_type: string | null;
    latest_scan_time: string | null;
    billed_weight: string | null;
    order_weight: string | null;
    gateway_weight: string | null;
    received_weight: string | null;
    cod_amount: string | null;
    cod_status: string | null;
    cod_payment_method: string | null;
    cod_payment_time: string | null;
    total_shipping_fee: string | null;
    shipping_fee: string | null;
};

function isNonEmpty(v: unknown): boolean {
    if (v == null) return false;
    const s = String(v).trim();
    if (!s) return false;
    if (s.toUpperCase() === 'NULL' || s === '-') return false;
    return true;
}

function parseYmd(s: string | null | undefined): number | null {
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

function diffDaysUtc(fromMs: number, toMs: number): number {
    return Math.floor((toMs - fromMs) / 86_400_000);
}

async function fetchCustomerShipments(senderName: string): Promise<ShipmentRow[]> {
    const all: ShipmentRow[] = [];
    for (let page = 0; page < SHIPMENT_MAX_PAGES; page += 1) {
        const from = page * SHIPMENT_PAGE_SIZE;
        const to = from + SHIPMENT_PAGE_SIZE - 1;
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select(
                [
                    'awb_number',
                    'booking_date',
                    'sender_name',
                    'signer_name',
                    'signed_time',
                    'issue_status',
                    'return_type',
                    'exception_reason',
                    'latest_scan_type',
                    'latest_scan_time',
                    'billed_weight',
                    'order_weight',
                    'gateway_weight',
                    'received_weight',
                    'cod_amount',
                    'cod_status',
                    'cod_payment_method',
                    'cod_payment_time',
                    'total_shipping_fee',
                    'shipping_fee',
                ].join(',')
            )
            // case-insensitive exact match — sender_name อาจมีช่องว่างนำหน้า/ท้าย
            .ilike('sender_name', senderName)
            .order('booking_date', { ascending: false })
            .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as unknown as ShipmentRow[]));
        if (data.length < SHIPMENT_PAGE_SIZE) break;
    }
    return all;
}

type Kpi = {
    total: number;
    closed: number;
    closedWithin3Days: number;
    closedWithin7Days: number;
    withIssue: number;
};

function computeKpi(rows: ShipmentRow[]): Kpi {
    let closed = 0;
    let closedWithin3 = 0;
    let closedWithin7 = 0;
    let withIssue = 0;
    for (const r of rows) {
        const isClosed = isNonEmpty(r.signer_name);
        if (isClosed) {
            closed += 1;
            const bookMs = parseYmd(r.booking_date);
            const signMs = parseYmd(r.signed_time);
            if (bookMs != null && signMs != null) {
                const d = diffDaysUtc(bookMs, signMs);
                if (d >= 0 && d <= 3) closedWithin3 += 1;
                if (d >= 0 && d <= 7) closedWithin7 += 1;
            }
        }
        if (
            isNonEmpty(r.issue_status) ||
            isNonEmpty(r.return_type) ||
            isNonEmpty(r.exception_reason)
        ) {
            withIssue += 1;
        }
    }
    return {
        total: rows.length,
        closed,
        closedWithin3Days: closedWithin3,
        closedWithin7Days: closedWithin7,
        withIssue,
    };
}

type WeightSummary = {
    samples: { billed: number; order: number; gateway: number };
    sum: { billed: number; order: number; gateway: number };
    avg: { billed: number; order: number; gateway: number };
    /** จำนวนพัสดุที่น้ำหนักถูกปรับ — billed ≠ order หรือ billed ≠ gateway (เกินค่า EPS) */
    adjustedCount: number;
};

const WEIGHT_EPS = 0.01;

function computeWeightSummary(rows: ShipmentRow[]): WeightSummary {
    let billedSum = 0;
    let orderSum = 0;
    let gatewaySum = 0;
    let billedN = 0;
    let orderN = 0;
    let gatewayN = 0;
    let adjusted = 0;
    for (const r of rows) {
        const b = parseJtMoneyText(r.billed_weight);
        const o = parseJtMoneyText(r.order_weight);
        const g = parseJtMoneyText(r.gateway_weight);
        if (b > 0) {
            billedSum += b;
            billedN += 1;
        }
        if (o > 0) {
            orderSum += o;
            orderN += 1;
        }
        if (g > 0) {
            gatewaySum += g;
            gatewayN += 1;
        }
        if (b > 0 && o > 0 && Math.abs(b - o) > WEIGHT_EPS) {
            adjusted += 1;
        } else if (b > 0 && g > 0 && Math.abs(b - g) > WEIGHT_EPS) {
            adjusted += 1;
        }
    }
    return {
        samples: { billed: billedN, order: orderN, gateway: gatewayN },
        sum: {
            billed: Math.round(billedSum * 100) / 100,
            order: Math.round(orderSum * 100) / 100,
            gateway: Math.round(gatewaySum * 100) / 100,
        },
        avg: {
            billed: billedN ? Math.round((billedSum / billedN) * 100) / 100 : 0,
            order: orderN ? Math.round((orderSum / orderN) * 100) / 100 : 0,
            gateway: gatewayN ? Math.round((gatewaySum / gatewayN) * 100) / 100 : 0,
        },
        adjustedCount: adjusted,
    };
}

type CodSummary = {
    totalAmount: number;
    paidCount: number;
    paidAmount: number;
    pendingCount: number;
    pendingAmount: number;
    noCollectionCount: number;
};

function isPaidStatus(s: string | null | undefined): boolean {
    if (!s) return false;
    const v = String(s).trim().toLowerCase();
    if (!v) return false;
    return v.includes('paid') || v.includes('จ่ายแล้ว') || v.includes('สำเร็จ') || v.includes('success');
}

function isNoCollection(s: string | null | undefined): boolean {
    if (!s) return false;
    const v = String(s).trim().toLowerCase();
    return v.includes('no collection') || v.includes('ไม่เก็บ') || v.includes('ไม่มี');
}

function computeCodSummary(rows: ShipmentRow[]): CodSummary {
    let totalAmount = 0;
    let paidN = 0;
    let paidAmt = 0;
    let pendingN = 0;
    let pendingAmt = 0;
    let noCollect = 0;
    for (const r of rows) {
        const amt = parseJtMoneyText(r.cod_amount);
        if (amt <= 0) continue;
        totalAmount += amt;
        if (isNoCollection(r.cod_status)) {
            noCollect += 1;
            continue;
        }
        if (isPaidStatus(r.cod_status) || isNonEmpty(r.cod_payment_time)) {
            paidN += 1;
            paidAmt += amt;
        } else {
            pendingN += 1;
            pendingAmt += amt;
        }
    }
    return {
        totalAmount: Math.round(totalAmount * 100) / 100,
        paidCount: paidN,
        paidAmount: Math.round(paidAmt * 100) / 100,
        pendingCount: pendingN,
        pendingAmount: Math.round(pendingAmt * 100) / 100,
        noCollectionCount: noCollect,
    };
}

/** หา date range ครอบคลุม shipments ของลูกค้านี้ — ใช้ feed RPC */
function computeBookingDateRange(rows: ShipmentRow[]): { from: string; to: string } | null {
    let minMs: number | null = null;
    let maxMs: number | null = null;
    for (const r of rows) {
        const ms = parseYmd(r.booking_date);
        if (ms == null) continue;
        if (minMs == null || ms < minMs) minMs = ms;
        if (maxMs == null || ms > maxMs) maxMs = ms;
    }
    if (minMs == null || maxMs == null) return null;
    const toYmd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
    return { from: toYmd(minMs), to: toYmd(maxMs) };
}

async function fetchFinancialBreakdown(senderName: string, from: string, to: string) {
    const { data, error } = await supabaseAdmin.rpc(
        'get_financial_customer_breakdown_billable_weight',
        { start_date: from, end_date: to, row_limit: 50 }
    );
    if (error) {
        console.warn('[customer-profile detail] RPC failed:', error.message);
        return null;
    }
    const list = (data ?? []) as Array<{
        customer_name: string;
        shipment_count: number;
        total_revenue: number;
        total_cost: number;
        total_profit: number;
        avg_profit_per_shipment: number;
    }>;
    const needle = senderName.trim().toLowerCase();
    const found = list.find((r) => (r.customer_name ?? '').trim().toLowerCase() === needle);
    return found ?? null;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const rateLimited = applyRateLimit(req, 'customer-profile:detail', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { id } = await context.params;
        if (!id || !UUID_RE.test(id)) {
            return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 });
        }

        const { data: customer, error: custErr } = await supabaseAdmin
            .from('customers')
            .select('id, name, phone, vip_code, address, created_at')
            .eq('id', id)
            .maybeSingle();

        if (custErr) {
            console.error('[customer-profile detail] customer fetch:', custErr);
            return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลลูกค้า' }, { status: 500 });
        }
        if (!customer) {
            return NextResponse.json({ error: 'ไม่พบลูกค้า' }, { status: 404 });
        }

        const senderName = (customer.name ?? '').trim();
        const shipments = senderName ? await fetchCustomerShipments(senderName) : [];

        const kpi = computeKpi(shipments);
        const weight = computeWeightSummary(shipments);
        const cod = computeCodSummary(shipments);

        const range = computeBookingDateRange(shipments);
        const financial = range && senderName
            ? await fetchFinancialBreakdown(senderName, range.from, range.to)
            : null;

        const list = shipments.slice(0, SHIPMENT_LIST_LIMIT).map((r) => ({
            awb_number: r.awb_number,
            booking_date: r.booking_date,
            issue_status: r.issue_status,
            latest_scan_type: r.latest_scan_type,
            latest_scan_time: r.latest_scan_time,
            signer_name: r.signer_name,
            billed_weight: r.billed_weight,
            order_weight: r.order_weight,
            gateway_weight: r.gateway_weight,
            cod_amount: r.cod_amount,
            cod_status: r.cod_status,
            cod_payment_time: r.cod_payment_time,
        }));

        return NextResponse.json({
            customer,
            kpi,
            weight,
            cod,
            financial,
            date_range: range,
            shipments: list,
            shipments_total: shipments.length,
            shipments_truncated: shipments.length > SHIPMENT_LIST_LIMIT,
        });
    } catch (e) {
        console.error('[api/admin/customer-profile/[id]][GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
