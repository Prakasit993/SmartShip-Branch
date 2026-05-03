'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { BarChart3, GripHorizontal } from 'lucide-react';
import type { JtDashboardChartsPayload } from './jtDashboardStatsChartTypes';
import { formatThb } from './jtDashboardFormatters';

function dailyBarHeightPct(value: number, maxValue: number): number {
    if (maxValue <= 0 || value <= 0) return 0;
    return (value / maxValue) * 100;
}

function formatDayLabel(ymd: string): string {
    if (!ymd || ymd.length < 10) return ymd;
    const t = Date.parse(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(t)) return ymd.slice(5);
    return new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function chartPlotMinWidthPx(dayCount: number): number {
    return Math.max(320, Math.min(4200, dayCount * 4));
}

/** ทศนิยม 1 ตำแหน่ง สำหรับ % */
function pct1(num: number, den: number): number {
    if (den <= 0 || !Number.isFinite(num)) return 0;
    return Math.round((num / den) * 1000) / 10;
}

function peakDay<T extends { date: string }>(rows: T[], value: (r: T) => number): { v: number; date: string } {
    let v = 0;
    let date = '';
    for (const r of rows) {
        const n = value(r);
        if (n > v) {
            v = n;
            date = r.date;
        }
    }
    return { v, date };
}

function compactCountLabel(n: number): string {
    if (n <= 0) return '';
    if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

function compactMoneyLabel(n: number): string {
    if (n <= 0) return '';
    if (n >= 100000) return `${(n / 1000).toFixed(0)}k`;
    if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
    return formatThb(n);
}

/** แถบเลื่อนแนวนอน — ซิงค์กับ scrollLeft ของกราฟหลัก */
function ChartScrollScrubber({
    primaryScrollRef,
    onSyncFromPrimary,
}: {
    primaryScrollRef: React.RefObject<HTMLDivElement | null>;
    onSyncFromPrimary: (left: number) => void;
}) {
    const [ratio, setRatio] = useState(0);
    const [trackMax, setTrackMax] = useState(0);

    const readScrollState = useCallback(() => {
        const el = primaryScrollRef.current;
        if (!el) return;
        const max = Math.max(0, el.scrollWidth - el.clientWidth);
        setTrackMax(max);
        setRatio(max <= 0 ? 0 : el.scrollLeft / max);
    }, [primaryScrollRef]);

    useEffect(() => {
        const el = primaryScrollRef.current;
        if (!el) return;
        readScrollState();
        el.addEventListener('scroll', readScrollState, { passive: true });
        const ro = new ResizeObserver(readScrollState);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', readScrollState);
            ro.disconnect();
        };
    }, [primaryScrollRef, readScrollState]);

    const scrubId = useId();

    if (trackMax <= 0) {
        return (
            <p className="text-[11px] text-slate-600">
                ความกว้างกราฟพอดีหน้าจอ — ไม่ต้องเลื่อน
            </p>
        );
    }

    return (
        <div className="space-y-1.5">
            <label htmlFor={scrubId} className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
                เลื่อนดูช่วงวันที่ (ใช้ร่วมทั้ง 3 กราฟ)
            </label>
            <input
                id={scrubId}
                type="range"
                min={0}
                max={1000}
                step={1}
                value={Math.round(ratio * 1000)}
                onChange={(e) => {
                    const el = primaryScrollRef.current;
                    if (!el) return;
                    const max = Math.max(0, el.scrollWidth - el.clientWidth);
                    const left = (Number(e.target.value) / 1000) * max;
                    el.scrollLeft = left;
                    onSyncFromPrimary(left);
                }}
                className="jt-chart-scrubber h-2 w-full cursor-pointer rounded-full accent-sky-500"
            />
        </div>
    );
}

function useHorizontalDragScroll(
    scrollRef: React.RefObject<HTMLDivElement | null>,
    source: 'count' | 'fee' | 'cod',
    syncScroll: (source: 'count' | 'fee' | 'cod', left: number) => void,
) {
    const drag = useRef({ active: false, startX: 0, startScroll: 0, pointerId: -1 });

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const el = scrollRef.current;
            if (!el) return;
            if (e.button !== 0) return;
            drag.current = {
                active: true,
                startX: e.clientX,
                startScroll: el.scrollLeft,
                pointerId: e.pointerId,
            };
            el.setPointerCapture(e.pointerId);
        },
        [scrollRef],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!drag.current.active || !scrollRef.current) return;
            const el = scrollRef.current;
            const dx = e.clientX - drag.current.startX;
            el.scrollLeft = drag.current.startScroll - dx;
            syncScroll(source, el.scrollLeft);
        },
        [scrollRef, source, syncScroll],
    );

    const endDrag = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!drag.current.active) return;
            const el = scrollRef.current;
            try {
                if (el && drag.current.pointerId >= 0) {
                    el.releasePointerCapture(drag.current.pointerId);
                }
            } catch {
                /* ignore */
            }
            drag.current.active = false;
        },
        [scrollRef],
    );

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        className:
            'cursor-grab touch-pan-x active:cursor-grabbing select-none [&_*]:select-none',
    };
}

function ChartGridLines() {
    return (
        <div
            className="pointer-events-none absolute inset-0 flex flex-col justify-between px-0.5"
            aria-hidden
        >
            <div className="border-t border-dashed border-slate-600/25" />
            <div className="border-t border-dashed border-slate-600/25" />
            <div className="border-t border-dashed border-slate-600/25" />
            <div className="border-t border-slate-700/55" />
        </div>
    );
}

type JtDashboardDailyChartsProps = {
    data: JtDashboardChartsPayload | null;
    loading: boolean;
    error: string | null;
    chartsAlignedWithSummaryCards: boolean;
};

function ChartSkeleton() {
    return (
        <div className="animate-pulse space-y-4 rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-4 ring-1 ring-white/[0.04] md:p-6">
            <div className="h-5 w-48 rounded bg-slate-800" />
            <div className="h-48 rounded-xl bg-slate-800/50" />
            <div className="h-5 w-56 rounded bg-slate-800" />
            <div className="h-48 rounded-xl bg-slate-800/50" />
            <div className="h-5 w-56 rounded bg-slate-800" />
            <div className="h-48 rounded-xl bg-slate-800/50" />
        </div>
    );
}

export function JtDashboardDailyCharts({
    data,
    loading,
    error,
    chartsAlignedWithSummaryCards,
}: JtDashboardDailyChartsProps) {
    const uid = useId();
    const countScrollRef = useRef<HTMLDivElement>(null);
    const feeScrollRef = useRef<HTMLDivElement>(null);
    const codScrollRef = useRef<HTMLDivElement>(null);
    const scrollLock = useRef(false);

    const syncScroll = useCallback((source: 'count' | 'fee' | 'cod', left: number) => {
        if (scrollLock.current) return;
        const refs = [
            { el: countScrollRef.current, key: 'count' as const },
            { el: feeScrollRef.current, key: 'fee' as const },
            { el: codScrollRef.current, key: 'cod' as const },
        ];
        const others = refs.filter((r) => r.key !== source);
        const needsSync = others.some((r) => r.el && r.el.scrollLeft !== left);
        if (!needsSync) return;
        scrollLock.current = true;
        for (const { el } of others) {
            if (el) el.scrollLeft = left;
        }
        requestAnimationFrame(() => {
            scrollLock.current = false;
        });
    }, []);

    const dragCount = useHorizontalDragScroll(countScrollRef, 'count', syncScroll);
    const dragFee = useHorizontalDragScroll(feeScrollRef, 'fee', syncScroll);
    const dragCod = useHorizontalDragScroll(codScrollRef, 'cod', syncScroll);

    const maxCount = useMemo(() => {
        const pts = data?.daily30 ?? [];
        return pts.reduce((m, d) => Math.max(m, d.count), 0);
    }, [data?.daily30]);

    const maxFee = useMemo(() => {
        const pts = data?.dailyFee30 ?? [];
        return pts.reduce((m, d) => Math.max(m, d.feeTotal), 0);
    }, [data?.dailyFee30]);

    const maxCod = useMemo(() => {
        const pts = data?.dailyCod30 ?? [];
        return pts.reduce((m, d) => Math.max(m, d.codTotal), 0);
    }, [data?.dailyCod30]);

    const title = useMemo(() => {
        const cw = data?.chartWindow;
        if (!cw) return 'กราฟรายวัน';
        if (cw.mode === 'range') return 'กราฟรายวัน — ช่วงที่เลือก (UTC)';
        if (cw.mode === 'month') return 'กราฟรายวัน — เต็มเดือน (UTC)';
        return `กราฟรายวัน — ${cw.windowDays} วันล่าสุดจากจองล่าสุด`;
    }, [data?.chartWindow]);

    if (loading && !data) {
        return <ChartSkeleton />;
    }

    if (error) {
        return (
            <section
                aria-labelledby={`jt-charts-err-${uid}`}
                className="rounded-2xl border border-amber-500/25 bg-amber-950/25 px-4 py-4 text-sm text-amber-200/95 ring-1 ring-amber-500/15"
            >
                <p id={`jt-charts-err-${uid}`} className="font-medium">
                    โหลดกราฟรายวันไม่สำเร็จ
                </p>
                <p className="mt-1 text-xs text-amber-200/75">{error}</p>
            </section>
        );
    }

    if (!data) {
        return null;
    }
    if (data.daily30.length === 0) {
        return (
            <section
                className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-white/[0.04]"
                aria-live="polite"
            >
                ไม่มีจุดข้อมูลรายวันในช่วงนี้ (หรือยังไม่มี booking_date ในช่วงที่กรอง)
            </section>
        );
    }

    const dayCount = data.daily30.length;
    const plotW = chartPlotMinWidthPx(dayCount);
    const sumCounts = data.daily30.reduce((a, d) => a + d.count, 0);
    const sumFees = data.dailyFee30.reduce((a, d) => a + d.feeTotal, 0);
    const sumCods = (data.dailyCod30 ?? []).reduce((a, d) => a + d.codTotal, 0);
    const avgCountPerDay = dayCount > 0 ? sumCounts / dayCount : 0;
    const avgFeePerDay = dayCount > 0 ? sumFees / dayCount : 0;
    const avgCodPerDay = dayCount > 0 ? sumCods / dayCount : 0;
    const peakC = peakDay(data.daily30, (r) => r.count);
    const peakF = peakDay(data.dailyFee30, (r) => r.feeTotal);
    const peakCod = peakDay(data.dailyCod30 ?? [], (r) => r.codTotal);
    const showCompactBarLabels = dayCount <= 12;

    const barCol =
        'group relative grid h-full min-h-0 min-w-[3px] flex-1 grid-rows-[auto_minmax(0,1fr)] px-[1px] transition-transform duration-150 will-change-transform hover:z-10 hover:scale-[1.02]';

    const countBars = data.daily30.map((d, i) => {
        const pct = dailyBarHeightPct(d.count, maxCount || 1);
        const h = Math.max(pct, d.count > 0 ? 4 : 0);
        const isLast = i === data.daily30.length - 1;
        const vsPeak = pct1(d.count, maxCount || 1);
        const vsSum = pct1(d.count, sumCounts || 1);
        const tipTitle = `${formatDayLabel(d.date)} · ${d.count.toLocaleString('th-TH')} รายการ · ${vsPeak}% ของสูงสุด · ${vsSum}% ของรวมช่วง`;
        return (
            <div key={d.date} className={barCol} title={tipTitle}>
                {showCompactBarLabels && d.count > 0 ? (
                    <div className="mb-0.5 text-center text-[9px] font-semibold tabular-nums leading-none text-slate-400">
                        {compactCountLabel(d.count)}
                    </div>
                ) : (
                    <div className="h-0 overflow-hidden" aria-hidden />
                )}
                <div className="relative flex min-h-0 w-full flex-col justify-end">
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-[min(92vw,17rem)] -translate-x-1/2 rounded-xl border border-slate-600/50 bg-slate-950/98 px-3 py-2.5 text-left text-[10px] leading-snug text-white shadow-2xl backdrop-blur-md sm:block sm:opacity-0 sm:transition-all sm:duration-200 sm:group-hover:opacity-100">
                        <div className="font-semibold text-sky-300">{formatDayLabel(d.date)}</div>
                        <div className="mt-1 tabular-nums text-slate-50">
                            {d.count.toLocaleString('th-TH')} <span className="text-slate-500">รายการ</span>
                        </div>
                        <div className="mt-2 space-y-0.5 border-t border-slate-700/80 pt-2 text-slate-300">
                            <div>
                                <span className="text-sky-300/95">{vsPeak}%</span>{' '}
                                <span className="text-slate-500">ของจุดสูงสุดในช่วง</span>
                            </div>
                            <div>
                                <span className="text-emerald-300/95">{vsSum}%</span>{' '}
                                <span className="text-slate-500">ของรวมทุกวันในช่วง</span>
                            </div>
                        </div>
                    </div>
                    <span
                        className={`block w-full rounded-t-md shadow-sm ring-1 ring-white/5 transition-[height,box-shadow] duration-200 will-change-[height] ${
                            isLast
                                ? 'bg-gradient-to-t from-sky-600 via-sky-500 to-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.35)]'
                                : 'bg-gradient-to-t from-sky-900/95 via-sky-700/85 to-sky-500/75 group-hover:shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                        }`}
                        style={{
                            height: `${Math.min(h, 100)}%`,
                            minHeight: d.count > 0 ? '5px' : '2px',
                            opacity: d.count > 0 ? 1 : 0.18,
                        }}
                    />
                </div>
            </div>
        );
    });

    const codBars = (data.dailyCod30 ?? []).map((d, i) => {
        const pct = dailyBarHeightPct(d.codTotal, maxCod || 1);
        const h = Math.max(pct, d.codTotal > 0 ? 4 : 0);
        const isLast = i === (data.dailyCod30 ?? []).length - 1;
        const vsPeak = pct1(d.codTotal, maxCod || 1);
        const vsSum = pct1(d.codTotal, sumCods || 1);
        const tipTitle = `${formatDayLabel(d.date)} · ฿${formatThb(d.codTotal)} · ${vsPeak}% ของสูงสุด · ${vsSum}% ของรวมช่วง`;
        return (
            <div key={d.date} className={barCol} title={tipTitle}>
                {showCompactBarLabels && d.codTotal > 0 ? (
                    <div className="mb-0.5 text-center text-[9px] font-semibold tabular-nums leading-none text-amber-400/90">
                        {compactMoneyLabel(d.codTotal)}
                    </div>
                ) : (
                    <div className="h-0 overflow-hidden" aria-hidden />
                )}
                <div className="relative flex min-h-0 w-full flex-col justify-end">
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-[min(92vw,17rem)] -translate-x-1/2 rounded-xl border border-slate-600/50 bg-slate-950/98 px-3 py-2.5 text-left text-[10px] leading-snug text-white shadow-2xl backdrop-blur-md sm:block sm:opacity-0 sm:transition-all sm:duration-200 sm:group-hover:opacity-100">
                        <div className="font-semibold text-amber-300">{formatDayLabel(d.date)}</div>
                        <div className="mt-1 tabular-nums text-slate-50">฿{formatThb(d.codTotal)}</div>
                        <div className="mt-2 space-y-0.5 border-t border-slate-700/80 pt-2 text-slate-300">
                            <div>
                                <span className="text-amber-300/95">{vsPeak}%</span>{' '}
                                <span className="text-slate-500">ของจุดสูงสุดในช่วง</span>
                            </div>
                            <div>
                                <span className="text-emerald-300/95">{vsSum}%</span>{' '}
                                <span className="text-slate-500">ของรวมทุกวันในช่วง</span>
                            </div>
                        </div>
                    </div>
                    <span
                        className={`block w-full rounded-t-md shadow-sm ring-1 ring-white/5 transition-[height,box-shadow] duration-200 ${
                            isLast
                                ? 'bg-gradient-to-t from-amber-600 via-amber-500 to-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.3)]'
                                : 'bg-gradient-to-t from-amber-950/95 via-amber-800/85 to-amber-600/80 group-hover:shadow-[0_0_12px_rgba(251,191,36,0.18)]'
                        }`}
                        style={{
                            height: `${Math.min(h, 100)}%`,
                            minHeight: d.codTotal > 0 ? '5px' : '2px',
                            opacity: d.codTotal > 0 ? 1 : 0.18,
                        }}
                    />
                </div>
            </div>
        );
    });

    const feeBars = data.dailyFee30.map((d, i) => {
        const pct = dailyBarHeightPct(d.feeTotal, maxFee || 1);
        const h = Math.max(pct, d.feeTotal > 0 ? 4 : 0);
        const isLast = i === data.dailyFee30.length - 1;
        const vsPeak = pct1(d.feeTotal, maxFee || 1);
        const vsSum = pct1(d.feeTotal, sumFees || 1);
        const tipTitle = `${formatDayLabel(d.date)} · ฿${formatThb(d.feeTotal)} · ${vsPeak}% ของสูงสุด · ${vsSum}% ของรวมช่วง`;
        return (
            <div key={d.date} className={barCol} title={tipTitle}>
                {showCompactBarLabels && d.feeTotal > 0 ? (
                    <div className="mb-0.5 text-center text-[9px] font-semibold tabular-nums leading-none text-violet-400/90">
                        {compactMoneyLabel(d.feeTotal)}
                    </div>
                ) : (
                    <div className="h-0 overflow-hidden" aria-hidden />
                )}
                <div className="relative flex min-h-0 w-full flex-col justify-end">
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-max max-w-[min(92vw,17rem)] -translate-x-1/2 rounded-xl border border-slate-600/50 bg-slate-950/98 px-3 py-2.5 text-left text-[10px] leading-snug text-white shadow-2xl backdrop-blur-md sm:block sm:opacity-0 sm:transition-all sm:duration-200 sm:group-hover:opacity-100">
                        <div className="font-semibold text-violet-300">{formatDayLabel(d.date)}</div>
                        <div className="mt-1 tabular-nums text-slate-50">฿{formatThb(d.feeTotal)}</div>
                        <div className="mt-2 space-y-0.5 border-t border-slate-700/80 pt-2 text-slate-300">
                            <div>
                                <span className="text-violet-300/95">{vsPeak}%</span>{' '}
                                <span className="text-slate-500">ของจุดสูงสุดในช่วง</span>
                            </div>
                            <div>
                                <span className="text-emerald-300/95">{vsSum}%</span>{' '}
                                <span className="text-slate-500">ของรวมทุกวันในช่วง</span>
                            </div>
                        </div>
                    </div>
                    <span
                        className={`block w-full rounded-t-md shadow-sm ring-1 ring-white/5 transition-[height,box-shadow] duration-200 ${
                            isLast
                                ? 'bg-gradient-to-t from-violet-600 via-violet-500 to-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.28)]'
                                : 'bg-gradient-to-t from-violet-950/95 via-violet-800/85 to-violet-600/80 group-hover:shadow-[0_0_12px_rgba(167,139,250,0.18)]'
                        }`}
                        style={{
                            height: `${Math.min(h, 100)}%`,
                            minHeight: d.feeTotal > 0 ? '5px' : '2px',
                            opacity: d.feeTotal > 0 ? 1 : 0.18,
                        }}
                    />
                </div>
            </div>
        );
    });

    const scrollShell =
        'jt-chart-scroll max-w-full overflow-x-auto overflow-y-hidden rounded-xl border border-slate-700/50 bg-gradient-to-b from-slate-950/80 to-slate-950/95 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ring-1 ring-white/[0.03]';

    return (
        <section
            aria-labelledby={`jt-daily-charts-${uid}`}
            className="min-w-0 space-y-6 rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/70 via-slate-950/85 to-[#070c14] p-4 shadow-xl shadow-black/30 ring-1 ring-white/[0.05] md:p-6"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-600/25 to-slate-900/80 text-sky-400 shadow-inner ring-1 ring-sky-500/25">
                        <BarChart3 className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <h2 id={`jt-daily-charts-${uid}`} className="text-lg font-semibold tracking-tight text-white">
                            {title}
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            แยกตามวันปฏิทิน UTC จาก{' '}
                            <code className="rounded-md bg-slate-950/90 px-1.5 py-0.5 text-[10px] text-sky-400 ring-1 ring-slate-800">
                                booking_date
                            </code>
                            {data.chartWindow.dailyStatsSource ? (
                                <span className="ml-1 text-slate-600">
                                    · แหล่งข้อมูล:{' '}
                                    {data.chartWindow.dailyStatsSource === 'rpc' ? 'RPC' : 'สำรอง'}
                                </span>
                            ) : null}
                        </p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-slate-400 ring-1 ring-slate-700/80">
                                ลากในกราฟ = เลื่อนซ้าย–ขวา
                            </span>
                            <span className="text-slate-600">·</span>
                            <span>หรือใช้แถบเลื่อนด้านล่าง</span>
                        </p>
                        {!chartsAlignedWithSummaryCards ? (
                            <p className="mt-2 text-[11px] leading-relaxed text-amber-200/90">
                                เมื่อไม่เลือกช่วงวันที่ การ์ดสรุปด้านบนคือทั้งตาราง แต่กราฟนี้ใช้ช่วงย้อนหลังจาก
                                <strong>วันที่จองล่าสุด</strong> — ใส่วันที่แล้วกด &quot;ใช้ช่วงนี้&quot; เพื่อให้กราฟตรงกับการ์ด
                            </p>
                        ) : null}
                        {data.chartWindow.paramNotes && data.chartWindow.paramNotes.length > 0 ? (
                            <ul className="mt-2 list-inside list-disc text-[11px] text-amber-200/85">
                                {data.chartWindow.paramNotes.map((n) => (
                                    <li key={n}>{n}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                </div>
                <div className="text-right text-[11px] leading-relaxed text-slate-500">
                    <div className="font-mono text-slate-400">
                        {data.chartWindow.utcStart} → {data.chartWindow.utcEnd}
                    </div>
                    <p className="mt-1.5 max-w-[18rem] text-slate-600">{data.chartWindow.anchorHint}</p>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-3 ring-1 ring-white/[0.03]">
                <ChartScrollScrubber
                    primaryScrollRef={countScrollRef}
                    onSyncFromPrimary={(left) => syncScroll('count', left)}
                />
            </div>

            <div className="space-y-2">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        จำนวนพัสดุต่อวัน
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                        รวมช่วง <strong className="font-medium text-slate-400">{sumCounts.toLocaleString('th-TH')}</strong> รายการ
                        · เฉลี่ย{' '}
                        <strong className="font-medium text-slate-400">
                            {avgCountPerDay.toLocaleString('th-TH', { maximumFractionDigits: 1 })}
                        </strong>
                        /วัน · จุดสูงสุด{' '}
                        <strong className="font-medium text-slate-400">{peakC.v.toLocaleString('th-TH')}</strong>
                        {peakC.date ? (
                            <span className="text-slate-600"> ({formatDayLabel(peakC.date)})</span>
                        ) : null}
                    </p>
                </div>
                <div className={scrollShell}>
                    <div
                        ref={countScrollRef}
                        {...dragCount}
                        onScroll={(e) => syncScroll('count', e.currentTarget.scrollLeft)}
                        aria-label="กราฟจำนวนพัสดุ — ลากหรือเลื่อนแนวนอน"
                        role="group"
                    >
                        <div className="px-2 pb-1 pt-3" style={{ width: `${plotW}px`, minWidth: '100%' }}>
                            <div className="relative h-[13.5rem] min-h-[13.5rem] w-full">
                                <ChartGridLines />
                                <div className="relative z-[1] flex h-full w-full items-stretch justify-between gap-0.5">
                                    {countBars}
                                </div>
                            </div>
                            <div className="flex justify-between border-t border-slate-800/90 px-1 pb-2 pt-2 text-[10px] font-medium text-slate-500">
                                <span>{data.daily30[0] ? formatDayLabel(data.daily30[0].date) : ''}</span>
                                <span>
                                    {data.daily30[data.daily30.length - 1]
                                        ? formatDayLabel(data.daily30[data.daily30.length - 1].date)
                                        : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        รวมค่าส่งต่อวัน (shipping_fee)
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                        รวมช่วง <strong className="font-medium text-slate-400">฿{formatThb(sumFees)}</strong> · เฉลี่ย{' '}
                        <strong className="font-medium text-slate-400">฿{formatThb(avgFeePerDay)}</strong>
                        /วัน · สูงสุด{' '}
                        <strong className="font-medium text-slate-400">฿{formatThb(peakF.v)}</strong>
                        {peakF.date ? (
                            <span className="text-slate-600"> ({formatDayLabel(peakF.date)})</span>
                        ) : null}
                    </p>
                </div>
                <div className={scrollShell}>
                    <div
                        ref={feeScrollRef}
                        {...dragFee}
                        onScroll={(e) => syncScroll('fee', e.currentTarget.scrollLeft)}
                        aria-label="กราฟค่าส่ง — ลากหรือเลื่อนแนวนอน"
                        role="group"
                    >
                        <div className="px-2 pb-1 pt-3" style={{ width: `${plotW}px`, minWidth: '100%' }}>
                            <div className="relative h-[13.5rem] min-h-[13.5rem] w-full">
                                <ChartGridLines />
                                <div className="relative z-[1] flex h-full w-full items-stretch justify-between gap-0.5">
                                    {feeBars}
                                </div>
                            </div>
                            <div className="flex justify-between border-t border-slate-800/90 px-1 pb-2 pt-2 text-[10px] font-medium text-slate-500">
                                <span>{data.dailyFee30[0] ? formatDayLabel(data.dailyFee30[0].date) : ''}</span>
                                <span>
                                    {data.dailyFee30[data.dailyFee30.length - 1]
                                        ? formatDayLabel(data.dailyFee30[data.dailyFee30.length - 1].date)
                                        : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        รวม COD ต่อวัน (cod_amount)
                    </p>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                        รวมช่วง <strong className="font-medium text-slate-400">฿{formatThb(sumCods)}</strong> · เฉลี่ย{' '}
                        <strong className="font-medium text-slate-400">฿{formatThb(avgCodPerDay)}</strong>
                        /วัน · สูงสุด{' '}
                        <strong className="font-medium text-slate-400">฿{formatThb(peakCod.v)}</strong>
                        {peakCod.date ? (
                            <span className="text-slate-600"> ({formatDayLabel(peakCod.date)})</span>
                        ) : null}
                    </p>
                </div>
                <div className={scrollShell}>
                    <div
                        ref={codScrollRef}
                        {...dragCod}
                        onScroll={(e) => syncScroll('cod', e.currentTarget.scrollLeft)}
                        aria-label="กราฟยอด COD — ลากหรือเลื่อนแนวนอน"
                        role="group"
                    >
                        <div className="px-2 pb-1 pt-3" style={{ width: `${plotW}px`, minWidth: '100%' }}>
                            <div className="relative h-[13.5rem] min-h-[13.5rem] w-full">
                                <ChartGridLines />
                                <div className="relative z-[1] flex h-full w-full items-stretch justify-between gap-0.5">
                                    {codBars}
                                </div>
                            </div>
                            <div className="flex justify-between border-t border-slate-800/90 px-1 pb-2 pt-2 text-[10px] font-medium text-slate-500">
                                <span>
                                    {(data.dailyCod30 ?? [])[0]
                                        ? formatDayLabel((data.dailyCod30 ?? [])[0].date)
                                        : ''}
                                </span>
                                <span>
                                    {(data.dailyCod30 ?? []).length > 0
                                        ? formatDayLabel(
                                              (data.dailyCod30 ?? [])[(data.dailyCod30 ?? []).length - 1].date,
                                          )
                                        : ''}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .jt-chart-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: rgb(71 85 105 / 0.85) rgb(15 23 42 / 0.5);
                }
                .jt-chart-scroll::-webkit-scrollbar {
                    height: 10px;
                }
                .jt-chart-scroll::-webkit-scrollbar-track {
                    background: rgb(15 23 42 / 0.55);
                    border-radius: 9999px;
                    margin: 4px;
                }
                .jt-chart-scroll::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, rgb(100 116 139 / 0.95), rgb(71 85 105 / 0.9));
                    border-radius: 9999px;
                    border: 2px solid rgb(15 23 42 / 0.7);
                }
                .jt-chart-scroll::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg, rgb(148 163 184 / 0.95), rgb(100 116 139 / 0.95));
                }
                .jt-chart-scrubber::-webkit-slider-thumb {
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 9999px;
                    background: linear-gradient(180deg, #38bdf8, #0284c7);
                    box-shadow:
                        0 1px 2px rgb(0 0 0 / 0.45),
                        0 0 0 1px rgb(56 189 248 / 0.35);
                    cursor: grab;
                }
                .jt-chart-scrubber:active::-webkit-slider-thumb {
                    cursor: grabbing;
                }
            `}</style>
        </section>
    );
}
