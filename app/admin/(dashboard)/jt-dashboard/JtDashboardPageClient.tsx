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

type StagnantCase = {
    awb_number: string;
    booking_date: string;
    sender_name: string;
    sender_phone: string;
    gateway_width: string;
    gateway_height: string;
    gateway_length: string;
    gateway_weight: string;
    gateway_vol_weight: string;
    latest_scan_time: string;
};

type StagnantHiddenCase = {
    awb_number: string;
    reason: string;
    acknowledged_at: string;
    acknowledged_by: string;
};

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
    // default 30 วัน — พัสดุตีกลับมัก booking มานานก่อนจะตีกลับ ช่วงแคบเกินจะทำให้หลุด
    return {
        from: toLocalYmd(addLocalDays(today, -29)),
        to: toLocalYmd(today),
    };
}

export function JtDashboardPageClient() {
    const [initialDateRange] = useState(() => getDefaultParcelDateRange());
    const [state, setState] = useState<FetchState>({ status: 'idle' });
    const [chartsLoading, setChartsLoading] = useState(true);
    const [codLoading, setCodLoading] = useState(true);
    const [showKpiPercentDelta, setShowKpiPercentDelta] = useState(false);
    const [stagnantLoading, setStagnantLoading] = useState(true);
    const [parcelDateFrom, setParcelDateFrom] = useState(initialDateRange.from);
    const [parcelDateTo, setParcelDateTo] = useState(initialDateRange.to);
    const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const cacheRef = useRef<SuccessData | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const load = useCallback(async (from: string, to: string) => {
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        // แสดง cache ทันที (SWR-style) หรือ skeleton ถ้าไม่มี cache
        if (cacheRef.current) {
            setState({ status: 'success', ...cacheRef.current });
        } else {
            setState({ status: 'loading' });
        }
        setChartsLoading(true);
        setCodLoading(true);
        setStagnantLoading(true);

        const params = new URLSearchParams();
        if (from.trim()) params.set('date_from', from.trim());
        if (to.trim()) params.set('date_to', to.trim());

        const statsParams = new URLSearchParams();
        if (from.trim()) statsParams.set('chart_from', from.trim());
        if (to.trim()) statsParams.set('chart_to', to.trim());

        const dashUrl = `/api/admin/jt-shipments/dashboard?${params.toString()}`;
        const statsUrl = `/api/admin/jt-shipments/stats?${statsParams.toString()}`;
        const codUrl = `/api/admin/jt-shipments/cod-summary?${params.toString()}`;

        // เริ่ม 4 requests พร้อมกัน — process เป็น 3 phase
        const dashFetch = fetch(dashUrl, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        const statsFetch = fetch(statsUrl, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        const detailFetch = fetch('/api/admin/jt-shipments/detail-fields-settings', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        const codFetch = fetch(codUrl, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        const stagnantFetch = fetch('/api/admin/jt-shipments/stagnant-parcels', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });

        // ── Phase A: Dashboard API + Detail Fields → แสดง KPI cards ทันที ──
        let res: Response;
        let detailFieldsRes: Response;
        try {
            [res, detailFieldsRes] = await Promise.all([dashFetch, detailFetch]);
        } catch (e) {
            if (controller.signal.aborted) return;
            const message = e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
            setState({ status: 'error', message });
            setChartsLoading(false);
            return;
        }

        if (controller.signal.aborted) return;

        // ── Phase A: Parse dashboard response → แสดง KPI cards ทันที ──
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
            returnHiddenCases?: Array<{
                awb_number: string;
                reason: string;
                acknowledged_at: string;
                acknowledged_by: string;
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
            const message = !res.ok
                ? `โหลดข้อมูลหลักไม่สำเร็จ (HTTP ${res.status}) เซิร์ฟเวอร์ตอบกลับมาไม่ใช่ JSON`
                : 'รูปแบบข้อมูลหลักไม่ถูกต้อง กรุณาตรวจสอบ /api/admin/jt-shipments/dashboard';
            setState({ status: 'error', message });
            setChartsLoading(false);
            return;
        }
        if (!res.ok) {
            setState({ status: 'error', message: json.error || 'โหลดข้อมูลหลักไม่สำเร็จ' });
            setChartsLoading(false);
            return;
        }

        let detailFields = [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
        let availableDetailFields = [...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS];
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
            /* keep defaults */
        }

        if (controller.signal.aborted) return;

        // KPI data พร้อม — แสดงการ์ดได้ทันที (charts/topSenders ยังว่าง รอ Phase B)
        const kpiData: SuccessData = {
            metrics: {
                totalParcels: json.count ?? 0,
                closedCount: json.closedCount ?? 0,
                avgShippingFee: json.avgShippingFee ?? 0,
                returnCount: json.returnCount ?? 0,
                jmsCount: json.jmsCount ?? 0,
                sumTotalFeeJms: json.sumTotalFeeJms ?? 0,
                sumTotalShippingFee: json.sumTotalShippingFee ?? 0,
                // COD fields — โหลดแยกจาก /cod-summary ใน Phase C (ใช้ cache ถ้ามี)
                codPaidCount: cacheRef.current?.metrics.codPaidCount ?? 0,
                codPaidAmount: cacheRef.current?.metrics.codPaidAmount ?? 0,
                codPendingCount: cacheRef.current?.metrics.codPendingCount ?? 0,
                codPendingAmount: cacheRef.current?.metrics.codPendingAmount ?? 0,
                codNoCollectionCount: cacheRef.current?.metrics.codNoCollectionCount ?? 0,
                codCollectionRate: cacheRef.current?.metrics.codCollectionRate ?? 0,
                sumCod: cacheRef.current?.metrics.sumCod ?? 0,
                exceptionCount: json.exceptionCount ?? 0,
                stagnantCount: cacheRef.current?.metrics.stagnantCount ?? 0,
                stagnantCases: cacheRef.current?.metrics.stagnantCases ?? [],
                stagnantHiddenCases: cacheRef.current?.metrics.stagnantHiddenCases ?? [],
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
                              (r): r is {
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
                              (r): r is {
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
                returnHiddenCases: Array.isArray(json.returnHiddenCases)
                    ? json.returnHiddenCases.filter(
                          (r): r is {
                              awb_number: string;
                              reason: string;
                              acknowledged_at: string;
                              acknowledged_by: string;
                          } =>
                              r != null &&
                              typeof r.awb_number === 'string' &&
                              typeof r.reason === 'string',
                      )
                    : [],
            },
            previousMetrics: json.previous ?? null,
            recent: json.recent ?? [],
            // charts ยังว่าง — จะ update ใน Phase B
            charts: cacheRef.current?.charts ?? null,
            chartError: cacheRef.current?.chartError ?? null,
            topSenders: cacheRef.current?.topSenders ?? [],
            topSendersCount: cacheRef.current?.topSendersCount ?? [],
            topProducts: cacheRef.current?.topProducts ?? [],
            customMetricDefinitions: json.custom_metric_definitions ?? [],
            customMetrics: json.custom_metrics ?? [],
            detailFields,
            availableDetailFields,
        };

        setAppliedRange({ from, to });
        setLastRefreshed(new Date());
        setState({ status: 'success', ...kpiData });

        // ── Phase B: Parse stats response → แสดงกราฟ + Top Senders ──
        let charts: JtDashboardChartsPayload | null = null;
        let chartError: string | null = null;
        let topSenders: JtTopSenderRow[] = [];
        let topSendersCount: JtTopSenderCountRow[] = [];
        let topProducts: JtTopProductRow[] = [];
        try {
            const statsRes = await statsFetch;
            if (controller.signal.aborted) return;

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
                statsJson = {};
            }
            if (!statsRes.ok) {
                chartError = statsJson.error || 'โหลดสถิติรายวันไม่สำเร็จ';
            } else {
                const cw = statsJson.chartWindow;
                const d30 = statsJson.daily30 ?? [];
                charts = {
                    daily30: d30,
                    dailyFee30: statsJson.dailyFee30 ?? [],
                    dailyCod30: statsJson.dailyCod30 ?? d30.map((d) => ({ date: d.date, codTotal: 0 })),
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
            if (controller.signal.aborted) return;
            if (chartError == null) {
                chartError = e instanceof Error ? e.message : 'โหลดกราฟไม่สำเร็จ';
            }
        }

        if (controller.signal.aborted) return;

        const fullData: SuccessData = { ...kpiData, charts, chartError, topSenders, topSendersCount, topProducts };
        cacheRef.current = fullData;
        setState({ status: 'success', ...fullData });
        setChartsLoading(false);

        // ── Phase C: COD Summary → โหลดการ์ด COD จาก dedicated endpoint ──
        try {
            const codRes = await codFetch;
            if (controller.signal.aborted) return;

            const codRaw = await codRes.text();
            let codJson: {
                error?: string;
                sumCod?: number;
                paidCount?: number;
                paidAmount?: number;
                pendingCount?: number;
                pendingAmount?: number;
                noCollectionCount?: number;
                paymentRate?: number;
            };
            try {
                codJson = JSON.parse(codRaw) as typeof codJson;
            } catch {
                codJson = {};
            }

            if (codRes.ok) {
                const latest = cacheRef.current ?? fullData;
                const withCod: SuccessData = {
                    ...latest,
                    metrics: {
                        ...latest.metrics,
                        sumCod: codJson.sumCod ?? 0,
                        codPaidCount: codJson.paidCount ?? 0,
                        codPaidAmount: codJson.paidAmount ?? 0,
                        codPendingCount: codJson.pendingCount ?? 0,
                        codPendingAmount: codJson.pendingAmount ?? 0,
                        codNoCollectionCount: codJson.noCollectionCount ?? 0,
                        codCollectionRate: codJson.paymentRate ?? 0,
                    },
                };
                cacheRef.current = withCod;
                setState({ status: 'success', ...withCod });
            }
        } catch (e) {
            if (controller.signal.aborted) return;
            console.warn('[dashboard] cod-summary fetch error:', e instanceof Error ? e.message : e);
        }

        setCodLoading(false);

        // ── Phase D: Stagnant Parcels → โหลดพัสดุตกค้างไม่เคลื่อนไหว (global, ไม่ผูกกับ date range) ──
        try {
            const stagnantRes = await stagnantFetch;
            if (controller.signal.aborted) return;

            const stagnantRaw = await stagnantRes.text();
            let stagnantJson: {
                error?: string;
                total?: number;
                cases?: StagnantCase[];
                hidden?: StagnantHiddenCase[];
            };
            try {
                stagnantJson = JSON.parse(stagnantRaw) as typeof stagnantJson;
            } catch {
                stagnantJson = {};
            }

            if (stagnantRes.ok) {
                const latest = cacheRef.current ?? fullData;
                const isValidCase = (r: unknown): r is StagnantCase =>
                    r != null &&
                    typeof (r as StagnantCase).awb_number === 'string' &&
                    typeof (r as StagnantCase).booking_date === 'string' &&
                    typeof (r as StagnantCase).sender_name === 'string' &&
                    typeof (r as StagnantCase).sender_phone === 'string';
                const isValidHidden = (r: unknown): r is StagnantHiddenCase =>
                    r != null &&
                    typeof (r as StagnantHiddenCase).awb_number === 'string' &&
                    typeof (r as StagnantHiddenCase).reason === 'string';
                const withStagnant = {
                    ...latest,
                    metrics: {
                        ...latest.metrics,
                        stagnantCount: stagnantJson.total ?? 0,
                        stagnantCases: Array.isArray(stagnantJson.cases)
                            ? stagnantJson.cases.filter(isValidCase)
                            : [],
                        stagnantHiddenCases: Array.isArray(stagnantJson.hidden)
                            ? stagnantJson.hidden.filter(isValidHidden)
                            : [],
                    },
                };
                cacheRef.current = withStagnant;
                setState({ status: 'success', ...withStagnant });
            }
        } catch (e) {
            if (controller.signal.aborted) return;
            console.warn('[dashboard] stagnant-parcels fetch error:', e instanceof Error ? e.message : e);
        }

        setStagnantLoading(false);
    }, []);

    useEffect(() => {
        load(initialDateRange.from, initialDateRange.to).catch((e: unknown) => {
            if (e instanceof Error && e.name === 'AbortError') return;
            console.error('[jt-dashboard] unhandled load error:', e);
        });
        return () => {
            abortRef.current?.abort();
        };
    }, [initialDateRange, load]);

    const handleApplyRange = useCallback(
        (range?: { from: string; to: string }) => {
            const nextFrom = range?.from ?? parcelDateFrom;
            const nextTo = range?.to ?? parcelDateTo;
            cacheRef.current = null;
            void load(nextFrom, nextTo);
        },
        [load, parcelDateFrom, parcelDateTo],
    );

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
        stagnantCount: 0,
        stagnantCases: [],
        stagnantHiddenCases: [],
        topExceptionReasons: [],
        topExceptionCases: [],
        topReturnTypeCases: [],
        returnHiddenCases: [],
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

    const saveDetailFields = useCallback(
        async (fields: string[]) => {
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
        },
        [load, parcelDateFrom, parcelDateTo],
    );

    const acknowledgeReturn = useCallback(
        async (awbNumber: string, reason: string, muteAging: boolean) => {
            const res = await fetch('/api/admin/jt-shipments/return-acknowledgements', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ awb_number: awbNumber, reason, mute_aging: muteAging }),
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
        },
        [load, parcelDateFrom, parcelDateTo],
    );

    const restoreReturn = useCallback(
        async (awbNumber: string) => {
            const res = await fetch('/api/admin/jt-shipments/parcel-acknowledgements', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ awb_number: awbNumber, kind: 'return', action: 'restore' }),
            });
            const raw = await res.text();
            if (!res.ok) {
                let msg = 'ดึงกลับไม่สำเร็จ';
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

    const acknowledgeStagnant = useCallback(
        async (awbNumber: string, reason: string) => {
            const res = await fetch('/api/admin/jt-shipments/parcel-acknowledgements', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ awb_number: awbNumber, kind: 'stagnant', reason, action: 'hide' }),
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
        },
        [load, parcelDateFrom, parcelDateTo],
    );

    const restoreStagnant = useCallback(
        async (awbNumber: string) => {
            const res = await fetch('/api/admin/jt-shipments/parcel-acknowledgements', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ awb_number: awbNumber, kind: 'stagnant', action: 'restore' }),
            });
            const raw = await res.text();
            if (!res.ok) {
                let msg = 'ดึงกลับไม่สำเร็จ';
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
            onReturnExclusionSaved={() => void load(parcelDateFrom, parcelDateTo)}
            onAcknowledgeReturn={acknowledgeReturn}
            onRestoreReturn={restoreReturn}
            onAcknowledgeStagnant={acknowledgeStagnant}
            onRestoreStagnant={restoreStagnant}
            showKpiPercentDelta={showKpiPercentDelta}
            onToggleKpiPercentDelta={() => setShowKpiPercentDelta((prev) => !prev)}
            loading={loading}
            chartsLoading={chartsLoading}
            codLoading={codLoading}
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
            stagnantLoading={stagnantLoading}
        />
    );
}
