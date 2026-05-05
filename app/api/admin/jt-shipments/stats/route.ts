import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { channelBucketLabelFromRow } from '@/lib/jtChannel';
import {
    DEFAULT_JT_CHANNEL_PRIORITY,
    parseJtChannelPriorityFromSettingValue,
    uniqueFieldsForSelect,
} from '@/lib/jtChannelSettings';
import { classifyShippingFeeBucket } from '@/lib/jtFeeBuckets';
import { parseJtDashboardSectionsJson } from '@/lib/jtDashboardSections';
import { parseJtMoneyText } from '@/lib/jtMoneyText';
import {
    buildUtcDayKeysForMonth,
    buildUtcDayKeysInclusiveRange,
    buildUtcDayWindow,
    nextUtcCalendarDayYmd,
    utcDayKeyFromIso,
} from '@/lib/utcDayKey';

type ChartAxisMode = 'rolling' | 'month' | 'range';

type RpcDailyStatsRow = {
    day: string;
    cnt: number | string;
    fee_sum: number | string;
    cod_sum?: number | string;
};

function fillDailyStatsSeries(dayKeys: string[], rpcRows: RpcDailyStatsRow[] | null | undefined) {
    const cMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    const fMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    const codMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    for (const r of rpcRows || []) {
        const key = String(r.day).slice(0, 10);
        if (key in cMap) {
            cMap[key] = Number(r.cnt) || 0;
            fMap[key] = Math.round((Number(r.fee_sum) || 0) * 100) / 100;
            codMap[key] = Math.round((Number(r.cod_sum) || 0) * 100) / 100;
        }
    }
    return {
        daily30: dayKeys.map((date) => ({ date, count: cMap[date] ?? 0 })),
        dailyFee30: dayKeys.map((date) => ({ date, feeTotal: fMap[date] ?? 0 })),
        dailyCod30: dayKeys.map((date) => ({ date, codTotal: codMap[date] ?? 0 })),
    };
}

/**
 * Supabase PostgREST's default max-rows is 1000 (NOT 10000 as an older comment claimed).
 * Unbounded `.select()` silently truncates large tables to the first 1000 rows, and asking
 * for a range larger than max-rows is also capped — so pages MUST be ≤ 1000 or the loop
 * breaks after the first iteration with wrong results. These helpers page through all rows
 * in 1000-row chunks and accumulate the final aggregates in TS (no row arrays kept).
 *
 * NOTE: these helpers are now a *fallback* path. The hot path calls `jt_stats_summary` RPC
 * which computes everything server-side in one round-trip. Fallback kicks in only if the
 * RPC is missing / errors or if the channel-priority setting is non-default (SQL hardcodes
 * default priority [platform, order_source]).
 */
const AGG_PAGE_SIZE = 1000;

/** Shape returned by `jt_stats_summary` RPC (see migrations). */
type StatsSummaryRpcResult = {
    total_fee: string | number;
    max_fee: string | number;
    count_rows: number | string;
    sum_mkt: string | number;
    count_mkt: number | string;
    sum_jms: string | number;
    count_jms: number | string;
    platform_counts: Array<{ name: string; count: number }>;
    top_senders: Array<{ name: string; count: number }>;
    top_receivers: Array<{ name: string; count: number }>;
};

type StatsSummaryReady = {
    totalFee: number;
    avgFee: number;
    maxFee: number;
    sumFeeMarketplace: number;
    countFeeMarketplace: number;
    sumFeeJms: number;
    countFeeJms: number;
    platformCounts: Array<{ name: string; count: number }>;
    topSendersCount: Array<{ name: string; count: number }>;
    topReceivers: Array<{ name: string; count: number }>;
};

/** The RPC hardcodes default channel priority. Skip it if the admin overrode the priority. */
function isDefaultChannelPriority(priority: string[]): boolean {
    if (priority.length !== DEFAULT_JT_CHANNEL_PRIORITY.length) return false;
    for (let i = 0; i < priority.length; i += 1) {
        if (priority[i] !== DEFAULT_JT_CHANNEL_PRIORITY[i]) return false;
    }
    return true;
}

/**
 * One-shot server-side aggregation via `jt_stats_summary(p_date_from, p_date_to)` RPC.
 * Replaces 4 paginated loops (fee stats, top senders, top receivers, platform counts)
 * with a single round-trip. Returns null → TS fallback used.
 */
async function fetchStatsSummaryViaRpc(
    dateFrom: string,
    dateTo: string,
): Promise<StatsSummaryReady | null> {
    const { data, error } = await supabaseAdmin.rpc('jt_stats_summary', {
        p_date_from: dateFrom.trim(),
        p_date_to: dateTo.trim(),
    });
    if (error) {
        console.warn(
            '[jt-stats] jt_stats_summary RPC unavailable, using TS fallback:',
            error.message,
        );
        return null;
    }
    const r = data as StatsSummaryRpcResult | null;
    if (!r || typeof r !== 'object') return null;
    const totalFee = Number(r.total_fee) || 0;
    const countRows = Number(r.count_rows) || 0;
    return {
        totalFee,
        avgFee: countRows > 0 ? totalFee / countRows : 0,
        maxFee: Number(r.max_fee) || 0,
        sumFeeMarketplace: Number(r.sum_mkt) || 0,
        countFeeMarketplace: Number(r.count_mkt) || 0,
        sumFeeJms: Number(r.sum_jms) || 0,
        countFeeJms: Number(r.count_jms) || 0,
        platformCounts: Array.isArray(r.platform_counts) ? r.platform_counts : [],
        topSendersCount: Array.isArray(r.top_senders) ? r.top_senders : [],
        topReceivers: Array.isArray(r.top_receivers) ? r.top_receivers : [],
    };
}

async function aggregateFeeStats(
    selectCols: string,
    priority: string[],
): Promise<{
    totalFee: number;
    avgFee: number;
    maxFee: number;
    countFee: number;
    sumFeeMarketplace: number;
    countFeeMarketplace: number;
    sumFeeJms: number;
    countFeeJms: number;
}> {
    let offset = 0;
    let totalFee = 0;
    let maxFee = 0;
    let countFee = 0;
    let sumFeeMarketplace = 0;
    let countFeeMarketplace = 0;
    let sumFeeJms = 0;
    let countFeeJms = 0;

    for (;;) {
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select(selectCols)
            .range(offset, offset + AGG_PAGE_SIZE - 1);
        if (error) {
            console.error('[jt-stats] aggregateFeeStats', error);
            throw new Error(error.message);
        }
        const rows = (data || []) as unknown as Record<string, unknown>[];
        for (const row of rows) {
            const f = parseJtMoneyText(row.shipping_fee);
            totalFee += f;
            if (f > maxFee) maxFee = f;
            countFee += 1;
            const label = channelBucketLabelFromRow(row, priority);
            const bucket = classifyShippingFeeBucket(label);
            if (bucket === 'marketplace') {
                sumFeeMarketplace += f;
                countFeeMarketplace += 1;
            } else if (bucket === 'jms') {
                sumFeeJms += f;
                countFeeJms += 1;
            }
        }
        if (rows.length < AGG_PAGE_SIZE) break;
        offset += AGG_PAGE_SIZE;
    }

    return {
        totalFee,
        avgFee: countFee ? totalFee / countFee : 0,
        maxFee,
        countFee,
        sumFeeMarketplace,
        countFeeMarketplace,
        sumFeeJms,
        countFeeJms,
    };
}

async function aggregateTopNames(
    column: 'sender_name' | 'receiver_name',
    topN = 10,
): Promise<{ name: string; count: number }[]> {
    let offset = 0;
    const map: Record<string, number> = {};

    for (;;) {
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select(column)
            .not(column, 'is', null)
            .range(offset, offset + AGG_PAGE_SIZE - 1);
        if (error) {
            console.error(`[jt-stats] aggregateTopNames(${column})`, error);
            break;
        }
        const rows = (data || []) as unknown as Record<string, string>[];
        for (const r of rows) {
            const name = r[column];
            if (name) map[name] = (map[name] || 0) + 1;
        }
        if (rows.length < AGG_PAGE_SIZE) break;
        offset += AGG_PAGE_SIZE;
    }

    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([name, count]) => ({ name, count }));
}

async function aggregateTopProductNames(topN = 10): Promise<{ name: string; count: number }[]> {
    let offset = 0;
    const map: Record<string, number> = {};

    for (;;) {
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select('product_name')
            .not('product_name', 'is', null)
            .range(offset, offset + AGG_PAGE_SIZE - 1);
        if (error) {
            console.error('[jt-stats] aggregateTopProductNames', error);
            break;
        }
        const rows = (data || []) as unknown as Array<{ product_name: string | null }>;
        for (const r of rows) {
            const name = (r.product_name || '').trim();
            if (!name) continue;
            map[name] = (map[name] || 0) + 1;
        }
        if (rows.length < AGG_PAGE_SIZE) break;
        offset += AGG_PAGE_SIZE;
    }

    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([name, count]) => ({ name, count }));
}

async function aggregateTopSendersByShippingFee(
    topN = 10,
): Promise<Array<{ name: string; totalShippingFee: number }>> {
    let offset = 0;
    const map: Record<string, number> = {};

    for (;;) {
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select('sender_name,total_shipping_fee')
            .not('sender_name', 'is', null)
            .range(offset, offset + AGG_PAGE_SIZE - 1);
        if (error) {
            console.error('[jt-stats] aggregateTopSendersByShippingFee', error);
            break;
        }
        const rows = (data || []) as unknown as Array<{
            sender_name: string | null;
            total_shipping_fee: unknown;
        }>;
        for (const r of rows) {
            const name = (r.sender_name || '').trim();
            if (!name) continue;
            map[name] = (map[name] || 0) + parseJtMoneyText(r.total_shipping_fee);
        }
        if (rows.length < AGG_PAGE_SIZE) break;
        offset += AGG_PAGE_SIZE;
    }

    return Object.entries(map)
        .map(([name, totalShippingFee]) => ({
            name,
            totalShippingFee: Math.round(totalShippingFee * 100) / 100,
        }))
        .sort((a, b) => b.totalShippingFee - a.totalShippingFee)
        .slice(0, topN);
}

async function aggregatePlatformCounts(
    selectCols: string,
    priority: string[],
): Promise<{ name: string; count: number }[]> {
    let offset = 0;
    const map: Record<string, number> = {};

    for (;;) {
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select(selectCols)
            .range(offset, offset + AGG_PAGE_SIZE - 1);
        if (error) {
            console.error('[jt-stats] aggregatePlatformCounts', error);
            break;
        }
        const rows = (data || []) as unknown as Record<string, unknown>[];
        for (const row of rows) {
            const name = channelBucketLabelFromRow(row, priority);
            map[name] = (map[name] || 0) + 1;
        }
        if (rows.length < AGG_PAGE_SIZE) break;
        offset += AGG_PAGE_SIZE;
    }

    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count }));
}

/**
 * PostgREST pagination fallback — only used if DB RPC is missing.
 * `booking_date` is often **text** (`YYYY-MM-DD HH:mm:ss` or `...T...Z`). Lexicographic
 * compare against ISO `...T00:00:00.000Z` wrongly drops same-day space-format rows; use
 * `gte(YYYY-MM-DD)` + `lt(first_day_after_end)` so all encodings of days in [start,end] match.
 */
async function fetchBookingRowsInUtcWindow(startYmd: string, endYmd: string) {
    const out: { booking_date: string; total_shipping_fee: unknown; cod_amount: unknown }[] = [];
    const pageSize = 1000;
    let offset = 0;
    const endExclusive = nextUtcCalendarDayYmd(endYmd);
    for (;;) {
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select('booking_date, total_shipping_fee, cod_amount')
            .gte('booking_date', startYmd)
            .lt('booking_date', endExclusive)
            .order('booking_date', { ascending: true })
            .range(offset, offset + pageSize - 1);
        if (error) {
            console.error('[jt-stats] daily stats pagination fallback', error);
            break;
        }
        const rows = (data || []) as {
            booking_date: string;
            total_shipping_fee: unknown;
            cod_amount: unknown;
        }[];
        out.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
    }
    return out;
}

function aggregateDailyStatsFallback(
    dayKeys: string[],
    rows: { booking_date: string; total_shipping_fee: unknown; cod_amount: unknown }[],
): {
    daily30: { date: string; count: number }[];
    dailyFee30: { date: string; feeTotal: number }[];
    dailyCod30: { date: string; codTotal: number }[];
} {
    const daySet = new Set(dayKeys);
    const countMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    const feeMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    const codMap: Record<string, number> = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    for (const row of rows) {
        const key = utcDayKeyFromIso(row.booking_date);
        if (!key || !daySet.has(key)) continue;
        countMap[key] = (countMap[key] || 0) + 1;
        feeMap[key] = (feeMap[key] || 0) + parseJtMoneyText(row.total_shipping_fee);
        codMap[key] = (codMap[key] || 0) + parseJtMoneyText(row.cod_amount);
    }
    return {
        daily30: dayKeys.map((date) => ({ date, count: countMap[date] ?? 0 })),
        dailyFee30: dayKeys.map((date) => ({
            date,
            feeTotal: Math.round((feeMap[date] ?? 0) * 100) / 100,
        })),
        dailyCod30: dayKeys.map((date) => ({
            date,
            codTotal: Math.round((codMap[date] ?? 0) * 100) / 100,
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

function resolveChartAxis(
    searchParams: URLSearchParams,
    anchorSafe: number,
): {
    dayKeysWindow: string[];
    startDateWindow: string;
    endDateWindow: string;
    axisDayCount: number;
    mode: ChartAxisMode;
    rollingWindowDays: number;
    anchorHint: string;
} {
    const chartFrom = searchParams.get('chart_from')?.trim() ?? '';
    const chartTo = searchParams.get('chart_to')?.trim() ?? '';
    const chartMonth = searchParams.get('chart_month')?.trim() ?? '';

    const rangeKeys =
        chartFrom && chartTo ? buildUtcDayKeysInclusiveRange(chartFrom, chartTo, 400) : null;
    if (rangeKeys && rangeKeys.length > 0) {
        const startDateWindow = rangeKeys[0];
        const endDateWindow = rangeKeys[rangeKeys.length - 1];
        return {
            dayKeysWindow: rangeKeys,
            startDateWindow,
            endDateWindow,
            axisDayCount: rangeKeys.length,
            mode: 'range',
            rollingWindowDays: clampChartWindowDays(searchParams.get('window_days')),
            anchorHint:
                'ช่วงบนกราฟ = วันที่ปฏิทิน UTC ต่อเนื่องตาม chart_from / chart_to (สอดคล้องกับการแยก booking_date เป็นวัน UTC)',
        };
    }

    const monthKeys = chartMonth ? buildUtcDayKeysForMonth(chartMonth) : null;
    if (monthKeys && monthKeys.length > 0) {
        const startDateWindow = monthKeys[0];
        const endDateWindow = monthKeys[monthKeys.length - 1];
        return {
            dayKeysWindow: monthKeys,
            startDateWindow,
            endDateWindow,
            axisDayCount: monthKeys.length,
            mode: 'month',
            rollingWindowDays: clampChartWindowDays(searchParams.get('window_days')),
            anchorHint:
                'ช่วงบนกราฟ = เต็มเดือนปฏิทิน UTC ตาม chart_month (เช่น 2026-01 = 1–31 ม.ค. UTC)',
        };
    }

    const rollingWindowDays = clampChartWindowDays(searchParams.get('window_days'));
    const { keys: dayKeysWindow } = buildUtcDayWindow(anchorSafe, rollingWindowDays);
    const startDateWindow = dayKeysWindow[0];
    const endDateWindow = dayKeysWindow[dayKeysWindow.length - 1];
    return {
        dayKeysWindow,
        startDateWindow,
        endDateWindow,
        axisDayCount: rollingWindowDays,
        mode: 'rolling',
        rollingWindowDays,
        anchorHint:
            'ช่วงวันที่บนกราฟ = วัน UTC ต่อเนื่องจำนวน window_days วัน โดยให้วันสุดท้ายตรงกับวันที่จองล่าสุดในตาราง (ไม่ใช่วันนี้ของปฏิทิน)',
    };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

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

        const axis = resolveChartAxis(searchParams, anchorSafe);
        const { dayKeysWindow, startDateWindow, endDateWindow } = axis;

        const paramNotes: string[] = [];
        const rawMonth = searchParams.get('chart_month')?.trim();
        if (rawMonth && buildUtcDayKeysForMonth(rawMonth) == null) {
            paramNotes.push(
                'ค่า chart_month ไม่ถูกต้อง — กราฟใช้โหมดย้อนหลังจากจองล่าสุด (UTC)',
            );
        }
        const rawFrom = searchParams.get('chart_from')?.trim();
        const rawTo = searchParams.get('chart_to')?.trim();
        if (rawFrom && rawTo && buildUtcDayKeysInclusiveRange(rawFrom, rawTo, 400) == null) {
            paramNotes.push(
                'ช่วง chart_from / chart_to ไม่ถูกต้อง — กราฟใช้โหมดย้อนหลังจากจองล่าสุด (UTC)',
            );
        }

        // Hot path: single RPC for fee aggregates + top senders/receivers + platform counts.
        // Skip only when admin overrode the channel-priority setting (RPC hardcodes default).
        const canUseStatsRpc = isDefaultChannelPriority(priority);
        const rpcSummaryPromise: Promise<StatsSummaryReady | null> = canUseStatsRpc
            ? fetchStatsSummaryViaRpc('', '')
            : Promise.resolve(null);

        const [
            totalRes,
            todayRes,
            weekRes,
            monthRes,
            rpcSummary,
            recentRes,
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
            rpcSummaryPromise,
            supabaseAdmin
                .from('jt_shipments')
                .select(recentSelect)
                .order('booking_date', { ascending: false })
                .limit(10),
            supabaseAdmin.from('jt_shipments').select('*', { count: 'exact', head: true }).is('booking_date', null),
            rpcDailyStatsUtc(startDateWindow, endDateWindow),
        ]);

        // ── Fee / bucket / top-names / platform-counts ──
        // Branch: RPC success → use its scalars/arrays; RPC missing → run 4 paginated TS helpers in parallel.
        let totalFee: number;
        let avgFee: number;
        let maxFee: number;
        let sumFeeMarketplace: number;
        let countFeeMarketplace: number;
        let sumFeeJms: number;
        let countFeeJms: number;
        let topSenders: Array<{ name: string; totalShippingFee: number }>;
        let topSendersCount: Array<{ name: string; count: number }>;
        let topProducts: Array<{ name: string; count: number }>;
        let topReceivers: Array<{ name: string; count: number }>;
        let platformCounts: Array<{ name: string; count: number }>;
        let aggregateSource: 'rpc' | 'paginate';

        if (rpcSummary) {
            ({
                totalFee,
                avgFee,
                maxFee,
                sumFeeMarketplace,
                countFeeMarketplace,
                sumFeeJms,
                countFeeJms,
                topSendersCount,
                topReceivers,
                platformCounts,
            } = rpcSummary);
            const [sendersByFee, products] = await Promise.all([
                aggregateTopSendersByShippingFee(10),
                aggregateTopProductNames(10),
            ]);
            topSenders = sendersByFee;
            topProducts = products;
            aggregateSource = 'rpc';
        } else {
            const [feeAggregates, sendersByFee, sendersByCount, products, receivers, platforms] = await Promise.all([
                aggregateFeeStats(feeSelect, priority),
                aggregateTopSendersByShippingFee(10),
                aggregateTopNames('sender_name', 10),
                aggregateTopProductNames(10),
                aggregateTopNames('receiver_name', 10),
                aggregatePlatformCounts(platformSelect, priority),
            ]);
            ({
                totalFee,
                avgFee,
                maxFee,
                sumFeeMarketplace,
                countFeeMarketplace,
                sumFeeJms,
                countFeeJms,
            } = feeAggregates);
            topSenders = sendersByFee;
            topSendersCount = sendersByCount;
            topProducts = products;
            topReceivers = receivers;
            platformCounts = platforms;
            aggregateSource = 'paginate';
        }

        const avgFeeMarketplace = countFeeMarketplace ? sumFeeMarketplace / countFeeMarketplace : 0;
        const avgFeeJms = countFeeJms ? sumFeeJms / countFeeJms : 0;

        let daily30: { date: string; count: number }[];
        let dailyFee30: { date: string; feeTotal: number }[];
        let dailyCod30: { date: string; codTotal: number }[];
        if (rpcStats30 !== null) {
            const filled = fillDailyStatsSeries(dayKeysWindow, rpcStats30);
            daily30 = filled.daily30;
            dailyFee30 = filled.dailyFee30;
            dailyCod30 = filled.dailyCod30;
        } else {
            const fallbackRows = await fetchBookingRowsInUtcWindow(startDateWindow, endDateWindow);
            const agg = aggregateDailyStatsFallback(dayKeysWindow, fallbackRows);
            daily30 = agg.daily30;
            dailyFee30 = agg.dailyFee30;
            dailyCod30 = agg.dailyCod30;
        }
        const sumDaily30 = daily30.reduce((a, d) => a + d.count, 0);
        const sumDailyFee30 = dailyFee30.reduce((a, d) => a + d.feeTotal, 0);
        const sumDailyCod30 = dailyCod30.reduce((a, d) => a + d.codTotal, 0);
        const distinctDaysWithCount = daily30.filter((d) => d.count > 0).length;
        const bookingNull = bookingNullRes.count ?? 0;
        const rowsOutsideWindowApprox = Math.max(0, (totalRes.count || 0) - bookingNull - sumDaily30);

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
            topSendersCount,
            topProducts,
            topReceivers,
            daily30,
            dailyFee30,
            dailyCod30,
            sumDaily30,
            sumDailyFee30,
            sumDailyCod30,
            bookingDateNullCount: bookingNull,
            chartWindow: {
                mode: axis.mode,
                windowDays: axis.axisDayCount,
                rollingWindowDays: axis.rollingWindowDays,
                utcStart: startDateWindow,
                utcEnd: endDateWindow,
                /** จำนวนวันบนแกนที่มีอย่างน้อย 1 รายการ (จำนวนแท่งที่เห็นมีข้อมูล) */
                distinctDaysWithData: distinctDaysWithCount,
                rowsInWindow: sumDaily30,
                rowsOutsideWindowApprox,
                anchorHint: axis.anchorHint,
                dailyStatsSource: rpcStats30 !== null ? 'rpc' : 'fallback',
                paramNotes,
            },
            platformCounts,
            channelFieldPriority: priority,
            ui: {
                sections: parseJtDashboardSectionsJson(sectionsVal),
            },
            _aggregate_source: aggregateSource,
        });
    } catch (e) {
        console.error('[jt-stats]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
