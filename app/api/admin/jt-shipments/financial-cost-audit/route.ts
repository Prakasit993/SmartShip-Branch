import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

type FinancialCostAuditRpcRow = {
    awb_number: string | null;
    booking_date: string | null;
    dest_province: string | null;
    zone_code: string | null;
    shipping_fee: number | string | null;
    actual_weight_kg: number | string | null;
    volumetric_weight_kg: number | string | null;
    billable_weight_kg: number | string | null;
    matched_rate_weight_kg: number | string | null;
    cost: number | string | null;
    profit: number | string | null;
    cost_source: string | null;
};

function readParams(req: Request) {
    const { searchParams } = new URL(req.url);
    const dateFrom = (searchParams.get('date_from') || searchParams.get('start_date') || '').trim();
    const dateTo = (searchParams.get('date_to') || searchParams.get('end_date') || '').trim();
    const requestedLimit = Number(searchParams.get('limit') || 100);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 500) : 100;
    return { dateFrom, dateTo, limit };
}

function toNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { dateFrom, dateTo, limit } = readParams(req);
        if (!YMD.test(dateFrom) || !YMD.test(dateTo)) {
            return NextResponse.json(
                { error: 'date_from และ date_to ต้องอยู่ในรูปแบบ YYYY-MM-DD' },
                { status: 400 },
            );
        }
        if (dateFrom > dateTo) {
            return NextResponse.json(
                { error: 'date_from ต้องไม่มากกว่า date_to' },
                { status: 400 },
            );
        }

        const { data, error } = await supabaseAdmin.rpc('get_financial_cost_audit_billable_weight', {
            start_date: dateFrom,
            end_date: dateTo,
            row_limit: limit,
        });

        if (error) {
            console.error('[jt-shipments/financial-cost-audit] RPC error', error);
            return NextResponse.json(
                {
                    error: error.message,
                    hint: 'ตรวจสอบว่ารัน migration financial billable weight cost แล้ว',
                },
                { status: 500 },
            );
        }

        const rows = (Array.isArray(data) ? data : []) as FinancialCostAuditRpcRow[];

        return NextResponse.json({
            date_from: dateFrom,
            date_to: dateTo,
            limit,
            costModel: 'billable_weight_with_sale_price_fallback',
            data: rows.map((r) => ({
                awbNumber: r.awb_number || '',
                bookingDate: String(r.booking_date || '').slice(0, 10),
                destinationProvince: r.dest_province || '',
                zoneCode: r.zone_code || '',
                shippingFee: toNumber(r.shipping_fee),
                actualWeightKg: toNumber(r.actual_weight_kg),
                volumetricWeightKg: toNumber(r.volumetric_weight_kg),
                billableWeightKg: toNumber(r.billable_weight_kg),
                matchedRateWeightKg: toNumber(r.matched_rate_weight_kg),
                cost: toNumber(r.cost),
                profit: toNumber(r.profit),
                costSource: r.cost_source || 'default_15',
            })),
        });
    } catch (e) {
        console.error('[jt-shipments/financial-cost-audit]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
