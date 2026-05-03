'use client';

/**
 * J&T Dashboard — ข้อมูลจาก `jt_shipments` ผ่าน `/api/admin/jt-shipments/dashboard`
 * แมปคอลัมน์กับ root `schema.sql` ดู `jtDashboardTypes.ts`
 *
 * Performance enhancements:
 * - SWR-style caching: แสดง cached data ทันที → background refetch
 * - AbortController: ป้องกัน race condition เมื่อกด filter ซ้ำเร็ว
 * - Refresh timestamp: แสดงว่า data โหลดเมื่อไหร่
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { JtDashboardView } from './JtDashboardView';
import type { JtCustomMetricCardDefinition } from '@/lib/jtCustomMetricCards';
import type { JtDashboardChartsPayload } from './jtDashboardStatsChartTypes';
import type {
    JtDashboardMetrics,
    JtDashboardPreviousMetrics,
    JtDashboardShipmentRow,
} from './jtDashboardTypes';
import type { JtTopSenderRow } from './JtTopSendersPanel';

type CustomMetricRow = {
    id: string;
    title: string;
    subtitle?: string;
    icon: string;
    display: string;
    format: string;
};

type SuccessData = {
    metrics: JtDashboardMetrics;
    previousMetrics: JtDashboardPreviousMetrics | null;
    recent: JtDashboardShipmentRow[];
    charts: JtDashboardChartsPayload | null;
    chartError: string | null;
    topSenders: JtTopSenderRow[];
    customMetricDefinitions: JtCustomMetricCardDefinition[];
    customMetrics: CustomMetricRow[];
};

type FetchState =
    | { status: 'idle' | 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success' } & SuccessData;

export default function JtDashboardPage() {
    const [state, setState] = useState<FetchState>({ status: 'idle' });
    const [parcelDateFrom, setParcelDateFrom] = useState('');
    const [parcelDateTo, setParcelDateTo] = useState('');
    const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    // SWR-style cache: keep last successful data so re-fetch shows stale data immediately
    const cacheRef = useRef<SuccessData | null>(null);
    // AbortController to cancel in-flight requests on new fetch
    const abortRef = useRef<AbortController | null>(null);

    const load = useCallback(async (from: string, to: string) => {
        // Cancel any in-flight request
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        // Show loading — but if we have cache, keep showing stale data
        if (cacheRef.current) {
            setState({ status: 'success', ...cacheRef.current });
        } else {
            setState({ status: 'loading' });
        }

        try {
            const params = new URLSearchParams();
            if (from.trim()) params.set('date_from', from.trim());
            if (to.trim()) params.set('date_to', to.trim());

            const statsParams = new URLSearchParams();
            if (from.trim()) statsParams.set('chart_from', from.trim());
            if (to.trim()) statsParams.set('chart_to', to.trim());

            const dashUrl = `/api/admin/jt-shipments/dashboard?${params.toString()}`;
            const statsUrl = `/api/admin/jt-shipments/stats?${statsParams.toString()}`;

            const [res, statsRes] = await Promise.all([
                fetch(dashUrl, {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                }),
                fetch(statsUrl, {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                }),
            ]);

            // If aborted, bail out silently
            if (controller.signal.aborted) return;

            const raw = await res.text();
            let json: {
                error?: string;
                count?: number;
                sumCod?: number;
                avgShippingFee?: number;
                returnCount?: number;
                recent?: JtDashboardShipmentRow[];
                custom_metric_definitions?: JtCustomMetricCardDefinition[];
                custom_metrics?: CustomMetricRow[];
                previous?: JtDashboardPreviousMetrics | null;
            };
            try {
                json = JSON.parse(raw) as typeof json;
            } catch {
                throw new Error(
                    !res.ok
                        ? `HTTP ${res.status} — เซิร์ฟเวอร์ส่งไม่ใช่ JSON (อาจเป็นหน้า error HTML). ตรวจสอบ API และ env SUPABASE`
                        : 'การตอบกลับไม่ใช่ JSON — ตรวจสอบ /api/admin/jt-shipments/dashboard',
                );
            }
            if (!res.ok) throw new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ');

            let charts: JtDashboardChartsPayload | null = null;
            let chartError: string | null = null;
            let topSenders: JtTopSenderRow[] = [];
            try {
                const statsRaw = await statsRes.text();
                let statsJson: {
                    error?: string;
                    daily30?: { date: string; count: number }[];
                    dailyFee30?: { date: string; feeTotal: number }[];
                    dailyCod30?: { date: string; codTotal: number }[];
                    chartWindow?: JtDashboardChartsPayload['chartWindow'];
                    topSenders?: JtTopSenderRow[];
                };
                try {
                    statsJson = JSON.parse(statsRaw) as typeof statsJson;
                } catch {
                    chartError = !statsRes.ok
                        ? `สถิติรายวัน: HTTP ${statsRes.status} — ไม่ใช่ JSON`
                        : 'สถิติรายวัน: การตอบกลับไม่ใช่ JSON';
                    throw new Error('parse');
                }
                if (!statsRes.ok) {
                    chartError = statsJson.error || 'โหลดสถิติรายวันไม่สำเร็จ';
                } else {
                    const cw = statsJson.chartWindow;
                    const d30 = statsJson.daily30 ?? [];
                    charts = {
                        daily30: d30,
                        dailyFee30: statsJson.dailyFee30 ?? [],
                        dailyCod30:
                            statsJson.dailyCod30 ??
                            d30.map((d) => ({ date: d.date, codTotal: 0 })),
                        chartWindow: {
                            mode: cw?.mode,
                            windowDays: cw?.windowDays ?? (statsJson.daily30?.length ?? 0),
                            utcStart: cw?.utcStart ?? '',
                            utcEnd: cw?.utcEnd ?? '',
                            anchorHint: cw?.anchorHint ?? '',
                            dailyStatsSource: cw?.dailyStatsSource,
                            paramNotes: cw?.paramNotes,
                        },
                    };
                    topSenders = Array.isArray(statsJson.topSenders)
                        ? statsJson.topSenders
                              .filter(
                                  (r): r is JtTopSenderRow =>
                                      r != null &&
                                      typeof r.name === 'string' &&
                                      typeof r.count === 'number',
                              )
                              .slice(0, 10)
                        : [];
                }
            } catch (e) {
                if (chartError == null && e instanceof Error && e.message !== 'parse') {
                    chartError = e.message;
                }
            }

            if (controller.signal.aborted) return;

            const successData: SuccessData = {
                metrics: {
                    totalParcels: json.count ?? 0,
                    sumCod: json.sumCod ?? 0,
                    avgShippingFee: json.avgShippingFee ?? 0,
                    returnCount: json.returnCount ?? 0,
                },
                previousMetrics: json.previous ?? null,
                recent: json.recent ?? [],
                charts,
                chartError,
                topSenders,
                customMetricDefinitions: json.custom_metric_definitions ?? [],
                customMetrics: json.custom_metrics ?? [],
            };

            // Update cache
            cacheRef.current = successData;

            setAppliedRange({ from, to });
            setLastRefreshed(new Date());
            setState({ status: 'success', ...successData });
        } catch (e) {
            if (controller.signal.aborted) return;
            const message =
                e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ';
            setState({ status: 'error', message });
        }
    }, []);

    useEffect(() => {
        void load('', '');
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [load]);

    const handleApplyRange = useCallback(() => {
        // Clear cache when filter changes so loading state shows
        cacheRef.current = null;
        void load(parcelDateFrom, parcelDateTo);
    }, [load, parcelDateFrom, parcelDateTo]);

    const loading = state.status === 'loading' || state.status === 'idle';
    const err = state.status === 'error' ? state.message : null;
    const success = state.status === 'success';

    const emptyMetrics: JtDashboardMetrics = {
        totalParcels: 0,
        sumCod: 0,
        avgShippingFee: 0,
        returnCount: 0,
    };

    const saveCustomMetricCards = useCallback(
        async (cards: JtCustomMetricCardDefinition[]) => {
            const res = await fetch('/api/admin/jt-shipments/custom-metric-cards', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ cards }),
            });
            const raw = await res.text();
            if (!res.ok) {
                let msg = 'บันทึกการ์ดไม่สำเร็จ';
                try {
                    const o = JSON.parse(raw) as { error?: string };
                    if (o.error) msg = o.error;
                } catch {
                    /* ignore */
                }
                throw new Error(msg);
            }
            await load(parcelDateFrom, parcelDateTo);
        },
        [load, parcelDateFrom, parcelDateTo],
    );

    const chartsAligned =
        success &&
        Boolean(
            (appliedRange?.from && appliedRange.from.trim()) ||
                (appliedRange?.to && appliedRange.to.trim()),
        );

    return (
        <JtDashboardView
            metrics={success ? state.metrics : emptyMetrics}
            previousMetrics={success ? state.previousMetrics : null}
            recentRows={success ? state.recent : []}
            charts={success ? state.charts : null}
            chartError={success ? state.chartError : null}
            chartsAlignedWithSummaryCards={chartsAligned}
            topSenders={success ? state.topSenders : []}
            customMetricDefinitions={success ? state.customMetricDefinitions : []}
            customMetrics={success ? state.customMetrics : []}
            onSaveCustomMetricCards={saveCustomMetricCards}
            loading={loading}
            error={err}
            parcelDateFrom={parcelDateFrom}
            parcelDateTo={parcelDateTo}
            onParcelDateFromChange={setParcelDateFrom}
            onParcelDateToChange={setParcelDateTo}
            onApplyRange={handleApplyRange}
            onRetry={() => void load(parcelDateFrom, parcelDateTo)}
            appliedRange={appliedRange}
            mockMode={false}
            lastRefreshed={lastRefreshed}
        />
    );
}
