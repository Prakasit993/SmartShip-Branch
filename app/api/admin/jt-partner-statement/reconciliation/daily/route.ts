import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const dateFrom = (searchParams.get('date_from') ?? '').trim();
        const dateTo = (searchParams.get('date_to') ?? '').trim();

        if (!dateFrom || !dateTo) {
            return NextResponse.json(
                { error: 'กรุณาระบุ date_from และ date_to' },
                { status: 400 },
            );
        }

        const res = await supabaseAdmin.rpc('jt_reconciliation_daily_summary', {
            p_date_from: dateFrom,
            p_date_to: dateTo,
        });

        if (res.error) {
            console.error('[jt-partner-statement/reconciliation/daily] RPC error', res.error);
            return NextResponse.json(
                {
                    error: res.error.message,
                    hint: 'ตรวจสอบว่ารัน migration 20260520_jt_reconciliation_daily_rpc.sql แล้ว',
                },
                { status: 500 },
            );
        }

        const rows = (Array.isArray(res.data) ? res.data : []) as any[];

        return NextResponse.json({
            date_from: dateFrom,
            date_to: dateTo,
            data: rows.map((r) => ({
                transactionDate: String(r.transaction_date ?? '').slice(0, 10),
                // ฝั่งระบบประเมิน
                systemBaseShipping: Number(r.system_base_shipping ?? 0),
                systemRemoteAreaFee: Number(r.system_remote_area_fee ?? 0),
                systemCodFee: Number(r.system_cod_fee ?? 0),
                systemOtherFee: Number(r.system_other_fee ?? 0),
                systemInsuranceFee: Number(r.system_insurance_fee ?? 0),
                systemReturnFee: Number(r.system_return_fee ?? 0),
                systemTotalCost: Number(r.system_total_cost ?? 0),
                // ฝั่ง J&T เรียกเก็บ
                statementShippingCost: Number(r.statement_shipping_cost ?? 0),
                statementAdjustmentCost: Number(r.statement_adjustment_cost ?? 0),
                statementRemoteAreaFee: Number(r.statement_remote_area_fee ?? 0),
                statementOtherFees: Number(r.statement_other_fees ?? 0),
                statementTotalCost: Number(r.statement_total_cost ?? 0),
                chargeBreakdown: r.charge_breakdown ?? {},
                diff: Number(r.diff ?? 0),
            })),
        });
    } catch (e) {
        console.error('[jt-partner-statement/reconciliation/daily]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
