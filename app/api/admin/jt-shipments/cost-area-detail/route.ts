import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const VALID_FILTER = new Set(['all', 'anomaly', 'not_closed', 'closed']);

type RpcRow = {
    awb_number: string | null;
    booking_date: string | null;
    latest_scan_time: string | null;
    dest_subdistrict: string | null;
    dest_district: string | null;
    dest_province: string | null;
    receiver_address: string | null;
    billable_weight_kg: number | string | null;
    admin_billable: number | string | null;
    gateway_billable: number | string | null;
    anomaly_ratio: number | string | null;
    anomaly_diff_kg: number | string | null;
    is_anomaly: boolean | null;
    our_cost: number | string | null;
    signer_name: string | null;
    is_closed: boolean | null;
    days_pending: number | string | null;
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
        const filterMode = (searchParams.get('filter') ?? 'all').trim() || 'all';
        const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);
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
        if (!VALID_FILTER.has(filterMode)) {
            return NextResponse.json(
                { error: `filter ต้องเป็นหนึ่งใน: ${[...VALID_FILTER].join(', ')}` },
                { status: 400 },
            );
        }
        const rowLimit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 500);
        const rowOffset = Math.max(isNaN(offsetParam) ? 0 : offsetParam, 0);

        const res = await supabaseAdmin.rpc('jt_shipment_cost_area_detail', {
            start_date: dateFrom,
            end_date: dateTo,
            filter_mode: filterMode,
            row_limit: rowLimit,
            row_offset: rowOffset,
        });

        if (res.error) {
            console.error('[jt-shipments/cost-area-detail] RPC error', res.error);
            return NextResponse.json(
                {
                    error: res.error.message,
                    hint: 'ตรวจสอบว่ารัน migration 20260521_jt_shipment_cost_area_detail.sql แล้ว',
                },
                { status: 500 },
            );
        }

        const rows = (Array.isArray(res.data) ? res.data : []) as RpcRow[];

        return NextResponse.json({
            date_from: dateFrom,
            date_to: dateTo,
            filter: filterMode,
            data: rows.map((r) => ({
                awbNumber: String(r.awb_number ?? ''),
                bookingDate: String(r.booking_date ?? '').slice(0, 10),
                latestScanTime: r.latest_scan_time ?? null,
                destSubdistrict: r.dest_subdistrict ?? null,
                destDistrict: r.dest_district ?? null,
                destProvince: r.dest_province ?? null,
                receiverAddress: r.receiver_address ?? null,
                billableWeightKg: r.billable_weight_kg != null ? toNum(r.billable_weight_kg) : null,
                adminBillable: toNum(r.admin_billable),
                gatewayBillable: toNum(r.gateway_billable),
                anomalyRatio: r.anomaly_ratio != null ? toNum(r.anomaly_ratio) : null,
                anomalyDiffKg: toNum(r.anomaly_diff_kg),
                isAnomaly: Boolean(r.is_anomaly),
                ourCost: toNum(r.our_cost),
                signerName: r.signer_name ?? null,
                isClosed: Boolean(r.is_closed),
                daysPending: r.days_pending != null ? Math.trunc(toNum(r.days_pending)) : null,
            })),
            pagination: {
                limit: rowLimit,
                offset: rowOffset,
                hasMore: rows.length === rowLimit,
            },
        });
    } catch (e) {
        console.error('[jt-shipments/cost-area-detail]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
