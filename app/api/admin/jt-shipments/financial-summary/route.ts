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

type FinancialComponentSummaryRpcRow = {
    shipping_fee_revenue: number | string | null;
    total_shipping_fee_revenue: number | string | null;
    extra_fee_revenue: number | string | null;
    base_shipping_cost: number | string | null;
    remote_area_fee_cost: number | string | null;
    other_fee_cost: number | string | null;
    insurance_fee_cost: number | string | null;
    return_fee_cost: number | string | null;
    cod_fee_cost: number | string | null;
    total_cost: number | string | null;
    total_profit: number | string | null;
    shipment_count: number | string | null;
};

type FinancialCustomerBreakdownRpcRow = {
    customer_name: string | null;
    shipment_count: number | string | null;
    total_revenue: number | string | null;
    total_cost: number | string | null;
    total_profit: number | string | null;
    avg_profit_per_shipment: number | string | null;
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
        const denied = await requireAdminApiAuth('admin-or-staff', req);
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

        const [summaryRes, dailyRes, missingCostRes, componentSummaryRes, customerBreakdownRes] = await Promise.all([
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
            supabaseAdmin.rpc('get_financial_component_summary_billable_weight', {
                start_date: dateFrom,
                end_date: dateTo,
            }),
            supabaseAdmin.rpc('get_financial_customer_breakdown_billable_weight', {
                start_date: dateFrom,
                end_date: dateTo,
                row_limit: 10,
            }),
        ]);

        const firstError = summaryRes.error || dailyRes.error || missingCostRes.error || componentSummaryRes.error;
        if (firstError) {
            console.error('[jt-shipments/financial-summary] RPC error', firstError);
            return NextResponse.json(
                {
                    error: firstError.message,
                    hint: 'ตรวจสอบว่ารัน migrations financial billable weight cost และมีตาราง shipping_cost_master / jt_shipping_cost_rates แล้ว',
                },
                { status: 500 },
            );
        }

        const row = (Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data) as FinancialSummaryRpcRow | null;
        const componentRow = (
            Array.isArray(componentSummaryRes.data)
                ? componentSummaryRes.data[0]
                : componentSummaryRes.data
        ) as FinancialComponentSummaryRpcRow | null;
        const dailyRows = (Array.isArray(dailyRes.data) ? dailyRes.data : []) as FinancialDailyProfitRpcRow[];
        const missingCostRows = (Array.isArray(missingCostRes.data) ? missingCostRes.data : []) as FinancialMissingCostRpcRow[];
        if (customerBreakdownRes.error) {
            console.warn('[jt-shipments/financial-summary] customer breakdown unavailable', customerBreakdownRes.error.message);
        }
        const customerRows = (
            !customerBreakdownRes.error && Array.isArray(customerBreakdownRes.data)
                ? customerBreakdownRes.data
                : []
        ) as FinancialCustomerBreakdownRpcRow[];

        return NextResponse.json({
            date_from: dateFrom,
            date_to: dateTo,
            totalRevenue: toNumber(row?.total_revenue),
            totalCost: toNumber(row?.total_cost),
            totalProfit: toNumber(row?.total_profit),
            shipmentCount: Math.trunc(toNumber(row?.shipment_count)),
            costModel: 'total_shipping_fee_revenue_with_billable_weight_cost',
            revenueBreakdown: {
                shippingFeeRevenue: toNumber(componentRow?.shipping_fee_revenue),
                totalShippingFeeRevenue: toNumber(componentRow?.total_shipping_fee_revenue),
                extraFeeRevenue: toNumber(componentRow?.extra_fee_revenue),
            },
            costBreakdown: {
                baseShippingCost: toNumber(componentRow?.base_shipping_cost),
                remoteAreaFeeCost: toNumber(componentRow?.remote_area_fee_cost),
                otherFeeCost: toNumber(componentRow?.other_fee_cost),
                insuranceFeeCost: toNumber(componentRow?.insurance_fee_cost),
                returnFeeCost: toNumber(componentRow?.return_fee_cost),
                codFeeCost: toNumber(componentRow?.cod_fee_cost),
            },
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
            topCustomers: customerRows.map((r) => ({
                customerName: String(r.customer_name || 'ไม่ระบุลูกค้า'),
                shipmentCount: Math.trunc(toNumber(r.shipment_count)),
                totalRevenue: toNumber(r.total_revenue),
                totalCost: toNumber(r.total_cost),
                totalProfit: toNumber(r.total_profit),
                avgProfitPerShipment: toNumber(r.avg_profit_per_shipment),
            })),
            customerBreakdownUnavailable: Boolean(customerBreakdownRes.error),
        });
    } catch (e) {
        console.error('[jt-shipments/financial-summary]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
