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

        const { data, error } = await supabaseAdmin.rpc('get_financial_summary', {
            start_date: dateFrom,
            end_date: dateTo,
        });

        if (error) {
            console.error('[jt-shipments/financial-summary] get_financial_summary', error);
            return NextResponse.json(
                {
                    error: error.message,
                    hint: 'ตรวจสอบว่ารัน migration get_financial_summary และมีตาราง shipping_cost_master แล้ว',
                },
                { status: 500 },
            );
        }

        const row = (Array.isArray(data) ? data[0] : data) as FinancialSummaryRpcRow | null;

        return NextResponse.json({
            date_from: dateFrom,
            date_to: dateTo,
            totalRevenue: toNumber(row?.total_revenue),
            totalCost: toNumber(row?.total_cost),
            totalProfit: toNumber(row?.total_profit),
            shipmentCount: Math.trunc(toNumber(row?.shipment_count)),
        });
    } catch (e) {
        console.error('[jt-shipments/financial-summary]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
