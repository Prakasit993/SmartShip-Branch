import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Lightweight endpoint for the Financial calendar date-picker.
 *
 * Unlike `/financial-summary` (which runs 5 parallel RPCs), this calls only
 * `get_financial_daily_profit` — returning daily profit data for a single month.
 * This dramatically reduces backend load when the user navigates months in the
 * calendar picker.
 */

const MONTH_RE = /^\d{4}-\d{2}$/;

function toNumber(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function monthToRange(month: string): { from: string; to: string } | null {
    if (!MONTH_RE.test(month)) return null;
    const [year, monthNo] = month.split('-').map(Number);
    if (!year || !monthNo || monthNo < 1 || monthNo > 12) return null;
    const from = `${year}-${String(monthNo).padStart(2, '0')}-01`;
    const to = new Date(year, monthNo, 0).toISOString().slice(0, 10);
    return { from, to };
}

type DailyProfitRpcRow = {
    day: string | null;
    total_revenue: number | string | null;
    total_cost: number | string | null;
    total_profit: number | string | null;
    shipment_count: number | string | null;
};

export async function GET(request: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', request);
        if (denied) return denied;

        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month') || '';
        const range = monthToRange(month);
        if (!range) {
            return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin.rpc('get_financial_daily_profit', {
            start_date: range.from,
            end_date: range.to,
        });

        if (error) {
            console.error('[jt-shipments/financial-calendar] RPC error', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = (Array.isArray(data) ? data : []) as DailyProfitRpcRow[];

        return NextResponse.json({
            month,
            days: rows.map((r) => ({
                date: String(r.day || '').slice(0, 10),
                totalProfit: toNumber(r.total_profit),
                shipmentCount: Math.trunc(toNumber(r.shipment_count)),
            })),
        });
    } catch (e) {
        console.error('[jt-shipments/financial-calendar]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
