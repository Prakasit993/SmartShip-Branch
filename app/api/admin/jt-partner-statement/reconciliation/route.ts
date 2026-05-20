import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

const VALID_STATUS = new Set(['matched', 'overcharged', 'undercharged', 'statement_only', 'shipment_only']);

type ReconciliationSummaryRpcRow = {
    total_awb_count: number | string | null;
    matched_count: number | string | null;
    overcharged_count: number | string | null;
    undercharged_count: number | string | null;
    statement_only_count: number | string | null;
    shipment_only_count: number | string | null;
    total_our_cost: number | string | null;
    total_partner_cost: number | string | null;
    total_gap: number | string | null;
    overcharged_our_cost: number | string | null;
    overcharged_partner_cost: number | string | null;
    overcharged_gap_total: number | string | null;
    undercharged_our_cost: number | string | null;
    undercharged_partner_cost: number | string | null;
    undercharged_gap_total: number | string | null;
    date_from: string | null;
    date_to: string | null;
};

type ReconciliationDetailRpcRow = {
    awb_number: string | null;
    booking_date: string | null;
    transaction_date: string | null;
    dest_province: string | null;
    zone_code: string | null;
    our_billable_weight_kg: number | string | null;
    our_cost: number | string | null;
    partner_cost: number | string | null;
    gap: number | string | null;
    status: string | null;
    charge_types: string | null;
};

function toNum(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const dateFrom = (searchParams.get('date_from') ?? '').trim();
        const dateTo = (searchParams.get('date_to') ?? '').trim();
        const statusFilter = (searchParams.get('status') ?? '').trim() || null;
        const limitParam = parseInt(searchParams.get('limit') ?? '200', 10);
        const offsetParam = parseInt(searchParams.get('offset') ?? '0', 10);

        if (!YMD.test(dateFrom) || !YMD.test(dateTo)) {
            return NextResponse.json(
                { error: 'date_from และ date_to ต้องอยู่ในรูปแบบ YYYY-MM-DD' },
                { status: 400 },
            );
        }
        if (dateFrom > dateTo) {
            return NextResponse.json({ error: 'date_from ต้องไม่มากกว่า date_to' }, { status: 400 });
        }
        if (statusFilter && !VALID_STATUS.has(statusFilter)) {
            return NextResponse.json(
                { error: `status ต้องเป็นหนึ่งใน: ${[...VALID_STATUS].join(', ')}` },
                { status: 400 },
            );
        }
        const rowLimit = Math.min(Math.max(isNaN(limitParam) ? 200 : limitParam, 1), 500);
        const rowOffset = Math.max(isNaN(offsetParam) ? 0 : offsetParam, 0);

        const [summaryRes, detailRes] = await Promise.all([
            supabaseAdmin.rpc('get_jt_reconciliation_summary', {
                start_date: dateFrom,
                end_date: dateTo,
            }),
            supabaseAdmin.rpc('get_jt_reconciliation_detail', {
                start_date: dateFrom,
                end_date: dateTo,
                status_filter: statusFilter,
                row_limit: rowLimit,
                row_offset: rowOffset,
            }),
        ]);

        if (summaryRes.error) {
            console.error('[jt-partner-statement/reconciliation] summary RPC error', summaryRes.error);
            return NextResponse.json(
                {
                    error: summaryRes.error.message,
                    hint: 'ตรวจสอบว่ารัน migration 20260520_jt_reconciliation_rpc.sql แล้ว',
                },
                { status: 500 },
            );
        }
        if (detailRes.error) {
            console.error('[jt-partner-statement/reconciliation] detail RPC error', detailRes.error);
            return NextResponse.json(
                { error: detailRes.error.message },
                { status: 500 },
            );
        }

        const sumRow = (Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data) as
            | ReconciliationSummaryRpcRow
            | null;
        const detailRows = (Array.isArray(detailRes.data) ? detailRes.data : []) as ReconciliationDetailRpcRow[];

        return NextResponse.json({
            date_from: dateFrom,
            date_to: dateTo,
            status_filter: statusFilter,
            summary: {
                totalAwbCount: Math.trunc(toNum(sumRow?.total_awb_count)),
                matchedCount: Math.trunc(toNum(sumRow?.matched_count)),
                overchargedCount: Math.trunc(toNum(sumRow?.overcharged_count)),
                underchargedCount: Math.trunc(toNum(sumRow?.undercharged_count)),
                statementOnlyCount: Math.trunc(toNum(sumRow?.statement_only_count)),
                shipmentOnlyCount: Math.trunc(toNum(sumRow?.shipment_only_count)),
                totalOurCost: toNum(sumRow?.total_our_cost),
                totalPartnerCost: toNum(sumRow?.total_partner_cost),
                totalGap: toNum(sumRow?.total_gap),
                overchargedOurCost: toNum(sumRow?.overcharged_our_cost),
                overchargedPartnerCost: toNum(sumRow?.overcharged_partner_cost),
                overchargedGapTotal: toNum(sumRow?.overcharged_gap_total),
                underchargedOurCost: toNum(sumRow?.undercharged_our_cost),
                underchargedPartnerCost: toNum(sumRow?.undercharged_partner_cost),
                underchargedGapTotal: toNum(sumRow?.undercharged_gap_total),
            },
            detail: detailRows.map((r) => ({
                awbNumber: String(r.awb_number ?? ''),
                bookingDate: String(r.booking_date ?? '').slice(0, 10),
                transactionDate: r.transaction_date ? String(r.transaction_date).slice(0, 10) : null,
                destProvince: String(r.dest_province ?? ''),
                zoneCode: r.zone_code ?? null,
                ourBillableWeightKg: r.our_billable_weight_kg != null ? toNum(r.our_billable_weight_kg) : null,
                ourCost: toNum(r.our_cost),
                partnerCost: toNum(r.partner_cost),
                gap: toNum(r.gap),
                status: String(r.status ?? ''),
                chargeTypes: String(r.charge_types ?? ''),
            })),
            pagination: {
                limit: rowLimit,
                offset: rowOffset,
                hasMore: detailRows.length === rowLimit,
            },
        });
    } catch (e) {
        console.error('[jt-partner-statement/reconciliation]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
