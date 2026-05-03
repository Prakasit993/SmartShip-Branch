import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseJtMoneyText } from '@/lib/jtMoneyText';
import { applyBookingDateRangeFilters } from '@/lib/jtShipmentsBookingDateFilter';

const AGG_PAGE = 1000;

/**
 * สรุปแดชบอร์ด J&T จาก `jt_shipments` (อ้างอิง schema — เงินและวันที่เป็นข้อความ)
 * Query: date_from, date_to (YYYY-MM-DD) กรอง booking_date; ว่าง = ทั้งตาราง
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const dateFrom = searchParams.get('date_from') || '';
        const dateTo = searchParams.get('date_to') || '';

        let countQ = supabaseAdmin.from('jt_shipments').select('awb_number', { count: 'exact', head: true });
        countQ = applyBookingDateRangeFilters(countQ, dateFrom, dateTo);
        const { count, error: cErr } = await countQ;
        if (cErr) {
            console.error('[jt-shipments/dashboard] count', cErr);
            return NextResponse.json({ error: cErr.message }, { status: 500 });
        }

        let sumCod = 0;
        let sumFeePositive = 0;
        let countFeePositive = 0;
        let returnCount = 0;
        let offset = 0;
        for (;;) {
            let q = supabaseAdmin
                .from('jt_shipments')
                .select('shipping_fee, cod_amount, latest_scan_type');
            q = applyBookingDateRangeFilters(q, dateFrom, dateTo);
            const { data, error } = await q.range(offset, offset + AGG_PAGE - 1);
            if (error) {
                console.error('[jt-shipments/dashboard] agg', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            const rows = data ?? [];
            for (const row of rows) {
                sumCod += parseJtMoneyText((row as { cod_amount?: unknown }).cod_amount);
                const fee = parseJtMoneyText((row as { shipping_fee?: unknown }).shipping_fee);
                if (fee > 0) {
                    sumFeePositive += fee;
                    countFeePositive += 1;
                }
                const scan = String((row as { latest_scan_type?: unknown }).latest_scan_type ?? '');
                if (scan.includes('ตีกลับ') || /return/i.test(scan)) {
                    returnCount += 1;
                }
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

        return NextResponse.json({
            count: count ?? 0,
            sumCod,
            avgShippingFee,
            returnCount,
            recent: recent ?? [],
            date_from: dateFrom.trim() || null,
            date_to: dateTo.trim() || null,
        });
    } catch (e) {
        console.error('[jt-shipments/dashboard]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
