import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

type FinancialSummaryRpcRow = {
    total_revenue: number | string | null;
    total_cost: number | string | null;
    total_profit: number | string | null;
    shipment_count: number | string | null;
};

type FinancialDailyProfitRpcRow = FinancialSummaryRpcRow & {
    day: string | null;
};

type FinancialMissingCostRpcRow = {
    sale_price: number | string | null;
    shipment_count: number | string | null;
    total_revenue: number | string | null;
    default_cost_total: number | string | null;
    estimated_profit_with_default_cost: number | string | null;
};

function readDateRange(req: Request) {
    const { searchParams } = new URL(req.url);
    const dateFrom = (searchParams.get('date_from') || searchParams.get('start_date') || '').trim();
    const dateTo = (searchParams.get('date_to') || searchParams.get('end_date') || '').trim();
    return { dateFrom, dateTo };
}

function toNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff');
        if (denied) return denied;

        const { dateFrom, dateTo } = readDateRange(req);
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

        const [summaryRes, dailyRes, missingCostRes] = await Promise.all([
            supabaseAdmin.rpc('get_financial_summary', {
                start_date: dateFrom,
                end_date: dateTo,
            }),
            supabaseAdmin.rpc('get_financial_daily_profit', {
                start_date: dateFrom,
                end_date: dateTo,
            }),
            supabaseAdmin.rpc('get_financial_missing_cost_prices', {
                start_date: dateFrom,
                end_date: dateTo,
            }),
        ]);

        const firstError = summaryRes.error || dailyRes.error || missingCostRes.error;
        if (firstError) {
            console.error('[jt-shipments/financial-summary] RPC error', firstError);
            return NextResponse.json(
                {
                    error: firstError.message,
                    hint: 'ตรวจสอบว่ารัน migrations financial summary/deep dive และมีตาราง shipping_cost_master แล้ว',
                },
                { status: 500 },
            );
        }

        const row = (Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data) as FinancialSummaryRpcRow | null;
        const dailyRows = (Array.isArray(dailyRes.data) ? dailyRes.data : []) as FinancialDailyProfitRpcRow[];
        const missingCostRows = (Array.isArray(missingCostRes.data) ? missingCostRes.data : []) as FinancialMissingCostRpcRow[];

        return NextResponse.json({
            date_from: dateFrom,
            date_to: dateTo,
            totalRevenue: toNumber(row?.total_revenue),
            totalCost: toNumber(row?.total_cost),
            totalProfit: toNumber(row?.total_profit),
            shipmentCount: Math.trunc(toNumber(row?.shipment_count)),
            dailyProfit: dailyRows.map((r) => ({
                date: String(r.day || '').slice(0, 10),
                totalRevenue: toNumber(r.total_revenue),
                totalCost: toNumber(r.total_cost),
                totalProfit: toNumber(r.total_profit),
                shipmentCount: Math.trunc(toNumber(r.shipment_count)),
            })),
            missingCostPrices: missingCostRows.map((r) => ({
                salePrice: toNumber(r.sale_price),
                shipmentCount: Math.trunc(toNumber(r.shipment_count)),
                totalRevenue: toNumber(r.total_revenue),
                defaultCostTotal: toNumber(r.default_cost_total),
                estimatedProfitWithDefaultCost: toNumber(r.estimated_profit_with_default_cost),
            })),
        });
    } catch (e) {
        console.error('[jt-shipments/financial-summary]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
