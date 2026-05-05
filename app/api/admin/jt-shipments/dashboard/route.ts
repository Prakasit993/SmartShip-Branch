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

/**
 * Page size for aggregation loop — MUST be ≤ Supabase PostgREST max-rows (default 1000).
 * Asking for a larger range causes the server to cap the response, the loop sees
 * `rows.length < AGG_PAGE` on the very first iteration, and breaks with truncated results.
 * Historical note: was changed 1000 → 5000 based on an incorrect "default is 10000" assumption;
 * that silently truncated aggregates (sumCod, avgShippingFee, returnCount, custom metrics) to
 * the first 1000 rows until reverted here.
 */
const AGG_PAGE = 1000;

type FixedTotalsRow = {
    total_count: number | string;
    sum_cod: number | string;
    sum_fee_positive: number | string;
    count_fee_positive: number | string;
    return_count: number | string;
    // Business KPIs (P6) — optional because older RPC versions may not include them
    sum_total_fee_jms?: number | string;
    cod_paid_count?: number | string;
    cod_paid_amount?: number | string;
    cod_pending_count?: number | string;
    cod_pending_amount?: number | string;
    cod_no_collection_count?: number | string;
};

type FixedTotals = {
    totalCount: number;
    sumCod: number;
    sumFeePositive: number;
    countFeePositive: number;
    returnCount: number;
    sumTotalFeeJms: number;
    codPaidCount: number;
    codPaidAmount: number;
    codPendingCount: number;
    codPendingAmount: number;
    codNoCollectionCount: number;
};

async function aggregateExceptionReasonStats(
    dateFrom: string,
    dateTo: string,
    topN = 5,
): Promise<{ exceptionCount: number; topExceptionReasons: Array<{ reason: string; count: number }> }> {
    let offset = 0;
    let exceptionCount = 0;
    const reasonMap: Record<string, number> = {};

    for (;;) {
        let q = supabaseAdmin.from('jt_shipments').select('exception_reason');
        q = applyBookingDateRangeFilters(q, dateFrom, dateTo);
        const { data, error } = await q.range(offset, offset + AGG_PAGE - 1);
        if (error) {
            console.error('[jt-shipments/dashboard] aggregateExceptionReasonStats', error);
            throw new Error(error.message);
        }
        const rows = (data || []) as Array<{ exception_reason: string | null }>;
        for (const row of rows) {
            const reason = String(row.exception_reason ?? '').trim();
            if (!reason || reason.toLowerCase() === 'null') continue;
            exceptionCount += 1;
            reasonMap[reason] = (reasonMap[reason] || 0) + 1;
        }
        if (rows.length < AGG_PAGE) break;
        offset += AGG_PAGE;
    }

    const topExceptionReasons = Object.entries(reasonMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([reason, count]) => ({ reason, count }));

    return { exceptionCount, topExceptionReasons };
}

function hasMeaningfulReturnType(raw: unknown): boolean {
    const v = String(raw ?? '').trim();
    if (!v) return false;
    const upper = v.toUpperCase();
    return upper !== 'EMPTY' && upper !== 'NULL' && upper !== '-';
}

async function aggregateReturnTypeCases(
    dateFrom: string,
    dateTo: string,
    topN = 10,
): Promise<{
    returnTypeCaseCount: number;
    topReturnTypeCases: Array<{
        awb_number: string;
        sender_name: string;
        exception_reason: string;
        issue_registered_time: string;
    }>;
}> {
    let offset = 0;
    let returnTypeCaseCount = 0;
    const topReturnTypeCases: Array<{
        awb_number: string;
        sender_name: string;
        exception_reason: string;
        issue_registered_time: string;
    }> = [];

    for (;;) {
        let q = supabaseAdmin
            .from('jt_shipments')
            .select('awb_number,sender_name,exception_reason,issue_registered_time,booking_date,signer_name')
            .order('booking_date', { ascending: false, nullsFirst: false });
        q = applyBookingDateRangeFilters(q, dateFrom, dateTo);
        const { data, error } = await q.range(offset, offset + AGG_PAGE - 1);
        if (error) {
            console.error('[jt-shipments/dashboard] aggregateReturnTypeCases', error);
            throw new Error(error.message);
        }
        const rows = (data || []) as Array<{
            awb_number: string | null;
            sender_name: string | null;
            exception_reason: string | null;
            issue_registered_time: string | null;
            signer_name: string | null;
        }>;
        for (const row of rows) {
            if (!hasMeaningfulReturnType(row.issue_registered_time)) continue;
            if (hasMeaningfulReturnType(row.signer_name)) continue; // ข้ามเคสที่ปิดงานแล้ว (มี signer_name)
            returnTypeCaseCount += 1;
            if (topReturnTypeCases.length < topN) {
                topReturnTypeCases.push({
                    awb_number: String(row.awb_number ?? '-').trim() || '-',
                    sender_name: String(row.sender_name ?? '-').trim() || '-',
                    exception_reason: String(row.exception_reason ?? '-').trim() || '-',
                    issue_registered_time: String(row.issue_registered_time ?? '-').trim() || '-',
                });
            }
        }
        if (rows.length < AGG_PAGE) break;
        offset += AGG_PAGE;
    }

    return { returnTypeCaseCount, topReturnTypeCases };
}

/**
 * Server-side aggregation via `jt_dashboard_fixed_totals(p_date_from, p_date_to)` RPC.
 * Replaces ~29 paginated round-trips with 1. Returns null (→ TS fallback) if the RPC
 * is missing or errors, so the endpoint keeps working during migrations.
 */
async function fetchFixedTotalsViaRpc(
    dateFrom: string,
    dateTo: string,
): Promise<FixedTotals | null> {
    const { data, error } = await supabaseAdmin.rpc('jt_dashboard_fixed_totals', {
        p_date_from: dateFrom.trim(),
        p_date_to: dateTo.trim(),
    });
    if (error) {
        console.warn(
            '[jt-shipments/dashboard] jt_dashboard_fixed_totals RPC unavailable, using TS fallback:',
            error.message,
        );
        return null;
    }
    const row = Array.isArray(data) ? (data[0] as FixedTotalsRow | undefined) : null;
    if (!row) return null;
    return {
        totalCount: Number(row.total_count) || 0,
        sumCod: Number(row.sum_cod) || 0,
        sumFeePositive: Number(row.sum_fee_positive) || 0,
        countFeePositive: Number(row.count_fee_positive) || 0,
        returnCount: Number(row.return_count) || 0,
        sumTotalFeeJms: Number(row.sum_total_fee_jms) || 0,
        codPaidCount: Number(row.cod_paid_count) || 0,
        codPaidAmount: Number(row.cod_paid_amount) || 0,
        codPendingCount: Number(row.cod_pending_count) || 0,
        codPendingAmount: Number(row.cod_pending_amount) || 0,
        codNoCollectionCount: Number(row.cod_no_collection_count) || 0,
    };
}

/**
 * จำนวนพัสดุที่ช่องทาง = JMS ผ่าน `jt_stats_summary(p_date_from, p_date_to)` RPC.
 * ใช้แค่ `count_jms` เพื่อโชว์การ์ด "ส่งโดย JMS" — แทนที่ "ค่าส่งเฉลี่ย" ตัวเดิม
 *
 * RPC นี้ hardcode default channel priority `[platform, order_source]` ฝั่ง SQL จึงคืน 0
 * เมื่อ admin override priority ไว้ — ในกรณีนั้นการ์ดจะแสดง 0 (acceptable trade-off เพราะ
 * dashboard ไม่ทำ TS pagination fallback สำหรับ derived bucket)
 */
async function fetchJmsCountViaRpc(dateFrom: string, dateTo: string): Promise<number> {
    const { data, error } = await supabaseAdmin.rpc('jt_stats_summary', {
        p_date_from: dateFrom.trim(),
        p_date_to: dateTo.trim(),
    });
    if (error) {
        console.warn(
            '[jt-shipments/dashboard] jt_stats_summary RPC unavailable for JMS count:',
            error.message,
        );
        return 0;
    }
    const r = data as { count_jms?: number | string } | null;
    return r && typeof r === 'object' ? Number(r.count_jms) || 0 : 0;
}

/**
 * Compute the previous period of equal length (same-day-count shift back) for delta
 * comparisons on KPI cards. Returns null if either date is missing or invalid.
 *
 * Example: range=[2026-05-01, 2026-05-03] (3 days) → prev=[2026-04-28, 2026-04-30]
 */
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
function previousPeriod(
    dateFrom: string,
    dateTo: string,
): { from: string; to: string; days: number } | null {
    const f = dateFrom.trim();
    const t = dateTo.trim();
    if (!YMD_RE.test(f) || !YMD_RE.test(t)) return null;
    const fromMs = Date.parse(`${f}T00:00:00Z`);
    const toMs = Date.parse(`${t}T00:00:00Z`);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return null;
    const DAY = 86_400_000;
    const days = Math.round((toMs - fromMs) / DAY) + 1;
    if (days < 1) return null;
    const prevTo = new Date(fromMs - DAY);
    const prevFrom = new Date(prevTo.getTime() - (days - 1) * DAY);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { from: fmt(prevFrom), to: fmt(prevTo), days };
}

function formatMetricDisplay(raw: number, format: 'count' | 'thb'): string {
    if (format === 'count') return Math.round(raw).toLocaleString('th-TH');
    return raw.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * สรุปแดชบอร์ด J&T จาก `jt_shipments` (อ้างอิง schema — เงินและวันที่เป็นข้อความ)
 * Query: date_from, date_to (YYYY-MM-DD) กรอง booking_date; ว่าง = ทั้งตาราง
 *
 * Performance tiers:
 *  1. Hot path  (no custom metrics configured): RPC returns 4 scalars in ~100ms, skip pagination
 *  2. Warm path (custom metrics configured)   : RPC + 1 pagination loop for custom accumulators only
 *  3. Cold path (RPC missing)                 : full TS pagination fallback (pre-RPC behavior)
 */
export async function GET(req: Request) {
    const t0 = performance.now();
    try {
        const { searchParams } = new URL(req.url);
        const dateFrom = searchParams.get('date_from') || '';
        const dateTo = searchParams.get('date_to') || '';

        // ── Phase 1: Parallel — settings + count + recent + fixed totals RPC ──
        let countQ = supabaseAdmin.from('jt_shipments').select('awb_number', { count: 'exact', head: true });
        countQ = applyBookingDateRangeFilters(countQ, dateFrom, dateTo);

        let closedCountQ = supabaseAdmin.from('jt_shipments').select('awb_number', { count: 'exact', head: true })
            .not('signer_name', 'is', null)
            .neq('signer_name', 'NULL')
            .neq('signer_name', '');
        closedCountQ = applyBookingDateRangeFilters(closedCountQ, dateFrom, dateTo);

        let recentQ = supabaseAdmin
            .from('jt_shipments')
            .select('awb_number, booking_date, receiver_name, receiver_phone, shipping_fee, cod_amount, latest_scan_type');
        recentQ = applyBookingDateRangeFilters(recentQ, dateFrom, dateTo);

        // Delta comparison: compute previous period of equal length only when both dates are set.
        const prevRange = previousPeriod(dateFrom, dateTo);
        const previousTotalsPromise: Promise<FixedTotals | null> = prevRange
            ? fetchFixedTotalsViaRpc(prevRange.from, prevRange.to)
            : Promise.resolve(null);
        const previousJmsCountPromise: Promise<number> = prevRange
            ? fetchJmsCountViaRpc(prevRange.from, prevRange.to)
            : Promise.resolve(0);

        const [
            settingsResult,
            countResult,
            closedCountResult,
            recentResult,
            rpcTotals,
            previousTotals,
            jmsCount,
            previousJmsCount,
            exceptionStats,
            previousExceptionStats,
            returnTypeCases,
            previousReturnTypeCases,
        ] = await Promise.all([
            supabaseAdmin
                .from('settings')
                .select('value')
                .eq('key', JT_CUSTOM_METRIC_SETTINGS_KEY)
                .maybeSingle(),
            countQ,
            closedCountQ,
            recentQ
                .order('booking_date', { ascending: false, nullsFirst: false })
                .limit(5),
            fetchFixedTotalsViaRpc(dateFrom, dateTo),
            previousTotalsPromise,
            fetchJmsCountViaRpc(dateFrom, dateTo),
            previousJmsCountPromise,
            aggregateExceptionReasonStats(dateFrom, dateTo, 5),
            prevRange
                ? aggregateExceptionReasonStats(prevRange.from, prevRange.to, 5)
                : Promise.resolve({ exceptionCount: 0, topExceptionReasons: [] }),
            aggregateReturnTypeCases(dateFrom, dateTo, 100),
            prevRange
                ? aggregateReturnTypeCases(prevRange.from, prevRange.to, 100)
                : Promise.resolve({ returnTypeCaseCount: 0, topReturnTypeCases: [] }),
        ]);

        const { count, error: cErr } = countResult;
        if (cErr) {
            console.error('[jt-shipments/dashboard] count', cErr);
            return NextResponse.json({ error: cErr.message }, { status: 500 });
        }

        const { count: closedCount, error: ccErr } = closedCountResult;
        if (ccErr) {
            console.error('[jt-shipments/dashboard] closed count', ccErr);
            // Non-fatal, just log
        }

        const { data: recent, error: rErr } = recentResult;
        if (rErr) {
            console.error('[jt-shipments/dashboard] recent', rErr);
            return NextResponse.json({ error: rErr.message }, { status: 500 });
        }

        const customDefs = parseJtCustomMetricCardsFromSettingsValue(settingsResult.data?.value);

        // ── Phase 2: Aggregation ──
        // Fixed totals: prefer RPC (O(1) round-trip). TS pagination only if RPC missing.
        // Custom metrics: always paginate TS-side (per-card filter/agg is dynamic).
        let sumCod = rpcTotals?.sumCod ?? 0;
        let sumFeePositive = rpcTotals?.sumFeePositive ?? 0;
        let countFeePositive = rpcTotals?.countFeePositive ?? 0;
        let returnCount = rpcTotals?.returnCount ?? 0;
        const needFixedTotalsFallback = rpcTotals === null;

        const metricAcc = createMetricAccumulators(customDefs);
        // Force loop to calculate total_shipping_fee since RPC doesn't have it for all rows
        const needAggregationLoop = true; 

        let sumTotalShippingFee = 0;

        if (needAggregationLoop) {
            const baseAggCols = needFixedTotalsFallback
                ? ['shipping_fee', 'cod_amount', 'latest_scan_type', 'total_shipping_fee']
                : ['total_shipping_fee'];
            const extraCols = unionColumnsForCustomMetrics(customDefs);
            const selectCols = [...new Set([...baseAggCols, ...extraCols])].join(',');

            let offset = 0;
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
                    
                    // Always calculate sumTotalShippingFee
                    sumTotalShippingFee += parseJtMoneyText(r.total_shipping_fee);

                    if (needFixedTotalsFallback) {
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
                    }
                    feedCustomMetricRow(metricAcc, r, customDefs);
                }
                if (rows.length < AGG_PAGE) break;
                offset += AGG_PAGE;
            }
        }

        const avgShippingFee =
            countFeePositive > 0 ? Math.round((sumFeePositive / countFeePositive) * 100) / 100 : 0;

        const finalized = finalizeCustomMetrics(metricAcc, customDefs);
        const custom_metrics = finalized.map((m) => ({
            ...m,
            display: formatMetricDisplay(m.raw, m.format),
        }));

        // Business KPIs (P6) — only populated when RPC is available (cold path returns 0).
        const sumTotalFeeJms = rpcTotals?.sumTotalFeeJms ?? 0;
        const codPaidCount = rpcTotals?.codPaidCount ?? 0;
        const codPaidAmount = rpcTotals?.codPaidAmount ?? 0;
        const codPendingCount = rpcTotals?.codPendingCount ?? 0;
        const codPendingAmount = rpcTotals?.codPendingAmount ?? 0;
        const codNoCollectionCount = rpcTotals?.codNoCollectionCount ?? 0;
        const codTotalCollectable = codPaidCount + codPendingCount;
        const codCollectionRate =
            codTotalCollectable > 0 ? Math.round((codPaidCount / codTotalCollectable) * 10000) / 100 : 0;

        // Previous-period payload for KPI delta badges (shown only when both dates are set).
        const previous =
            prevRange && previousTotals
                ? {
                      range: { from: prevRange.from, to: prevRange.to, days: prevRange.days },
                      count: previousTotals.totalCount,
                      sumCod: previousTotals.sumCod,
                      avgShippingFee:
                          previousTotals.countFeePositive > 0
                              ? Math.round(
                                    (previousTotals.sumFeePositive / previousTotals.countFeePositive) *
                                        100,
                                ) / 100
                              : 0,
                      returnCount: previousTotals.returnCount,
                      jmsCount: previousJmsCount,
                      sumTotalFeeJms: previousTotals.sumTotalFeeJms,
                      codPaidCount: previousTotals.codPaidCount,
                      codPaidAmount: previousTotals.codPaidAmount,
                      codPendingCount: previousTotals.codPendingCount,
                      codPendingAmount: previousTotals.codPendingAmount,
                      codNoCollectionCount: previousTotals.codNoCollectionCount,
                      exceptionCount: previousReturnTypeCases.returnTypeCaseCount,
                      codCollectionRate:
                          previousTotals.codPaidCount + previousTotals.codPendingCount > 0
                              ? Math.round(
                                    (previousTotals.codPaidCount /
                                        (previousTotals.codPaidCount + previousTotals.codPendingCount)) *
                                        10000,
                                ) / 100
                              : 0,
                  }
                : null;

        const elapsed = Math.round(performance.now() - t0);
        const source = rpcTotals ? (customDefs.length > 0 ? 'rpc+paginate-custom' : 'rpc') : 'paginate';
        console.log(`[jt-shipments/dashboard] done in ${elapsed}ms — ${count} rows (${source})`);

        return NextResponse.json({
            count: count ?? 0,
            closedCount: closedCount ?? 0,
            sumCod,
            avgShippingFee,
            returnCount,
            jmsCount,
            sumTotalFeeJms,
            sumTotalShippingFee,
            codPaidCount,
            codPaidAmount,
            codPendingCount,
            codPendingAmount,
            codNoCollectionCount,
            codCollectionRate,
            exceptionCount: returnTypeCases.returnTypeCaseCount,
            topExceptionReasons: exceptionStats.topExceptionReasons,
            topReturnTypeCases: returnTypeCases.topReturnTypeCases,
            recent: recent ?? [],
            date_from: dateFrom.trim() || null,
            date_to: dateTo.trim() || null,
            custom_metric_definitions: customDefs,
            custom_metrics,
            previous,
            _elapsed_ms: elapsed,
            _source: source,
        });
    } catch (e) {
        console.error('[jt-shipments/dashboard]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
