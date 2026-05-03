import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
    createMetricAccumulators,
    feedCustomMetricRow,
    finalizeCustomMetrics,
    unionColumnsForCustomMetrics,
} from '@/lib/jtCustomMetricAccumulators';
import { JT_CUSTOM_METRIC_SETTINGS_KEY, parseJtCustomMetricCardsFromSettingsValue } from '@/lib/jtCustomMetricCards';
import { parseJtMoneyText } from '@/lib/jtMoneyText';
import { applyBookingDateRangeFilters } from '@/lib/jtShipmentsBookingDateFilter';

const AGG_PAGE = 1000;

function formatMetricDisplay(raw: number, format: 'count' | 'thb'): string {
    if (format === 'count') return Math.round(raw).toLocaleString('th-TH');
    return raw.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * สรุปแดชบอร์ด J&T จาก `jt_shipments` (อ้างอิง schema — เงินและวันที่เป็นข้อความ)
 * Query: date_from, date_to (YYYY-MM-DD) กรอง booking_date; ว่าง = ทั้งตาราง
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const dateFrom = searchParams.get('date_from') || '';
        const dateTo = searchParams.get('date_to') || '';

        const { data: settingsRow } = await supabaseAdmin
            .from('settings')
            .select('value')
            .eq('key', JT_CUSTOM_METRIC_SETTINGS_KEY)
            .maybeSingle();

        const customDefs = parseJtCustomMetricCardsFromSettingsValue(settingsRow?.value);

        let countQ = supabaseAdmin.from('jt_shipments').select('awb_number', { count: 'exact', head: true });
        countQ = applyBookingDateRangeFilters(countQ, dateFrom, dateTo);
        const { count, error: cErr } = await countQ;
        if (cErr) {
            console.error('[jt-shipments/dashboard] count', cErr);
            return NextResponse.json({ error: cErr.message }, { status: 500 });
        }

        const baseAggCols = ['shipping_fee', 'cod_amount', 'latest_scan_type'];
        const extraCols = unionColumnsForCustomMetrics(customDefs);
        const selectCols = [...new Set(['awb_number', ...baseAggCols, ...extraCols])].join(',');

        let sumCod = 0;
        let sumFeePositive = 0;
        let countFeePositive = 0;
        let returnCount = 0;
        let offset = 0;

        const metricAcc = createMetricAccumulators(customDefs);

        for (;;) {
            let q = supabaseAdmin.from('jt_shipments').select(selectCols);
            q = applyBookingDateRangeFilters(q, dateFrom, dateTo);
            const { data, error } = await q.range(offset, offset + AGG_PAGE - 1);
            if (error) {
                console.error('[jt-shipments/dashboard] agg', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            const rows = data ?? [];
            for (const row of rows) {
                const r = row as unknown as Record<string, unknown>;
                sumCod += parseJtMoneyText(r.cod_amount);
                const fee = parseJtMoneyText(r.shipping_fee);
                if (fee > 0) {
                    sumFeePositive += fee;
                    countFeePositive += 1;
                }
                const scan = String(r.latest_scan_type ?? '');
                if (scan.includes('ตีกลับ') || /return/i.test(scan)) {
                    returnCount += 1;
                }
                feedCustomMetricRow(metricAcc, r, customDefs);
            }
            if (rows.length < AGG_PAGE) break;
            offset += AGG_PAGE;
        }

        const avgShippingFee =
            countFeePositive > 0 ? Math.round((sumFeePositive / countFeePositive) * 100) / 100 : 0;

        let recentQ = supabaseAdmin
            .from('jt_shipments')
            .select('awb_number, booking_date, receiver_name, receiver_phone, shipping_fee, cod_amount, latest_scan_type');
        recentQ = applyBookingDateRangeFilters(recentQ, dateFrom, dateTo);
        const { data: recent, error: rErr } = await recentQ
            .order('booking_date', { ascending: false, nullsFirst: false })
            .limit(5);
        if (rErr) {
            console.error('[jt-shipments/dashboard] recent', rErr);
            return NextResponse.json({ error: rErr.message }, { status: 500 });
        }

        const finalized = finalizeCustomMetrics(metricAcc, customDefs);
        const custom_metrics = finalized.map((m) => ({
            ...m,
            display: formatMetricDisplay(m.raw, m.format),
        }));

        return NextResponse.json({
            count: count ?? 0,
            sumCod,
            avgShippingFee,
            returnCount,
            recent: recent ?? [],
            date_from: dateFrom.trim() || null,
            date_to: dateTo.trim() || null,
            custom_metric_definitions: customDefs,
            custom_metrics,
        });
    } catch (e) {
        console.error('[jt-shipments/dashboard]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
