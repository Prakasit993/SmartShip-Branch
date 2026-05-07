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
import type { JtTopProductRow, JtTopSenderCountRow, JtTopSenderRow } from './JtTopSendersPanel';
import { DEFAULT_JT_SHIPMENT_DETAIL_FIELDS } from '@/lib/jtShipmentDetailFields';

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
    topSendersCount: JtTopSenderCountRow[];
    topProducts: JtTopProductRow[];
    customMetricDefinitions: JtCustomMetricCardDefinition[];
    customMetrics: CustomMetricRow[];
    detailFields: string[];
    availableDetailFields: string[];
};

type FetchState =
    | { status: 'idle' | 'loading' }
    | { status: 'error'; message: string }
    | { status: 'success' } & SuccessData;

function toLocalYmd(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addLocalDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function getDefaultParcelDateRange(): { from: string; to: string } {
    const today = new Date();
    return {
        from: toLocalYmd(addLocalDays(today, -6)),
        to: toLocalYmd(today),
    };
}

export default function JtDashboardPage() {
    const [initialDateRange] = useState(() => getDefaultParcelDateRange());
    const [state, setState] = useState<FetchState>({ status: 'idle' });
    const [parcelDateFrom, setParcelDateFrom] = useState(initialDateRange.from);
    const [parcelDateTo, setParcelDateTo] = useState(initialDateRange.to);
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

            const [res, statsRes, detailFieldsRes] = await Promise.all([
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
                fetch('/api/admin/jt-shipments/detail-fields-settings', {
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
                closedCount?: number;
                sumCod?: number;
                avgShippingFee?: number;
                returnCount?: number;
                jmsCount?: number;
                sumTotalFeeJms?: number;
                sumTotalShippingFee?: number;
                codPaidCount?: number;
                codPaidAmount?: number;
                codPendingCount?: number;
                codPendingAmount?: number;
                codNoCollectionCount?: number;
                exceptionCount?: number;
                topExceptionReasons?: Array<{ reason: string; count: number }>;
                topExceptionCases?: Array<{
                    awb_number: string;
                    sender_name: string;
                    receiver_name: string;
                    receiver_phone: string;
                    exception_reason: string;
                    issue_registered_time?: string;
                }>;
                topReturnTypeCases?: Array<{
                    awb_number: string;
                    sender_name: string;
                    receiver_name: string;
                    receiver_phone: string;
                    exception_reason: string;
                    return_branch_name: string;
                    issue_registered_time?: string;
                }>;
                codCollectionRate?: number;
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
                        ? `โหลดข้อมูลหลักไม่สำเร็จ (HTTP ${res.status}) เซิร์ฟเวอร์ตอบกลับมาไม่ใช่ JSON กรุณาตรวจสอบ API และค่า SUPABASE`
                        : 'รูปแบบข้อมูลหลักไม่ถูกต้อง กรุณาตรวจสอบ /api/admin/jt-shipments/dashboard',
                );
            }
            if (!res.ok) throw new Error(json.error || 'โหลดข้อมูลหลักไม่สำเร็จ');

            let charts: JtDashboardChartsPayload | null = null;
            let chartError: string | null = null;
            let topSenders: JtTopSenderRow[] = [];
            let topSendersCount: JtTopSenderCountRow[] = [];
            let topProducts: JtTopProductRow[] = [];
            let detailFields = [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
            let availableDetailFields = [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
            try {
                const statsRaw = await statsRes.text();
                let statsJson: {
                    error?: string;
                    daily30?: { date: string; count: number }[];
                    dailyFee30?: { date: string; feeTotal: number }[];
                    dailyCod30?: { date: string; codTotal: number }[];
                    chartWindow?: JtDashboardChartsPayload['chartWindow'];
                    topSenders?: JtTopSenderRow[];
                    topSendersCount?: JtTopSenderCountRow[];
                    topProducts?: JtTopProductRow[];
                };
                try {
                    statsJson = JSON.parse(statsRaw) as typeof statsJson;
                } catch {
                    chartError = !statsRes.ok
                        ? `โหลดสถิติรายวันไม่สำเร็จ (HTTP ${statsRes.status}) เซิร์ฟเวอร์ตอบกลับมาไม่ใช่ JSON`
                        : 'รูปแบบข้อมูลสถิติรายวันไม่ถูกต้อง';
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
                                      typeof r.totalShippingFee === 'number',
                              )
                              .slice(0, 10)
                        : [];
                    topSendersCount = Array.isArray(statsJson.topSendersCount)
                        ? statsJson.topSendersCount
                              .filter(
                                  (r): r is JtTopSenderCountRow =>
                                      r != null &&
                                      typeof r.name === 'string' &&
                                      typeof r.count === 'number',
                              )
                              .slice(0, 10)
                        : [];
                    topProducts = Array.isArray(statsJson.topProducts)
                        ? statsJson.topProducts
                              .filter(
                                  (r): r is JtTopProductRow =>
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

            try {
                const detailRaw = await detailFieldsRes.text();
                const detailJson = JSON.parse(detailRaw) as {
                    fields?: unknown;
                    availableFields?: unknown;
                    error?: string;
                };
                if (detailFieldsRes.ok && Array.isArray(detailJson.fields)) {
                    detailFields = detailJson.fields.filter((x): x is string => typeof x === 'string');
                }
                if (detailFieldsRes.ok && Array.isArray(detailJson.availableFields)) {
                    availableDetailFields = detailJson.availableFields.filter(
                        (x): x is string => typeof x === 'string',
                    );
                }
            } catch {
                // keep defaults
            }

            if (controller.signal.aborted) return;

            const successData: SuccessData = {
                metrics: {
                    totalParcels: json.count ?? 0,
                    closedCount: json.closedCount ?? 0,
                    sumCod: json.sumCod ?? 0,
                    avgShippingFee: json.avgShippingFee ?? 0,
                    returnCount: json.returnCount ?? 0,
                    jmsCount: json.jmsCount ?? 0,
                    sumTotalFeeJms: json.sumTotalFeeJms ?? 0,
                    sumTotalShippingFee: json.sumTotalShippingFee ?? 0,
                    codPaidCount: json.codPaidCount ?? 0,
                    codPaidAmount: json.codPaidAmount ?? 0,
                    codPendingCount: json.codPendingCount ?? 0,
                    codPendingAmount: json.codPendingAmount ?? 0,
                    codNoCollectionCount: json.codNoCollectionCount ?? 0,
                    exceptionCount: json.exceptionCount ?? 0,
                    topExceptionReasons: Array.isArray(json.topExceptionReasons)
                        ? json.topExceptionReasons
                              .filter(
                                  (r): r is { reason: string; count: number } =>
                                      r != null &&
                                      typeof r.reason === 'string' &&
                                      typeof r.count === 'number',
                              )
                              .slice(0, 5)
                        : [],
                    topExceptionCases: Array.isArray(json.topExceptionCases)
                        ? json.topExceptionCases
                              .filter(
                                  (
                                      r,
                                  ): r is {
                                      awb_number: string;
                                      sender_name: string;
                                      receiver_name: string;
                                      receiver_phone: string;
                                      exception_reason: string;
                                      issue_registered_time?: string;
                                  } =>
                                      r != null &&
                                      typeof r.awb_number === 'string' &&
                                      typeof r.sender_name === 'string' &&
                                      typeof r.receiver_name === 'string' &&
                                      typeof r.receiver_phone === 'string' &&
                                      typeof r.exception_reason === 'string',
                              )
                              .slice(0, 100)
                        : [],
                    topReturnTypeCases: Array.isArray(json.topReturnTypeCases)
                        ? json.topReturnTypeCases
                              .filter(
                                  (
                                      r,
                                  ): r is {
                                      awb_number: string;
                                      sender_name: string;
                                      receiver_name: string;
                                      receiver_phone: string;
                                      exception_reason: string;
                                      return_branch_name: string;
                                      issue_registered_time?: string;
                                  } =>
                                      r != null &&
                                      typeof r.awb_number === 'string' &&
                                      typeof r.sender_name === 'string' &&
                                      typeof r.receiver_name === 'string' &&
                                      typeof r.receiver_phone === 'string' &&
                                      typeof r.exception_reason === 'string' &&
                                      typeof r.return_branch_name === 'string',
                              )
                              .slice(0, 100)
                        : [],
                    codCollectionRate: json.codCollectionRate ?? 0,
                },
                previousMetrics: json.previous ?? null,
                recent: json.recent ?? [],
                charts,
                chartError,
                topSenders,
                topSendersCount,
                topProducts,
                customMetricDefinitions: json.custom_metric_definitions ?? [],
                customMetrics: json.custom_metrics ?? [],
                detailFields,
                availableDetailFields,
            };

            // Update cache
            cacheRef.current = successData;

            setAppliedRange({ from, to });
            setLastRefreshed(new Date());
            setState({ status: 'success', ...successData });
        } catch (e) {
            if (controller.signal.aborted) return;
            const message =
                e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
            setState({ status: 'error', message });
        }
    }, []);

    useEffect(() => {
        void load(initialDateRange.from, initialDateRange.to);
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [initialDateRange, load]);

    const handleApplyRange = useCallback((range?: { from: string; to: string }) => {
        const nextFrom = range?.from ?? parcelDateFrom;
        const nextTo = range?.to ?? parcelDateTo;
        // Clear cache when filter changes so loading state shows
        cacheRef.current = null;
        void load(nextFrom, nextTo);
    }, [load, parcelDateFrom, parcelDateTo]);

    const loading = state.status === 'loading' || state.status === 'idle';
    const err = state.status === 'error' ? state.message : null;
    const success = state.status === 'success';

    const emptyMetrics: JtDashboardMetrics = {
        totalParcels: 0,
        closedCount: 0,
        sumCod: 0,
        avgShippingFee: 0,
        returnCount: 0,
        jmsCount: 0,
        sumTotalFeeJms: 0,
        sumTotalShippingFee: 0,
        codPaidCount: 0,
        codPaidAmount: 0,
        codPendingCount: 0,
        codPendingAmount: 0,
        codNoCollectionCount: 0,
        exceptionCount: 0,
        topExceptionReasons: [],
        topExceptionCases: [],
        topReturnTypeCases: [],
        codCollectionRate: 0,
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
                let msg = 'บันทึกการ์ดสรุปข้อมูลไม่สำเร็จ';
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

    const saveDetailFields = useCallback(async (fields: string[]) => {
        const res = await fetch('/api/admin/jt-shipments/detail-fields-settings', {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ fields }),
        });
        const raw = await res.text();
        if (!res.ok) {
            let msg = 'บันทึกการตั้งค่าฟิลด์รายละเอียดพัสดุไม่สำเร็จ';
            try {
                const o = JSON.parse(raw) as { error?: string };
                if (o.error) msg = o.error;
            } catch {
                /* ignore */
            }
            throw new Error(msg);
        }
        await load(parcelDateFrom, parcelDateTo);
    }, [load, parcelDateFrom, parcelDateTo]);

    const acknowledgeReturn = useCallback(async (awbNumber: string, reason: string) => {
        const res = await fetch('/api/admin/jt-shipments/return-acknowledgements', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ awb_number: awbNumber, reason }),
        });
        const raw = await res.text();
        if (!res.ok) {
            let msg = 'บันทึกการรับทราบไม่สำเร็จ';
            try {
                const o = JSON.parse(raw) as { error?: string };
                if (o.error) msg = o.error;
            } catch {
                /* ignore */
            }
            throw new Error(msg);
        }
        await load(parcelDateFrom, parcelDateTo);
    }, [load, parcelDateFrom, parcelDateTo]);

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
            charts={success ? state.charts : null}
            chartError={success ? state.chartError : null}
            chartsAlignedWithSummaryCards={chartsAligned}
            topSenders={success ? state.topSenders : []}
            topSendersCount={success ? state.topSendersCount : []}
            topProducts={success ? state.topProducts : []}
            customMetricDefinitions={success ? state.customMetricDefinitions : []}
            customMetrics={success ? state.customMetrics : []}
            detailFields={success ? state.detailFields : DEFAULT_JT_SHIPMENT_DETAIL_FIELDS}
            availableDetailFields={success ? state.availableDetailFields : DEFAULT_JT_SHIPMENT_DETAIL_FIELDS}
            onSaveCustomMetricCards={saveCustomMetricCards}
            onSaveDetailFields={saveDetailFields}
            onAcknowledgeReturn={acknowledgeReturn}
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
