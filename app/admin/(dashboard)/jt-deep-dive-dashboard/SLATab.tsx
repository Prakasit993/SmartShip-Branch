'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CalendarDays, ChevronDown, Clock3, Eye, EyeOff, MapPin, PackageCheck, RefreshCw, Scale } from 'lucide-react';
import {
    toYmd as toLocalYmd,
    addDays as addLocalDays,
    addCalendarMonths as addLocalMonths,
    parseLocalYmd,
    monthStartFromYmd,
    monthKey,
    formatCalendarMonth,
    formatThaiDateRange,
    pct,
} from '@/lib/jtDashboardDateUtils';

/** SLA tab shows THB with no decimals (whole baht). */
function formatThb(value: number): string {
    return value.toLocaleString('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 0,
    });
}

/** SLA tab shows plain count without unit suffix. */
function formatCount(value: number): string {
    return value.toLocaleString('th-TH');
}

type SlaDashboardSummary = {
    count: number;
    closedCount: number;
    sumCod: number;
    returnCount: number;
    codPaidCount: number;
    codPaidAmount: number;
    codPendingCount: number;
    codPendingAmount: number;
    exceptionCount: number;
    codCollectionRate: number;
    topCodPendingCases: SlaCodPendingCaseRow[];
    topExceptionReasons: Array<{ reason: string; count: number }>;
    topExceptionCases: SlaCaseRow[];
    topReturnTypeCases: SlaReturnCaseRow[];
    date_from: string | null;
    date_to: string | null;
    _source?: string;
};

type SlaCaseRow = {
    awb_number: string;
    sender_name: string;
    receiver_name: string;
    receiver_phone: string;
    exception_reason: string;
    issue_registered_time?: string;
};

type SlaReturnCaseRow = SlaCaseRow & {
    return_branch_name: string;
};

type SlaCodPendingCaseRow = {
    awb_number: string;
    receiver_name: string;
    receiver_phone: string;
    cod_amount: number;
    cod_status: string;
};

type SlaCardCase = {
    awb: string;
    tier: 'Critical' | 'High';
    kind: string;
    detail: string;
    receiver: string;
};

type SlaRecommendation = {
    status: 'follow' | 'close';
    title: string;
    detail: string;
};

type SlaMetricKey = 'closed' | 'critical' | 'high';

type CalendarDayStats = {
    date: string;
    total: number;
    codPending: number;
    exceptions: number;
    returns: number;
};

type SlaSummaryState =
    | { status: 'loading'; data: SlaDashboardSummary | null; error: null }
    | { status: 'success'; data: SlaDashboardSummary; error: null }
    | { status: 'error'; data: SlaDashboardSummary | null; error: string };

function getDefaultSlaRange(): { from: string; to: string } {
    const today = new Date();
    return {
        from: toLocalYmd(addLocalDays(today, -6)),
        to: toLocalYmd(today),
    };
}

function normaliseSummary(json: Partial<SlaDashboardSummary>, range: { from: string; to: string }): SlaDashboardSummary {
    return {
        count: Number(json.count) || 0,
        closedCount: Number(json.closedCount) || 0,
        sumCod: Number(json.sumCod) || 0,
        returnCount: Number(json.returnCount) || 0,
        codPaidCount: Number(json.codPaidCount) || 0,
        codPaidAmount: Number(json.codPaidAmount) || 0,
        codPendingCount: Number(json.codPendingCount) || 0,
        codPendingAmount: Number(json.codPendingAmount) || 0,
        exceptionCount: Number(json.exceptionCount) || 0,
        codCollectionRate: Number(json.codCollectionRate) || 0,
        topCodPendingCases: Array.isArray(json.topCodPendingCases) ? json.topCodPendingCases : [],
        topExceptionReasons: Array.isArray(json.topExceptionReasons) ? json.topExceptionReasons : [],
        topExceptionCases: Array.isArray(json.topExceptionCases) ? json.topExceptionCases : [],
        topReturnTypeCases: Array.isArray(json.topReturnTypeCases) ? json.topReturnTypeCases : [],
        date_from: typeof json.date_from === 'string' ? json.date_from : range.from,
        date_to: typeof json.date_to === 'string' ? json.date_to : range.to,
        _source: typeof json._source === 'string' ? json._source : undefined,
    };
}

function mapCodPendingCases(data: SlaDashboardSummary): SlaCardCase[] {
    return data.topCodPendingCases
        .map((row) => ({
            awb: String(row.awb_number || '').trim(),
            tier: 'Critical' as const,
            kind: 'COD ยังไม่เข้า',
            detail: `${formatThb(Number(row.cod_amount) || 0)} · ${row.cod_status || 'รอสถานะ COD'}`,
            receiver: row.receiver_name || '-',
        }))
        .filter((row) => row.awb && row.awb !== '-');
}

function mapExceptionCases(data: SlaDashboardSummary): SlaCardCase[] {
    return data.topExceptionCases
        .map((row) => ({
            awb: String(row.awb_number || '').trim(),
            tier: 'Critical' as const,
            kind: 'พัสดุมีปัญหา',
            detail: row.exception_reason || 'ไม่มีรายละเอียดสาเหตุ',
            receiver: row.receiver_name || '-',
        }))
        .filter((row) => row.awb && row.awb !== '-');
}

function mapReturnCases(data: SlaDashboardSummary): SlaCardCase[] {
    return data.topReturnTypeCases
        .map((row) => ({
            awb: String(row.awb_number || '').trim(),
            tier: 'High' as const,
            kind: 'พัสดุตีกลับ',
            detail: row.return_branch_name || row.exception_reason || 'ไม่มีรายละเอียดสาขาตีกลับ',
            receiver: row.receiver_name || '-',
        }))
        .filter((row) => row.awb && row.awb !== '-');
}

function dedupeCases(rows: SlaCardCase[]): SlaCardCase[] {
    const seen = new Set<string>();
    const out: SlaCardCase[] = [];

    for (const row of rows) {
        const awb = String(row.awb || '').trim();
        if (!awb || awb === '-' || seen.has(awb)) continue;
        seen.add(awb);
        out.push(row);
    }

    return out;
}

function buildRecommendations(data: SlaDashboardSummary): SlaRecommendation[] {
    const recommendations: SlaRecommendation[] = [];

    if (data.codPendingCount > 0) {
        recommendations.push({
            status: 'follow',
            title: 'ต้องตามต่อ: COD ยังไม่เข้า',
            detail: `${formatCount(data.codPendingCount)} เคส รวม ${formatThb(data.codPendingAmount)} ควรเช็คสถานะ COD หรือยอดโอน`,
        });
    } else {
        recommendations.push({
            status: 'close',
            title: 'ปิดจบได้: COD',
            detail: 'ไม่พบ COD pending ในช่วงวันที่นี้',
        });
    }

    if (data.exceptionCount > 0) {
        const topReason = data.topExceptionReasons[0]?.reason;
        recommendations.push({
            status: 'follow',
            title: 'ต้องตามต่อ: พัสดุมีปัญหา',
            detail: topReason
                ? `${formatCount(data.exceptionCount)} เคส สาเหตุหลักคือ ${topReason}`
                : `${formatCount(data.exceptionCount)} เคส ควรเปิดดูเลข AWB ในการ์ด`,
        });
    } else {
        recommendations.push({
            status: 'close',
            title: 'ปิดจบได้: พัสดุมีปัญหา',
            detail: 'ไม่พบ exception ที่ยังต้องตามในช่วงวันที่นี้',
        });
    }

    if (data.returnCount > 0) {
        recommendations.push({
            status: 'follow',
            title: 'ต้องตามต่อ: พัสดุตีกลับ',
            detail: `${formatCount(data.returnCount)} เคส ควรเช็คว่าส่งใหม่ คืนเงิน หรือรับทราบแล้ว`,
        });
    } else {
        recommendations.push({
            status: 'close',
            title: 'ปิดจบได้: พัสดุตีกลับ',
            detail: 'ไม่พบรายการตีกลับที่ยังต้องดำเนินการในช่วงวันที่นี้',
        });
    }

    return recommendations;
}

export function SLATab() {
    const [initialRange] = useState(() => getDefaultSlaRange());
    const [dateFrom, setDateFrom] = useState(initialRange.from);
    const [dateTo, setDateTo] = useState(initialRange.to);
    const [appliedRange, setAppliedRange] = useState(initialRange);
    const [activeDatePicker, setActiveDatePicker] = useState<'from' | 'to' | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(() => monthStartFromYmd(initialRange.to));
    const [calendarStats, setCalendarStats] = useState<Record<string, CalendarDayStats>>({});
    const [calendarStatsError, setCalendarStatsError] = useState<string | null>(null);
    const [selectedMetric, setSelectedMetric] = useState<SlaMetricKey>('critical');
    const [expandedRiskCard, setExpandedRiskCard] = useState<string | null>(null);
    const [state, setState] = useState<SlaSummaryState>({
        status: 'loading',
        data: null,
        error: null,
    });

    const loadSummary = useCallback(async (range: { from: string; to: string }, signal?: AbortSignal) => {
        setState((prev) => ({ status: 'loading', data: prev.data, error: null }));

        const params = new URLSearchParams();
        params.set('date_from', range.from);
        params.set('date_to', range.to);

        const res = await fetch(`/api/admin/jt-shipments/dashboard?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal,
        });
        const json = (await res.json()) as Partial<SlaDashboardSummary> & { error?: string };
        if (!res.ok) {
            throw new Error(json.error || 'โหลดข้อมูล SLA ไม่สำเร็จ');
        }

        setState({ status: 'success', data: normaliseSummary(json, range), error: null });
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        loadSummary(appliedRange, controller.signal).catch((e: unknown) => {
            if ((e as { name?: string }).name === 'AbortError') return;
            setState((prev) => ({
                status: 'error',
                data: prev.data,
                error: e instanceof Error ? e.message : 'โหลดข้อมูล SLA ไม่สำเร็จ',
            }));
        });
        return () => controller.abort();
    }, [appliedRange, loadSummary]);

    // Debounced calendar month: delays fetch by 300ms so rapid month
    // navigation doesn't spam the backend.
    const [debouncedCalendarMonth, setDebouncedCalendarMonth] = useState(calendarMonth);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedCalendarMonth(calendarMonth), 300);
        return () => clearTimeout(timer);
    }, [calendarMonth]);

    useEffect(() => {
        if (!activeDatePicker) return;
        const controller = new AbortController();
        const month = monthKey(debouncedCalendarMonth);

        fetch(`/api/admin/jt-shipments/sla-calendar?month=${encodeURIComponent(month)}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then(async (res) => {
                const json = (await res.json()) as {
                    error?: string;
                    days?: CalendarDayStats[];
                };
                if (!res.ok) throw new Error(json.error || 'โหลดสถิติรายวันไม่สำเร็จ');
                const next: Record<string, CalendarDayStats> = {};
                for (const day of json.days ?? []) {
                    next[day.date] = day;
                }
                setCalendarStats(next);
                setCalendarStatsError(null);
            })
            .catch((e: unknown) => {
                if ((e as { name?: string }).name === 'AbortError') return;
                setCalendarStats({});
                setCalendarStatsError(e instanceof Error ? e.message : 'โหลดสถิติรายวันไม่สำเร็จ');
            });

        return () => controller.abort();
    }, [activeDatePicker, debouncedCalendarMonth]);

    const data = state.data;
    const isLoading = state.status === 'loading';
    const canApplyRange = dateFrom.trim() !== '' && dateTo.trim() !== '' && dateFrom <= dateTo;
    const isSingleDay = appliedRange.from === appliedRange.to;
    const appliedRangeLabel = formatThaiDateRange(appliedRange);

    const criticalCount = (data?.codPendingCount ?? 0) + (data?.exceptionCount ?? 0);
    const highCount = data?.returnCount ?? 0;
    const closedRate = data ? pct(data.closedCount, data.count) : '0%';
    const paidRate = data ? `${data.codCollectionRate.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%` : '0%';
    const recommendations = useMemo(() => (data ? buildRecommendations(data) : []), [data]);
    const riskRows = useMemo(() => {
        if (!data) return [];

        return [
            {
                tier: 'Critical',
                title: 'COD ยังไม่เข้า',
                value: `${formatCount(data.codPendingCount)} เคส`,
                detail: `${formatThb(data.codPendingAmount)} ที่ควรติดตามสถานะเก็บเงิน`,
                tone: 'red',
                cases: dedupeCases(mapCodPendingCases(data)),
            },
            {
                tier: 'Critical',
                title: 'พัสดุมีปัญหา',
                value: `${formatCount(data.exceptionCount)} เคส`,
                detail: data.topExceptionReasons[0]
                    ? `สาเหตุหลัก: ${data.topExceptionReasons[0].reason} (${formatCount(data.topExceptionReasons[0].count)} เคส)`
                    : 'ยังไม่มีสาเหตุหลักในช่วงนี้',
                tone: 'orange',
                cases: dedupeCases(mapExceptionCases(data)),
            },
            {
                tier: 'High',
                title: 'พัสดุตีกลับ',
                value: `${formatCount(data.returnCount)} เคส`,
                detail: data.topReturnTypeCases[0]
                    ? `เคสล่าสุด: ${data.topReturnTypeCases[0].awb_number} · ${data.topReturnTypeCases[0].return_branch_name}`
                    : 'ยังไม่มีรายการตีกลับที่ต้องแสดง',
                tone: 'amber',
                cases: dedupeCases(mapReturnCases(data)),
            },
        ];
    }, [data]);
    const selectedRecommendation = useMemo(() => {
        if (selectedMetric === 'closed') {
            return {
                status: 'close' as const,
                title: 'สรุปงานที่ส่งสำเร็จ',
                detail: data
                    ? `ปิดงานแล้ว ${formatCount(data.closedCount)} จาก ${formatCount(data.count)} ชิ้น คิดเป็น ${closedRate}`
                    : 'รอโหลดข้อมูลส่งสำเร็จ',
            };
        }

        if (selectedMetric === 'critical') {
            return recommendations.find((item) => item.title.includes('COD')) ?? recommendations[0] ?? null;
        }

        return recommendations.find((item) => item.title.includes('ตีกลับ')) ?? recommendations[2] ?? null;
    }, [closedRate, data, recommendations, selectedMetric]);
    const selectedRiskRows = useMemo(() => {
        if (selectedMetric === 'critical') {
            return riskRows.filter((row) => row.tier === 'Critical');
        }
        if (selectedMetric === 'high') {
            return riskRows.filter((row) => row.tier === 'High');
        }
        return [];
    }, [riskRows, selectedMetric]);

    const applyRange = () => {
        if (!canApplyRange) return;
        setExpandedRiskCard(null);
        setAppliedRange({ from: dateFrom, to: dateTo });
    };

    const applySingleDay = (date: string) => {
        setDateFrom(date);
        setDateTo(date);
        setExpandedRiskCard(null);
        setAppliedRange({ from: date, to: date });
    };

    const openDatePicker = (target: 'from' | 'to') => {
        setActiveDatePicker(target);
        setCalendarMonth(monthStartFromYmd(target === 'from' ? dateFrom : dateTo));
    };

    const selectCalendarDate = (date: string) => {
        if (activeDatePicker === 'from') {
            setDateFrom(date);
            if (date > dateTo) setDateTo(date);
        } else if (activeDatePicker === 'to') {
            setDateTo(date);
            if (date < dateFrom) setDateFrom(date);
        }

        setActiveDatePicker(null);

        // Selecting the same start/end day is the fastest path to inspect that day's cases.
        const nextFrom = activeDatePicker === 'from' ? date : dateFrom;
        const nextTo = activeDatePicker === 'to' ? date : dateTo;
        if (nextFrom === nextTo) {
            applySingleDay(date);
        }
    };

    const applyToday = () => {
        applySingleDay(toLocalYmd(new Date()));
    };

    const applyYesterday = () => {
        applySingleDay(toLocalYmd(addLocalDays(new Date(), -1)));
    };

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="basis-full">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    เช็คเคสตามวันที่
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                    เลือกวันเดียวเพื่อโชว์เคสของวันนั้น หรือเลือกช่วงวันที่เพื่อเช็คย้อนหลัง
                                </p>
                            </div>
                            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200">
                                {isSingleDay ? 'รายวัน' : 'ช่วงวันที่'} · {appliedRangeLabel}
                            </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={applyToday}
                                disabled={isLoading}
                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                ดูวันนี้
                            </button>
                            <button
                                type="button"
                                onClick={applyYesterday}
                                disabled={isLoading}
                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                ดูเมื่อวาน
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setDateFrom(initialRange.from);
                                    setDateTo(initialRange.to);
                                    setExpandedRiskCard(null);
                                    setAppliedRange(initialRange);
                                }}
                                disabled={isLoading}
                                className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                7 วันล่าสุด
                            </button>
                        </div>
                    </div>
                    <CustomDatePicker
                        label="วันที่เริ่มต้น"
                        value={dateFrom}
                        selectedFrom={dateFrom}
                        selectedTo={dateTo}
                        open={activeDatePicker === 'from'}
                        month={calendarMonth}
                        dayStats={calendarStats}
                        dayStatsError={calendarStatsError}
                        onOpen={() => openDatePicker('from')}
                        onClose={() => setActiveDatePicker(null)}
                        onMonthChange={setCalendarMonth}
                        onSelect={selectCalendarDate}
                    />
                    <CustomDatePicker
                        label="วันที่สิ้นสุด"
                        value={dateTo}
                        selectedFrom={dateFrom}
                        selectedTo={dateTo}
                        open={activeDatePicker === 'to'}
                        month={calendarMonth}
                        dayStats={calendarStats}
                        dayStatsError={calendarStatsError}
                        onOpen={() => openDatePicker('to')}
                        onClose={() => setActiveDatePicker(null)}
                        onMonthChange={setCalendarMonth}
                        onSelect={selectCalendarDate}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            if (dateFrom === dateTo) {
                                applySingleDay(dateFrom);
                                return;
                            }
                            applyRange();
                        }}
                        disabled={!canApplyRange || isLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                        {isLoading ? 'กำลังโหลด...' : dateFrom === dateTo ? 'ดูเคสวันนี้' : 'ดูช่วงนี้'}
                    </button>
                    {!canApplyRange ? (
                        <p className="text-xs text-red-300">กรุณาเลือกวันที่ให้ถูกต้อง</p>
                    ) : null}
                </div>
            </section>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <SlaMetricCard
                    label="ส่งสำเร็จ"
                    value={data ? `${formatCount(data.closedCount)} / ${formatCount(data.count)}` : isLoading ? 'กำลังโหลด' : '-'}
                    hint={`อัตราปิดงาน ${closedRate} ในช่วงที่เลือก`}
                    icon={<PackageCheck className="h-5 w-5" aria-hidden />}
                    tone="green"
                    active={selectedMetric === 'closed'}
                    onClick={() => setSelectedMetric('closed')}
                />
                <SlaMetricCard
                    label="Critical"
                    value={data ? `${formatCount(criticalCount)} เคส` : isLoading ? 'กำลังโหลด' : '-'}
                    hint="COD pending + พัสดุมีปัญหาที่ยังต้องตาม"
                    icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
                    tone="red"
                    active={selectedMetric === 'critical'}
                    onClick={() => setSelectedMetric('critical')}
                />
                <SlaMetricCard
                    label="High"
                    value={data ? `${formatCount(highCount)} เคส` : isLoading ? 'กำลังโหลด' : '-'}
                    hint={`พัสดุตีกลับ · COD paid rate ${paidRate}`}
                    icon={<Clock3 className="h-5 w-5" aria-hidden />}
                    tone="amber"
                    active={selectedMetric === 'high'}
                    onClick={() => setSelectedMetric('high')}
                />
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                        {selectedMetric === 'closed'
                            ? 'ข้อมูลจากการ์ดส่งสำเร็จ'
                            : selectedMetric === 'critical'
                                ? 'ข้อมูลจากการ์ด Critical'
                                : 'ข้อมูลจากการ์ด High'}
                    </p>
                    <button
                        type="button"
                        onClick={() => loadSummary(appliedRange).catch((e: unknown) => {
                            setState((prev) => ({
                                status: 'error',
                                data: prev.data,
                                error: e instanceof Error ? e.message : 'โหลดข้อมูล SLA ไม่สำเร็จ',
                            }));
                        })}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
                        รีเฟรช
                    </button>
                </div>

                {state.status === 'error' ? (
                    <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
                        {state.error}
                    </div>
                ) : null}

                <div className="mt-4 space-y-3">
                    {selectedRecommendation ? <RecommendationItem item={selectedRecommendation} /> : null}

                    {selectedMetric === 'closed' ? (
                        <ClosedMetricDetail
                            count={data?.count ?? 0}
                            closedCount={data?.closedCount ?? 0}
                            closedRate={closedRate}
                            rangeLabel={appliedRangeLabel}
                        />
                    ) : (
                        <div className="space-y-2">
                            {selectedRiskRows.map((row) => (
                                <RiskRow
                                    key={row.title}
                                    {...row}
                                    expanded={expandedRiskCard === row.title}
                                    onToggle={() => setExpandedRiskCard((current) => current === row.title ? null : row.title)}
                                />
                            ))}
                        </div>
                    )}

                    {!data && isLoading ? (
                        <div className="space-y-2">
                            {[0, 1].map((i) => (
                                <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-2">
                                            <div className="h-4 w-28 animate-pulse rounded bg-slate-800" />
                                            <div className="h-3 w-48 animate-pulse rounded bg-slate-800/60" />
                                        </div>
                                        <div className="h-5 w-16 animate-pulse rounded-full bg-slate-800" />
                                    </div>
                                    <div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-slate-900/60" />
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </section>

            <CostAreaInspectionSection range={appliedRange} />
        </div>
    );
}

function ClosedMetricDetail({
    count,
    closedCount,
    closedRate,
    rangeLabel,
}: {
    count: number;
    closedCount: number;
    closedRate: string;
    rangeLabel: string;
}) {
    const pendingCount = Math.max(0, count - closedCount);

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                    <p className="text-[11px] text-slate-500">ช่วงที่ดู</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">{rangeLabel}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                    <p className="text-[11px] text-emerald-300">ปิดงานแล้ว</p>
                    <p className="mt-1 text-sm font-bold text-white">{formatCount(closedCount)} ชิ้น</p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
                    <p className="text-[11px] text-slate-500">ยังไม่ปิดงาน</p>
                    <p className="mt-1 text-sm font-bold text-slate-100">{formatCount(pendingCount)} ชิ้น</p>
                </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
                อัตราปิดงาน {closedRate} ใช้ดูภาพรวมการส่งสำเร็จ ส่วนเคสที่ต้องตามต่อให้กดการ์ด Critical หรือ High
            </p>
        </div>
    );
}

function RecommendationItem({ item }: { item: SlaRecommendation }) {
    const isFollow = item.status === 'follow';

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
                <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        isFollow
                            ? 'border-red-500/30 bg-red-500/10 text-red-300'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    }`}
                >
                    {isFollow ? 'ต้องตามต่อ' : 'ปิดจบได้'}
                </span>
                <p className="text-xs font-semibold text-slate-200">{item.title}</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.detail}</p>
        </div>
    );
}

function CustomDatePicker({
    label,
    value,
    selectedFrom,
    selectedTo,
    open,
    month,
    dayStats,
    dayStatsError,
    onOpen,
    onClose,
    onMonthChange,
    onSelect,
}: {
    label: string;
    value: string;
    selectedFrom: string;
    selectedTo: string;
    open: boolean;
    month: Date;
    dayStats: Record<string, CalendarDayStats>;
    dayStatsError: string | null;
    onOpen: () => void;
    onClose: () => void;
    onMonthChange: (date: Date) => void;
    onSelect: (date: string) => void;
}) {
    return (
        <div className="relative space-y-1 text-xs font-medium text-slate-400">
            {label}
            <button
                type="button"
                onClick={open ? onClose : onOpen}
                className="flex min-w-40 items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm font-semibold text-slate-100 outline-none ring-sky-500/20 transition hover:border-slate-600 focus:border-sky-500 focus:ring-2"
            >
                <span>{value}</span>
                <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden />
            </button>
            {open ? (
                <CalendarPopover
                    month={month}
                    selectedFrom={selectedFrom}
                    selectedTo={selectedTo}
                    dayStats={dayStats}
                    dayStatsError={dayStatsError}
                    onMonthChange={onMonthChange}
                    onSelect={onSelect}
                    onClose={onClose}
                />
            ) : null}
        </div>
    );
}

function CalendarPopover({
    month,
    selectedFrom,
    selectedTo,
    dayStats,
    dayStatsError,
    onMonthChange,
    onSelect,
    onClose,
}: {
    month: Date;
    selectedFrom: string;
    selectedTo: string;
    dayStats: Record<string, CalendarDayStats>;
    dayStatsError: string | null;
    onMonthChange: (date: Date) => void;
    onSelect: (date: string) => void;
    onClose: () => void;
}) {
    const popoverRef = useRef<HTMLDivElement>(null);
    const today = toLocalYmd(new Date());
    const monthIndex = month.getMonth();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstGridDay = addLocalDays(firstDay, -firstDay.getDay());
    const days = Array.from({ length: 42 }, (_, i) => addLocalDays(firstGridDay, i));

    // Close popover when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div ref={popoverRef} className="absolute left-0 top-full z-30 mt-2 w-80 rounded-2xl border border-slate-700 bg-slate-950 p-3 text-slate-200 shadow-2xl shadow-black/40 ring-1 ring-white/[0.04]">
            <div className="flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => onMonthChange(addLocalMonths(month, -1))}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
                    aria-label="เดือนก่อนหน้า"
                >
                    ←
                </button>
                <div className="text-center">
                    <p className="text-sm font-bold text-white">{formatCalendarMonth(month)}</p>
                    <p className="text-[11px] text-slate-500">คลิกวันที่เพื่อเลือกและดูเคสของวันนั้นได้ทันที</p>
                </div>
                <button
                    type="button"
                    onClick={() => onMonthChange(addLocalMonths(month, 1))}
                    className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-300 transition hover:border-slate-700 hover:text-white"
                    aria-label="เดือนถัดไป"
                >
                    →
                </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day) => (
                    <div key={day} className="py-1">
                        {day}
                    </div>
                ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
                {days.map((day) => {
                    const ymd = toLocalYmd(day);
                    const outside = day.getMonth() !== monthIndex;
                    const isStart = ymd === selectedFrom;
                    const isEnd = ymd === selectedTo;
                    const inRange = selectedFrom <= ymd && ymd <= selectedTo;
                    const isToday = ymd === today;
                    const selected = isStart || isEnd;
                    const stats = dayStats[ymd];
                    const hasCritical = stats && (stats.codPending > 0 || stats.exceptions > 0);
                    const hasReturnOnly = stats && !hasCritical && stats.returns > 0;

                    return (
                        <button
                            key={ymd}
                            type="button"
                            onClick={() => onSelect(ymd)}
                            title={stats ? `เคสมีปัญหา ${stats.total} รายการ` : undefined}
                            className={`relative h-12 rounded-lg pb-4 pt-1 text-sm font-semibold transition ${
                                selected
                                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/30'
                                    : inRange
                                        ? 'bg-sky-500/10 text-sky-200'
                                        : outside
                                            ? 'text-slate-700 hover:bg-slate-900 hover:text-slate-500'
                                            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                            } ${isToday && !selected ? 'ring-1 ring-sky-500/35' : ''}`}
                        >
                            <span>{day.getDate()}</span>
                            {stats ? (
                                <span
                                    className={`absolute bottom-1 left-1/2 min-w-5 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                        hasCritical
                                            ? 'bg-red-500 text-white'
                                            : hasReturnOnly
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-slate-700 text-slate-200'
                                    }`}
                                >
                                    {stats.total}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {dayStatsError ? (
                <p className="mt-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {dayStatsError}
                </p>
            ) : (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        COD/ปัญหา
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                        ตีกลับ
                    </span>
                </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-3">
                <button
                    type="button"
                    onClick={() => onSelect(today)}
                    className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                >
                    วันนี้
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                >
                    ปิด
                </button>
            </div>
        </div>
    );
}

function SlaMetricCard({
    label,
    value,
    hint,
    icon,
    tone,
    active,
    onClick,
}: {
    label: string;
    value: string;
    hint: string;
    icon: ReactNode;
    tone: 'green' | 'red' | 'amber';
    active: boolean;
    onClick: () => void;
}) {
    const toneClass =
        tone === 'green'
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
            : tone === 'red'
                ? 'bg-red-500/15 text-red-300 ring-red-500/25'
                : 'bg-orange-500/15 text-orange-300 ring-orange-500/25';
    const activeClass =
        tone === 'green'
            ? 'border-emerald-500/50 ring-emerald-500/25'
            : tone === 'red'
                ? 'border-red-500/50 ring-red-500/25'
                : 'border-orange-500/50 ring-orange-500/25';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`rounded-xl border bg-gradient-to-br from-slate-900/75 to-slate-950/80 p-3 text-left transition hover:border-slate-700 hover:from-slate-900 hover:to-slate-950 ${
                active ? activeClass : 'border-slate-800 ring-1 ring-white/[0.03]'
            }`}
        >
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${toneClass}`}>
                {icon}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-white">{value}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>
        </button>
    );
}

function RiskRow({
    tier,
    title,
    value,
    detail,
    tone,
    cases,
    expanded,
    onToggle,
}: {
    tier: string;
    title: string;
    value: string;
    detail: string;
    tone: string;
    cases: SlaCardCase[];
    expanded: boolean;
    onToggle: () => void;
}) {
    const badgeClass =
        tone === 'red'
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : tone === 'orange'
                ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    const visibleCases = expanded ? cases.slice(0, 10) : [];

    return (
        <article className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
                </div>
                <div className="text-right">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass}`}>
                        {tier}
                    </span>
                    <p className="mt-2 text-sm font-bold text-slate-100">{value}</p>
                </div>
            </div>

            <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/35 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                        {cases.length > 0
                            ? `ซ่อนเลข AWB ไว้ ${formatCount(cases.length)} รายการ กดเพื่อเปิดดูเฉพาะกลุ่มนี้`
                            : 'ยังไม่มี AWB ตัวอย่างในกลุ่มนี้'}
                    </p>
                    {cases.length > 0 ? (
                        <button
                            type="button"
                            onClick={onToggle}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                        >
                            <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                            {expanded ? 'ซ่อนเลข AWB' : 'แสดงเลข AWB'}
                        </button>
                    ) : null}
                </div>
            </div>

            {visibleCases.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {visibleCases.map((item) => (
                        <ProblemAwbCard key={item.awb} item={item} />
                    ))}
                </div>
            ) : null}
        </article>
    );
}

function ProblemAwbCard({ item }: { item: SlaCardCase }) {
    const isCritical = item.tier === 'Critical';

    return (
        <article className="min-w-0 rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold text-slate-100">{item.awb}</p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">{item.receiver}</p>
                </div>
                <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        isCritical
                            ? 'border-red-500/30 bg-red-500/10 text-red-300'
                            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}
                >
                    {item.kind}
                </span>
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{item.detail}</p>
        </article>
    );
}

// ─── Cost / Area Inspection (ราย AWB) ───────────────────────────────────────────

type CostAreaRow = {
    awbNumber: string;
    bookingDate: string;
    latestScanTime: string | null;
    destSubdistrict: string | null;
    destDistrict: string | null;
    destProvince: string | null;
    receiverAddress: string | null;
    billableWeightKg: number | null;
    adminBillable: number;
    gatewayBillable: number;
    anomalyRatio: number | null;
    anomalyDiffKg: number;
    isAnomaly: boolean;
    ourCost: number;
    signerName: string | null;
    isClosed: boolean;
    daysPending: number | null;
};

const COST_AREA_PAGE = 10;

function ClosedBadge({ isClosed, signerName }: { isClosed: boolean; signerName?: string | null }) {
    if (isClosed) {
        return (
            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                ปิดงานแล้ว{signerName ? ` · ${signerName}` : ''}
            </span>
        );
    }
    return (
        <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            ยังไม่ปิด
        </span>
    );
}

function CostAreaInspectionSection({ range }: { range: { from: string; to: string } }) {
    const [show, setShow] = useState(false);
    const [viewMode, setViewMode] = useState<'cost' | 'area'>('cost');
    const [rows, setRows] = useState<CostAreaRow[]>([]);
    const [loadState, setLoadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [openAddr, setOpenAddr] = useState<Set<string>>(new Set());

    const filterMode = viewMode === 'cost' ? 'anomaly' : 'all';

    useEffect(() => {
        if (!show) return;
        const ctrl = new AbortController();
        setLoadState('loading');
        setError(null);
        const params = new URLSearchParams({
            date_from: range.from,
            date_to: range.to,
            filter: filterMode,
            limit: '300',
            offset: '0',
        });
        fetch(`/api/admin/jt-shipments/cost-area-detail?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: ctrl.signal,
        })
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ');
                setRows(Array.isArray(json.data) ? json.data : []);
                setPage(0);
                setLoadState('success');
            })
            .catch((e: unknown) => {
                if ((e as { name?: string }).name === 'AbortError') return;
                setError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ');
                setLoadState('error');
            });
        return () => ctrl.abort();
    }, [show, range.from, range.to, filterMode]);

    const totalPages = Math.max(1, Math.ceil(rows.length / COST_AREA_PAGE));
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * COST_AREA_PAGE;
    const pageRows = rows.slice(start, start + COST_AREA_PAGE);

    const toggleAddr = (awb: string) =>
        setOpenAddr((prev) => {
            const next = new Set(prev);
            if (next.has(awb)) next.delete(awb);
            else next.add(awb);
            return next;
        });

    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        <MapPin className="h-4 w-4 text-sky-400" aria-hidden />
                        ตรวจต้นทุน / พื้นที่ปิดงานช้า
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                        ราย AWB ช่วง {range.from} – {range.to} · จับชิ้นที่ gateway ปรับน้ำหนักผิดปกติ และพื้นที่ที่ยังไม่ปิดงาน
                    </p>
                </div>
                {show && (
                    <button
                        type="button"
                        onClick={() => setShow(false)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                        ซ่อน
                    </button>
                )}
            </div>

            {!show ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center">
                    <p className="mb-3 text-sm text-slate-400">ข้อมูลถูกซ่อนไว้ กดเพื่อโหลด</p>
                    <button
                        type="button"
                        onClick={() => setShow(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-400"
                    >
                        <Eye className="h-4 w-4" aria-hidden />
                        แสดงข้อมูล
                    </button>
                </div>
            ) : (
                <div className="mt-4 space-y-3">
                    {/* View toggle */}
                    <div className="inline-flex rounded-lg bg-slate-950/70 p-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('cost')}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                viewMode === 'cost' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Scale className="h-3.5 w-3.5" aria-hidden />
                            ต้นทุน / ปรับน้ำหนัก
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('area')}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                viewMode === 'area' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <MapPin className="h-3.5 w-3.5" aria-hidden />
                            พื้นที่ปิดงานช้า
                        </button>
                    </div>

                    {loadState === 'error' ? (
                        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
                            <p className="font-semibold">โหลดข้อมูลไม่สำเร็จ</p>
                            {error && <p className="mt-1 text-red-200/80">{error}</p>}
                            <p className="mt-1 text-xs text-red-200/60">
                                ตรวจสอบว่ารัน migration <code className="font-mono">20260521_jt_shipment_cost_area_detail.sql</code> ใน Supabase แล้ว
                            </p>
                        </div>
                    ) : loadState === 'loading' && rows.length === 0 ? (
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-slate-800/50" />
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-5 text-center text-sm text-slate-500">
                            {viewMode === 'cost' ? 'ไม่พบชิ้นที่ปรับน้ำหนักผิดปกติในช่วงนี้' : 'ไม่พบรายการในช่วงนี้'}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                {viewMode === 'cost' ? (
                                    <table className="min-w-full text-left text-xs">
                                        <thead className="text-slate-500">
                                            <tr className="border-b border-slate-800 bg-slate-900/30">
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">AWB</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Booking</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ปลายทาง</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">admin (กก.)</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">gateway (กก.)</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-rose-300">ปรับเกิน</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-sky-300">ต้นทุนเรา</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-900/50 text-slate-300">
                                            {pageRows.map((r) => (
                                                <tr key={r.awbNumber} className={r.isAnomaly ? 'bg-rose-500/[0.06] hover:bg-rose-500/10' : 'hover:bg-slate-900/50'}>
                                                    <td className="whitespace-nowrap px-3 py-2 font-mono text-sky-300">{r.awbNumber}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.bookingDate || '—'}</td>
                                                    <td className="max-w-[160px] truncate px-3 py-2">{[r.destDistrict, r.destProvince].filter(Boolean).join(' · ') || '—'}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.adminBillable.toFixed(2)}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.gatewayBillable.toFixed(2)}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-rose-300">{r.anomalyRatio != null ? `${r.anomalyRatio.toFixed(1)}×` : '—'}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-sky-200">{formatThb(r.ourCost)}</td>
                                                    <td className="whitespace-nowrap px-3 py-2"><ClosedBadge isClosed={r.isClosed} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="min-w-full text-left text-xs">
                                        <thead className="text-slate-500">
                                            <tr className="border-b border-slate-800 bg-slate-900/30">
                                                <th className="w-8 px-3 py-2.5" />
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">AWB</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Booking</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">สแกนล่าสุด</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ตำบล</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">อำเภอ</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">จังหวัด</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-amber-300">ใช้เวลาปิด (วัน)</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-900/50 text-slate-300">
                                            {pageRows.map((r) => {
                                                const open = openAddr.has(r.awbNumber);
                                                return (
                                                    <Fragment key={r.awbNumber}>
                                                        <tr className="hover:bg-slate-900/50">
                                                            <td className="px-3 py-2 text-slate-500">
                                                                {r.receiverAddress ? (
                                                                    <button type="button" onClick={() => toggleAddr(r.awbNumber)} aria-label="ดูที่อยู่">
                                                                        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
                                                                    </button>
                                                                ) : null}
                                                            </td>
                                                            <td className="whitespace-nowrap px-3 py-2 font-mono text-sky-300">{r.awbNumber}</td>
                                                            <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.bookingDate || '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.latestScanTime ? r.latestScanTime.slice(0, 16) : '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2">{r.destSubdistrict || '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2">{r.destDistrict || '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2">{r.destProvince || '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-amber-300">{r.daysPending ?? '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2"><ClosedBadge isClosed={r.isClosed} signerName={r.signerName} /></td>
                                                        </tr>
                                                        {open && r.receiverAddress && (
                                                            <tr className="bg-slate-950/60">
                                                                <td colSpan={9} className="px-4 py-2 text-xs leading-relaxed text-slate-400">
                                                                    <span className="text-slate-500">ที่อยู่ผู้รับ:</span> {r.receiverAddress}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {rows.length > COST_AREA_PAGE && (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                                    <span>
                                        แสดง {start + 1}–{Math.min(start + COST_AREA_PAGE, rows.length)} จาก {rows.length.toLocaleString('th-TH')} รายการ
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                                            disabled={safePage === 0}
                                            className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            ก่อนหน้า
                                        </button>
                                        <span className="tabular-nums text-slate-300">หน้า {safePage + 1}/{totalPages}</span>
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                            disabled={safePage >= totalPages - 1}
                                            className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            ถัดไป
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
