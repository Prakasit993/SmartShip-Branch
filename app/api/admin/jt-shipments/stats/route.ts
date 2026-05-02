import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { channelBucketLabelFromRow } from '@/lib/jtChannel';
import { parseJtChannelPriorityFromSettingValue, uniqueFieldsForSelect } from '@/lib/jtChannelSettings';
import { classifyShippingFeeBucket } from '@/lib/jtFeeBuckets';
import { parseJtDashboardSectionsJson } from '@/lib/jtDashboardSections';
import { buildUtcDayWindow, utcDayKeyFromIso } from '@/lib/utcDayKey';

type RpcDailyStatsRow = { day: string; cnt: number | string; fee_sum: number | string };

function fillDailyStatsSeries(dayKeys: string[], rpcRows: RpcDailyStatsRow[] | null | undefined) {
    const cMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    const fMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    for (const r of rpcRows || []) {
        const key = String(r.day).slice(0, 10);
        if (key in cMap) {
            cMap[key] = Number(r.cnt) || 0;
            fMap[key] = Math.round((Number(r.fee_sum) || 0) * 100) / 100;
        }
    }
    return {
        daily30: dayKeys.map((date) => ({ date, count: cMap[date] ?? 0 })),
        dailyFee30: dayKeys.map((date) => ({ date, feeTotal: fMap[date] ?? 0 })),
    };
}

/** PostgREST row limit fallback — only used if DB RPC is missing. */
async function fetchBookingRowsInUtcWindow(rangeStartIso: string, rangeEndIso: string) {
    const out: { booking_date: string; shipping_fee: unknown }[] = [];
    const pageSize = 1000;
    let offset = 0;
    for (;;) {
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select('booking_date, shipping_fee')
            .gte('booking_date', rangeStartIso)
            .lte('booking_date', rangeEndIso)
            .order('booking_date', { ascending: true })
            .range(offset, offset + pageSize - 1);
        if (error) {
            console.error('[jt-stats] daily stats pagination fallback', error);
            break;
        }
        const rows = (data || []) as { booking_date: string; shipping_fee: unknown }[];
        out.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
    }
    return out;
}

function aggregateDailyStatsFallback(
    dayKeys: string[],
    rows: { booking_date: string; shipping_fee: unknown }[],
): { daily30: { date: string; count: number }[]; dailyFee30: { date: string; feeTotal: number }[] } {
    const daySet = new Set(dayKeys);
    const countMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    const feeMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    for (const row of rows) {
        const key = utcDayKeyFromIso(row.booking_date);
        if (!key || !daySet.has(key)) continue;
        countMap[key] = (countMap[key] || 0) + 1;
        feeMap[key] = (feeMap[key] || 0) + (Number(row.shipping_fee) || 0);
    }
    return {
        daily30: dayKeys.map((date) => ({ date, count: countMap[date] ?? 0 })),
        dailyFee30: dayKeys.map((date) => ({
            date,
            feeTotal: Math.round((feeMap[date] ?? 0) * 100) / 100,
        })),
    };
}

async function rpcDailyStatsUtc(pStartDate: string, pEndDate: string): Promise<RpcDailyStatsRow[] | null> {
    const { data, error } = await supabaseAdmin.rpc('jt_shipment_daily_stats_utc', {
        p_start: pStartDate,
        p_end: pEndDate,
    });
    if (error) {
        console.warn('[jt-stats] jt_shipment_daily_stats_utc RPC unavailable, using fallback:', error.message);
        return null;
    }
    return (data || []) as RpcDailyStatsRow[];
}

function clampChartWindowDays(raw: string | null): number {
    const n = parseInt(raw ?? '30', 10);
    if (!Number.isFinite(n)) return 30;
    return Math.min(365, Math.max(7, n));
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const windowDays = clampChartWindowDays(searchParams.get('window_days'));

        const [{ data: latestRow }, settingsRes] = await Promise.all([
            supabaseAdmin.from('jt_shipments').select('booking_date').order('booking_date', { ascending: false }).limit(1).maybeSingle(),
            supabaseAdmin.from('settings').select('key, value').in('key', ['jt_dashboard_sections', 'jt_channel_field_priority']),
        ]);

        const settingsRows = (settingsRes.data || []) as { key: string; value: unknown }[];
        const priority = parseJtChannelPriorityFromSettingValue(
            settingsRows.find((r) => r.key === 'jt_channel_field_priority')?.value,
        );
        const channelFields = uniqueFieldsForSelect(priority);
        const platformSelect = channelFields.length ? channelFields.join(',') : 'platform,order_source';
        const recentSelect = [...new Set(['awb_number', 'booking_date', 'sender_name', 'receiver_name', 'shipping_fee', ...channelFields])].join(',');
        const feeSelect = [...new Set(['shipping_fee', ...channelFields])].join(',');

        const anchorMs = latestRow?.booking_date ? Date.parse(String(latestRow.booking_date)) : Date.now();
        const anchorSafe = Number.isNaN(anchorMs) ? Date.now() : anchorMs;
        const now = new Date(anchorSafe);

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        const monthStart = new Date(now);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { keys: dayKeysWindow, startIso: rangeStartIso } = buildUtcDayWindow(anchorSafe, windowDays);
        const rangeEndIso = `${dayKeysWindow[dayKeysWindow.length - 1]}T23:59:59.999Z`;
        const startDateWindow = dayKeysWindow[0];
        const endDateWindow = dayKeysWindow[dayKeysWindow.length - 1];

        const [
            totalRes,
            todayRes,
            weekRes,
            monthRes,
            feeRes,
            recentRes,
            topSendersRes,
            topReceiversRes,
            platformRes,
            bookingNullRes,
            rpcStats30,
        ] = await Promise.all([
            supabaseAdmin.from('jt_shipments').select('*', { count: 'exact', head: true }),
            supabaseAdmin
                .from('jt_shipments')
                .select('*', { count: 'exact', head: true })
                .gte('booking_date', todayStart.toISOString()),
            supabaseAdmin
                .from('jt_shipments')
                .select('*', { count: 'exact', head: true })
                .gte('booking_date', weekStart.toISOString()),
            supabaseAdmin
                .from('jt_shipments')
                .select('*', { count: 'exact', head: true })
                .gte('booking_date', monthStart.toISOString()),
            supabaseAdmin.from('jt_shipments').select(feeSelect),
            supabaseAdmin
                .from('jt_shipments')
                .select(recentSelect)
                .order('booking_date', { ascending: false })
                .limit(10),
            supabaseAdmin.from('jt_shipments').select('sender_name').not('sender_name', 'is', null),
            supabaseAdmin.from('jt_shipments').select('receiver_name').not('receiver_name', 'is', null),
            supabaseAdmin.from('jt_shipments').select(platformSelect),
            supabaseAdmin.from('jt_shipments').select('*', { count: 'exact', head: true }).is('booking_date', null),
            rpcDailyStatsUtc(startDateWindow, endDateWindow),
        ]);

        const feeRows = (feeRes.data || []) as unknown as Record<string, unknown>[];
        const fees = feeRows.map((r) => Number(r.shipping_fee) || 0);
        const totalFee = fees.reduce((a, b) => a + b, 0);
        const avgFee = fees.length ? totalFee / fees.length : 0;
        const maxFee = fees.length ? Math.max(...fees) : 0;

        let sumFeeMarketplace = 0;
        let countFeeMarketplace = 0;
        let sumFeeJms = 0;
        let countFeeJms = 0;
        feeRows.forEach((row) => {
            const f = Number(row.shipping_fee) || 0;
            const label = channelBucketLabelFromRow(row, priority);
            const bucket = classifyShippingFeeBucket(label);
            if (bucket === 'marketplace') {
                sumFeeMarketplace += f;
                countFeeMarketplace += 1;
            } else if (bucket === 'jms') {
                sumFeeJms += f;
                countFeeJms += 1;
            }
        });
        const avgFeeMarketplace = countFeeMarketplace ? sumFeeMarketplace / countFeeMarketplace : 0;
        const avgFeeJms = countFeeJms ? sumFeeJms / countFeeJms : 0;

        let daily30: { date: string; count: number }[];
        let dailyFee30: { date: string; feeTotal: number }[];
        if (rpcStats30 !== null) {
            const filled = fillDailyStatsSeries(dayKeysWindow, rpcStats30);
            daily30 = filled.daily30;
            dailyFee30 = filled.dailyFee30;
        } else {
            const fallbackRows = await fetchBookingRowsInUtcWindow(rangeStartIso, rangeEndIso);
            const agg = aggregateDailyStatsFallback(dayKeysWindow, fallbackRows);
            daily30 = agg.daily30;
            dailyFee30 = agg.dailyFee30;
        }
        const sumDaily30 = daily30.reduce((a, d) => a + d.count, 0);
        const sumDailyFee30 = dailyFee30.reduce((a, d) => a + d.feeTotal, 0);
        const distinctDaysWithCount = daily30.filter((d) => d.count > 0).length;
        const bookingNull = bookingNullRes.count ?? 0;
        const rowsOutsideWindowApprox = Math.max(0, (totalRes.count || 0) - bookingNull - sumDaily30);

        const platformCounts: { name: string; count: number }[] = [];
        if (!platformRes.error && platformRes.data) {
            const pMap: Record<string, number> = {};
            const rows = platformRes.data as unknown as Record<string, unknown>[];
            rows.forEach((row) => {
                const name = channelBucketLabelFromRow(row, priority);
                pMap[name] = (pMap[name] || 0) + 1;
            });
            const entries = Object.entries(pMap).sort((a, b) => b[1] - a[1]);
            platformCounts.push(...entries.map(([name, count]) => ({ name, count })));
        }

        const sMap: Record<string, number> = {};
        (topSendersRes.data || []).forEach((r: Record<string, string>) => {
            if (r.sender_name) sMap[r.sender_name] = (sMap[r.sender_name] || 0) + 1;
        });
        const topSenders = Object.entries(sMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        const rMap: Record<string, number> = {};
        (topReceiversRes.data || []).forEach((r: Record<string, string>) => {
            if (r.receiver_name) rMap[r.receiver_name] = (rMap[r.receiver_name] || 0) + 1;
        });
        const topReceivers = Object.entries(rMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        const sectionsVal = settingsRows.find((r) => r.key === 'jt_dashboard_sections')?.value;

        return NextResponse.json({
            total: totalRes.count || 0,
            today: todayRes.count || 0,
            week: weekRes.count || 0,
            month: monthRes.count || 0,
            totalFee: Math.round(totalFee * 100) / 100,
            avgFee: Math.round(avgFee * 100) / 100,
            avgFeeMarketplace: Math.round(avgFeeMarketplace * 100) / 100,
            avgFeeJms: Math.round(avgFeeJms * 100) / 100,
            countAvgFeeMarketplace: countFeeMarketplace,
            countAvgFeeJms: countFeeJms,
            maxFee: Math.round(maxFee * 100) / 100,
            recent: recentRes.data || [],
            topSenders,
            topReceivers,
            daily30,
            dailyFee30,
            sumDaily30,
            sumDailyFee30,
            bookingDateNullCount: bookingNull,
            chartWindow: {
                windowDays,
                utcStart: startDateWindow,
                utcEnd: endDateWindow,
                /** จำนวนวันบนแกนที่มีอย่างน้อย 1 รายการ (จำนวนแท่งที่เห็นมีข้อมูล) */
                distinctDaysWithData: distinctDaysWithCount,
                rowsInWindow: sumDaily30,
                rowsOutsideWindowApprox,
                anchorHint:
                    'ช่วงวันที่บนกราฟ = วัน UTC ต่อเนื่องจำนวน windowDays วัน โดยให้วันสุดท้ายตรงกับวันที่จองล่าสุดในตาราง (ไม่ใช่วันนี้ของปฏิทิน)',
            },
            platformCounts,
            channelFieldPriority: priority,
            ui: {
                sections: parseJtDashboardSectionsJson(sectionsVal),
            },
        });
    } catch (e) {
        console.error('[jt-stats]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
