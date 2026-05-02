'use client';

import Link from 'next/link';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useId } from 'react';
import {
    nextVisibleSectionIndex,
    prevVisibleSectionIndex,
    type JtDashboardSectionKey,
} from '@/lib/jtDashboardSections';
import { FeeCard, StatCard } from './jtDashboardCards';

function dailyBarHeightPct(count: number, maxCount: number, mode: 'linear' | 'sqrt'): number {
    if (maxCount <= 0 || count <= 0) return 0;
    if (mode === 'linear') return (count / maxCount) * 100;
    return (Math.sqrt(count) / Math.sqrt(maxCount)) * 100;
}

function formatBookingThai(iso: string | null | undefined): string {
    if (iso == null || iso === '') return '—';
    const t = Date.parse(String(iso));
    if (Number.isNaN(t)) return String(iso).slice(0, 16);
    return new Date(t).toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatDayLabel(ymd: string): string {
    if (!ymd || ymd.length < 10) return ymd;
    const t = Date.parse(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(t)) return ymd.slice(5);
    return new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function platformPillClass(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('shopee')) return 'bg-orange-500/20 text-orange-200 ring-orange-500/30';
    if (n.includes('lazada')) return 'bg-blue-500/20 text-blue-200 ring-blue-500/30';
    if (n.includes('tiktok')) return 'bg-zinc-200/15 text-zinc-100 ring-zinc-500/30';
    if (n.includes('facebook') || n.includes('line')) return 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/30';
    if (n.includes('ไม่ระบุ') || n === '-') return 'bg-zinc-500/20 text-zinc-400 ring-zinc-600/40';
    return 'bg-violet-500/15 text-violet-200 ring-violet-500/30';
}

export type JtDashboardStatsShape = {
    total: number;
    today: number;
    week: number;
    month: number;
    totalFee: number;
    avgFee: number;
    avgFeeMarketplace: number;
    avgFeeJms: number;
    countAvgFeeMarketplace: number;
    countAvgFeeJms: number;
    maxFee: number;
    recent: {
        awb_number: string;
        booking_date: string;
        sender_name: string;
        receiver_name: string;
        shipping_fee: number;
    }[];
    topSenders: { name: string; count: number }[];
    topReceivers: { name: string; count: number }[];
    daily30: { date: string; count: number }[];
    dailyFee30: { date: string; feeTotal: number }[];
    sumDaily30: number;
    sumDailyFee30: number;
    bookingDateNullCount: number;
    platformCounts: { name: string; count: number }[];
    chartWindow?: {
        windowDays: number;
        utcStart: string;
        utcEnd: string;
        distinctDaysWithData: number;
        rowsInWindow: number;
        rowsOutsideWindowApprox: number;
        anchorHint: string;
    };
};

const JT_CHART_WINDOW_OPTIONS = [30, 90, 180, 365] as const;

export type JtOrderedBlocksInput = {
    stats: JtDashboardStatsShape;
    v: Record<JtDashboardSectionKey, boolean>;
    sectionOrder: JtDashboardSectionKey[];
    panel: string;
    platformDen: number;
    dailyChartScale: 'linear' | 'sqrt';
    setDailyChartScale: Dispatch<SetStateAction<'linear' | 'sqrt'>>;
    showAllTop: boolean;
    setShowAllTop: Dispatch<SetStateAction<boolean>>;
    topLimit: number;
    senderRows: { name: string; count: number }[];
    receiverRows: { name: string; count: number }[];
    recentRows: JtDashboardStatsShape['recent'];
    maxDaily: number;
    maxDailySafe: number;
    sumDaily30: number;
    daysWithData: number;
    maxDailyFee: number;
    maxDailyFeeSafe: number;
    sumDailyFee30: number;
    daysWithFeeData: number;
    maxSender: number;
    maxReceiver: number;
    chartWindowDays: (typeof JT_CHART_WINDOW_OPTIONS)[number];
    setChartWindowDays: (n: (typeof JT_CHART_WINDOW_OPTIONS)[number]) => void;
};

function DailyChartsSection({
    panel,
    stats,
    dailyChartScale,
    setDailyChartScale,
    maxDaily,
    maxDailySafe,
    sumDaily30,
    daysWithData,
    maxDailyFee,
    maxDailyFeeSafe,
    sumDailyFee30,
    daysWithFeeData,
    chartWindowDays,
    setChartWindowDays,
}: Pick<
    JtOrderedBlocksInput,
    | 'panel'
    | 'stats'
    | 'dailyChartScale'
    | 'setDailyChartScale'
    | 'maxDaily'
    | 'maxDailySafe'
    | 'sumDaily30'
    | 'daysWithData'
    | 'maxDailyFee'
    | 'maxDailyFeeSafe'
    | 'sumDailyFee30'
    | 'daysWithFeeData'
    | 'chartWindowDays'
    | 'setChartWindowDays'
>) {
    const chartHintId = useId();
    const outsideWindow =
        stats.chartWindow?.rowsOutsideWindowApprox ??
        Math.max(0, stats.total - (stats.bookingDateNullCount ?? 0) - sumDaily30);
    const windowN = stats.chartWindow?.windowDays ?? chartWindowDays;
    const utcStart = stats.chartWindow?.utcStart;
    const utcEnd = stats.chartWindow?.utcEnd;
    const distinctDays =
        stats.chartWindow?.distinctDaysWithData != null && stats.chartWindow.distinctDaysWithData >= 0
            ? stats.chartWindow.distinctDaysWithData
            : daysWithData;

    return (
        <section className={`${panel} overflow-hidden`} aria-labelledby={`jt-daily-h-${chartHintId}`}>
            {/* Header */}
            <div className="border-b border-zinc-800/80 bg-gradient-to-br from-zinc-900/50 via-zinc-950/80 to-[#0a1326]/90 px-4 py-4 md:px-6 md:py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                    <div className="min-w-0 flex-1 space-y-1">
                        <h2 id={`jt-daily-h-${chartHintId}`} className="text-lg md:text-xl font-bold tracking-tight text-zinc-50">
                            กราฟรายวัน — {windowN} วันล่าสุด
                        </h2>
                        <p className="text-xs text-zinc-500 leading-relaxed max-w-2xl">
                            แกนเวลาเดียวกัน (<strong className="text-zinc-400">UTC</strong> ต่อวัน) ·{' '}
                            <span className="text-sky-400/90 font-medium">ซ้าย</span> จำนวนจาก{' '}
                            <code className="rounded bg-zinc-900/90 px-1 py-0.5 text-[10px] text-sky-300">booking_date</code>{' '}
                            · <span className="text-amber-400/90 font-medium">ขวา</span> รวมค่าส่ง{' '}
                            <code className="rounded bg-zinc-900/90 px-1 py-0.5 text-[10px] text-amber-300">shipping_fee</code>{' '}
                            — จอใหญ่: ชี้ที่แท่งเพื่อดู tooltip · มือถือ: ใช้ปุ่มโฟกัสที่แท่งหรือดูยอดรวมที่ป้ายด้านบน
                        </p>
                        {utcStart && utcEnd ? (
                            <p className="text-[11px] text-zinc-500 tabular-nums">
                                ช่วงบนแกน: {formatDayLabel(utcStart)} — {formatDayLabel(utcEnd)} · แยกตามวัน UTC (ไม่ใช่ “ย้อนหลังจากวันนี้”)
                            </p>
                        ) : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center shrink-0">
                        <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">ช่วงแกน</span>
                            <select
                                value={chartWindowDays}
                                onChange={(e) => {
                                    const n = parseInt(e.target.value, 10);
                                    if (JT_CHART_WINDOW_OPTIONS.includes(n as (typeof JT_CHART_WINDOW_OPTIONS)[number])) {
                                        setChartWindowDays(n as (typeof JT_CHART_WINDOW_OPTIONS)[number]);
                                    }
                                }}
                                className="rounded-lg border border-zinc-700/90 bg-zinc-950/90 px-2.5 py-2 text-[11px] font-semibold text-zinc-200 shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 min-h-[40px] sm:min-h-[36px]"
                                aria-label="จำนวนวันบนแกนกราฟรายวัน"
                            >
                                {JT_CHART_WINDOW_OPTIONS.map((n) => (
                                    <option key={n} value={n}>
                                        {n} วัน
                                    </option>
                                ))}
                            </select>
                        </label>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 hidden sm:block">
                            ความสูงแท่ง
                        </span>
                        <div
                            className="inline-flex rounded-xl border border-zinc-700/90 bg-zinc-950/80 p-0.5 text-[11px] font-semibold shadow-inner"
                            role="group"
                            aria-label="โหมดสเกลกราฟทั้งสอง"
                        >
                            <button
                                type="button"
                                onClick={() => setDailyChartScale('sqrt')}
                                className={`rounded-lg px-3.5 py-2 min-h-[40px] sm:min-h-[36px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                                    dailyChartScale === 'sqrt'
                                        ? 'bg-sky-600 text-white shadow-md'
                                        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100'
                                }`}
                            >
                                สมดุล (√)
                            </button>
                            <button
                                type="button"
                                onClick={() => setDailyChartScale('linear')}
                                className={`rounded-lg px-3.5 py-2 min-h-[40px] sm:min-h-[36px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
                                    dailyChartScale === 'linear'
                                        ? 'bg-sky-600 text-white shadow-md'
                                        : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100'
                                }`}
                            >
                                ตามจริง
                            </button>
                        </div>
                    </div>
                </div>

                <details className="mt-4 group/dtl rounded-xl border border-zinc-800/70 bg-zinc-950/40 open:bg-zinc-950/55 transition-colors">
                    <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition flex items-center gap-2 select-none [&::-webkit-details-marker]:hidden">
                        <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800/80 text-[10px] text-zinc-500 group-open/dtl:rotate-90 transition-transform"
                            aria-hidden
                        >
                            ▸
                        </span>
                        สรุปยอดจากฐานข้อมูล &amp; หมายเหตุ
                    </summary>
                    <div className="border-t border-zinc-800/60 px-3 pb-3 pt-2 text-[11px] text-zinc-500 leading-relaxed space-y-2">
                        <p>
                            แถวทั้งหมดในตาราง{' '}
                            <strong className="text-zinc-300 tabular-nums">{stats.total.toLocaleString()}</strong> · ไม่มีวันที่จอง{' '}
                            <strong className="text-zinc-300 tabular-nums">{(stats.bookingDateNullCount ?? 0).toLocaleString()}</strong> ·
                            นอกช่วง {windowN} วันนี้บนแกน (ประมาณ){' '}
                            <strong className="text-zinc-300 tabular-nums">{outsideWindow.toLocaleString()}</strong>
                        </p>
                        {stats.chartWindow?.anchorHint ? (
                            <p className="text-zinc-400">{stats.chartWindow.anchorHint}</p>
                        ) : null}
                        <p className="text-zinc-600">
                            โหมด <strong className="text-zinc-500">สมดุล</strong> เหมาะเมื่อบางวันมีจำนวนสูงมากโดด ·{' '}
                            <strong className="text-zinc-500">ตามจริง</strong> ใช้สัดส่วนจริงจากค่าสูงสุดในกราฟ
                        </p>
                    </div>
                </details>
            </div>

            {/* Two charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Count */}
                <div className="border-b border-zinc-800/70 lg:border-b-0 lg:border-r lg:border-zinc-800/70 p-4 md:p-5 bg-zinc-950/20">
                    <div className="flex items-start gap-3 mb-3">
                        <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-sky-500/25 text-lg"
                            aria-hidden
                        >
                            📈
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-100">จำนวนรายการ</h3>
                            <p className="text-[11px] text-zinc-500 mt-0.5">นับจากฟิลด์ booking_date (UTC / วัน)</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900/90 px-2.5 py-1.5 text-[11px] tabular-nums text-zinc-300 ring-1 ring-zinc-700/60">
                            <span className="text-zinc-500">รวมในช่วง</span>
                            <strong className="text-zinc-50">{sumDaily30.toLocaleString()}</strong>
                            <span className="text-zinc-500">รายการ</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900/90 px-2.5 py-1.5 text-[11px] tabular-nums text-zinc-300 ring-1 ring-zinc-700/60">
                            <span className="text-zinc-500">วันมีข้อมูล</span>
                            <strong className="text-zinc-50">{distinctDays}</strong>
                            <span className="text-zinc-500">/ {windowN}</span>
                        </span>
                        {maxDaily > 0 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900/90 px-2.5 py-1.5 text-[11px] tabular-nums text-zinc-300 ring-1 ring-zinc-700/60">
                                <span className="text-zinc-500">สูงสุด / วัน</span>
                                <strong className="text-sky-300">{maxDaily.toLocaleString()}</strong>
                            </span>
                        ) : null}
                    </div>
                    <div
                        className="relative rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-950/70 to-zinc-950/40 px-1.5 sm:px-2 pt-3 pb-2 touch-manipulation"
                        role="img"
                        aria-label={`กราฟจำนวนรายการ ${windowN} วัน รวม ${sumDaily30.toLocaleString()} รายการ`}
                    >
                        <div
                            className="pointer-events-none absolute left-2 right-2 top-3 h-52 flex flex-col justify-between"
                            aria-hidden
                        >
                            <div className="border-t border-dashed border-zinc-700/35" />
                            <div className="border-t border-dashed border-zinc-700/35" />
                            <div className="border-t border-dashed border-zinc-700/35" />
                        </div>
                        <div className="relative flex h-52 w-full min-w-0 items-end justify-between gap-px sm:gap-0.5">
                            {stats.daily30.map((d, i) => {
                                const rawPct = dailyBarHeightPct(d.count, maxDailySafe, dailyChartScale);
                                const barPct =
                                    dailyChartScale === 'sqrt'
                                        ? Math.max(rawPct, d.count > 0 ? 5 : 0)
                                        : Math.max(rawPct, d.count > 0 ? 2.5 : 0);
                                const isLatest = i === stats.daily30.length - 1;
                                const label = `${formatDayLabel(d.date)} ${d.count.toLocaleString()} รายการ`;
                                return (
                                    <div
                                        key={d.date}
                                        className="group relative flex min-w-[2px] min-h-0 flex-1 flex-col justify-end"
                                        style={{ height: '100%' }}
                                    >
                                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-max max-w-[min(92vw,15rem)] -translate-x-1/2 rounded-lg bg-zinc-800/95 px-2.5 py-2 text-center text-[10px] leading-snug text-white shadow-xl ring-1 ring-zinc-600/50 sm:block sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                            <span className="font-semibold text-sky-200">{formatDayLabel(d.date)}</span>
                                            <br />
                                            <span className="tabular-nums text-zinc-100">{d.count.toLocaleString()} รายการ</span>
                                        </div>
                                        <button
                                            type="button"
                                            tabIndex={0}
                                            aria-label={label}
                                            className="relative flex w-full flex-1 flex-col justify-end rounded-t-[3px] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                                        >
                                            <span
                                                className={`block w-full rounded-t-[3px] transition-all ${isLatest ? 'bg-gradient-to-t from-blue-600 to-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.35)]' : 'bg-gradient-to-t from-blue-700/90 to-blue-500/70 group-hover:from-blue-500 group-hover:to-sky-400/90'}`}
                                                style={{
                                                    height: `${Math.min(barPct, 100)}%`,
                                                    minHeight: d.count > 0 ? '4px' : '2px',
                                                    opacity: d.count > 0 ? 1 : 0.22,
                                                }}
                                            />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex justify-between px-0.5 text-[10px] text-zinc-500">
                            <span>{stats.daily30[0] ? formatDayLabel(stats.daily30[0].date) : ''}</span>
                            <span className="font-medium text-sky-400/95 tabular-nums">
                                ล่าสุด{' '}
                                {stats.daily30[stats.daily30.length - 1]
                                    ? formatDayLabel(stats.daily30[stats.daily30.length - 1].date)
                                    : ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Fee */}
                <div className="p-4 md:p-5 bg-zinc-950/20">
                    <div className="flex items-start gap-3 mb-3">
                        <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/25 text-lg"
                            aria-hidden
                        >
                            💰
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-100">ยอดค่าส่งต่อวัน</h3>
                            <p className="text-[11px] text-zinc-500 mt-0.5">รวม shipping_fee ตามวันที่จองเดียวกับกราฟซ้าย</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900/90 px-2.5 py-1.5 text-[11px] tabular-nums text-zinc-300 ring-1 ring-zinc-700/60">
                            <span className="text-zinc-500">รวมในช่วง</span>
                            <strong className="text-amber-200">
                                ฿
                                {sumDailyFee30.toLocaleString(undefined, {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                })}
                            </strong>
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900/90 px-2.5 py-1.5 text-[11px] tabular-nums text-zinc-300 ring-1 ring-zinc-700/60">
                            <span className="text-zinc-500">วันมียอด</span>
                            <strong className="text-zinc-50">{daysWithFeeData}</strong>
                            <span className="text-zinc-500">/ {windowN}</span>
                        </span>
                        {maxDailyFee > 0 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900/90 px-2.5 py-1.5 text-[11px] tabular-nums text-zinc-300 ring-1 ring-zinc-700/60">
                                <span className="text-zinc-500">สูงสุด / วัน</span>
                                <strong className="text-amber-300">
                                    ฿
                                    {maxDailyFee.toLocaleString(undefined, {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 2,
                                    })}
                                </strong>
                            </span>
                        ) : null}
                    </div>
                    <div
                        className="relative rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-950/70 to-zinc-950/40 px-1.5 sm:px-2 pt-3 pb-2 touch-manipulation"
                        role="img"
                        aria-label={`กราฟยอดค่าส่ง ${windowN} วัน รวม ${sumDailyFee30.toLocaleString()} บาท`}
                    >
                        <div
                            className="pointer-events-none absolute left-2 right-2 top-3 h-52 flex flex-col justify-between"
                            aria-hidden
                        >
                            <div className="border-t border-dashed border-zinc-700/35" />
                            <div className="border-t border-dashed border-zinc-700/35" />
                            <div className="border-t border-dashed border-zinc-700/35" />
                        </div>
                        <div className="relative flex h-52 w-full min-w-0 items-end justify-between gap-px sm:gap-0.5">
                            {stats.dailyFee30.map((d, i) => {
                                const rawPct = dailyBarHeightPct(d.feeTotal, maxDailyFeeSafe, dailyChartScale);
                                const barPct =
                                    dailyChartScale === 'sqrt'
                                        ? Math.max(rawPct, d.feeTotal > 0 ? 5 : 0)
                                        : Math.max(rawPct, d.feeTotal > 0 ? 2.5 : 0);
                                const isLatest = i === stats.dailyFee30.length - 1;
                                const label = `${formatDayLabel(d.date)} ฿${d.feeTotal.toLocaleString()}`;
                                return (
                                    <div
                                        key={d.date}
                                        className="group relative flex min-w-[2px] min-h-0 flex-1 flex-col justify-end"
                                        style={{ height: '100%' }}
                                    >
                                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden w-max max-w-[min(92vw,15rem)] -translate-x-1/2 rounded-lg bg-zinc-800/95 px-2.5 py-2 text-center text-[10px] leading-snug text-white shadow-xl ring-1 ring-zinc-600/50 sm:block sm:opacity-0 sm:transition-opacity sm:duration-150 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                            <span className="font-semibold text-amber-200">{formatDayLabel(d.date)}</span>
                                            <br />
                                            <span className="tabular-nums">
                                                ฿
                                                {d.feeTotal.toLocaleString(undefined, {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            tabIndex={0}
                                            aria-label={label}
                                            className="relative flex w-full flex-1 flex-col justify-end rounded-t-[3px] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                                        >
                                            <span
                                                className={`block w-full rounded-t-[3px] transition-all ${isLatest ? 'bg-gradient-to-t from-amber-600 to-yellow-400 shadow-[0_0_14px_rgba(251,191,36,0.28)]' : 'bg-gradient-to-t from-amber-800/95 to-amber-600/75 group-hover:from-amber-600 group-hover:to-yellow-400/85'}`}
                                                style={{
                                                    height: `${Math.min(barPct, 100)}%`,
                                                    minHeight: d.feeTotal > 0 ? '4px' : '2px',
                                                    opacity: d.feeTotal > 0 ? 1 : 0.22,
                                                }}
                                            />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 flex justify-between px-0.5 text-[10px] text-zinc-500">
                            <span>{stats.dailyFee30[0] ? formatDayLabel(stats.dailyFee30[0].date) : ''}</span>
                            <span className="font-medium text-amber-400/95 tabular-nums">
                                ล่าสุด{' '}
                                {stats.dailyFee30[stats.dailyFee30.length - 1]
                                    ? formatDayLabel(stats.dailyFee30[stats.dailyFee30.length - 1].date)
                                    : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function TopSendersPanel({
    panel,
    topLimit,
    senderRows,
    maxSender,
    showAllTop,
    setShowAllTop,
}: Pick<JtOrderedBlocksInput, 'panel' | 'topLimit' | 'senderRows' | 'maxSender' | 'showAllTop' | 'setShowAllTop'>) {
    return (
        <div className={`${panel} p-5 md:p-6`}>
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold tracking-tight">👤 Top {topLimit} ผู้ส่งบ่อยสุด</h2>
                <button
                    type="button"
                    onClick={() => setShowAllTop((prev) => !prev)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 font-semibold"
                >
                    {showAllTop ? 'ดูย่อ' : 'ดูเพิ่ม'}
                </button>
            </div>
            <div className="space-y-2">
                {senderRows.map((s, i) => (
                    <div
                        key={`sender-${s.name}-${i}`}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-zinc-900/70 border border-transparent hover:border-zinc-800/80 transition"
                    >
                        <span className={`w-6 text-center text-xs font-black ${i < 3 ? 'text-amber-400' : 'text-zinc-500'}`}>{i + 1}</span>
                        <span className="flex-1 text-sm truncate font-medium text-zinc-100 min-w-0" title={s.name}>
                            {s.name || 'ไม่ระบุ'}
                        </span>
                        <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden min-w-[3rem] ring-1 ring-zinc-700/50">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full"
                                style={{ width: `${(s.count / maxSender) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold text-zinc-300 w-9 text-right tabular-nums">{s.count}</span>
                    </div>
                ))}
                {!senderRows.length && <p className="text-zinc-500 text-sm py-6 text-center">ไม่มีข้อมูลผู้ส่ง</p>}
            </div>
        </div>
    );
}

function TopReceiversPanel({
    panel,
    topLimit,
    receiverRows,
    maxReceiver,
}: Pick<JtOrderedBlocksInput, 'panel' | 'topLimit' | 'receiverRows' | 'maxReceiver'>) {
    return (
        <div className={`${panel} p-5 md:p-6`}>
            <h2 className="text-lg font-bold mb-5 tracking-tight">📬 Top {topLimit} ผู้รับบ่อยสุด</h2>
            <div className="space-y-2">
                {receiverRows.map((r, i) => (
                    <div
                        key={`recv-${r.name}-${i}`}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-zinc-900/70 border border-transparent hover:border-zinc-800/80 transition"
                    >
                        <span className={`w-6 text-center text-xs font-black ${i < 3 ? 'text-amber-400' : 'text-zinc-500'}`}>{i + 1}</span>
                        <span className="flex-1 text-sm truncate font-medium text-zinc-100 min-w-0" title={r.name}>
                            {r.name || 'ไม่ระบุ'}
                        </span>
                        <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden min-w-[3rem] ring-1 ring-zinc-700/50">
                            <div
                                className="h-full bg-gradient-to-r from-purple-600 to-pink-400 rounded-full"
                                style={{ width: `${(r.count / maxReceiver) * 100}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold text-zinc-300 w-9 text-right tabular-nums">{r.count}</span>
                    </div>
                ))}
                {!receiverRows.length && <p className="text-zinc-500 text-sm py-6 text-center">ไม่มีข้อมูลผู้รับ</p>}
            </div>
        </div>
    );
}

export function buildOrderedDashboardBlocks(ctx: JtOrderedBlocksInput): ReactNode[] {
    const {
        stats,
        v,
        sectionOrder: order,
        panel,
        platformDen,
        dailyChartScale,
        setDailyChartScale,
        showAllTop,
        setShowAllTop,
        topLimit,
        senderRows,
        receiverRows,
        recentRows,
        maxDaily,
        maxDailySafe,
        sumDaily30,
        daysWithData,
        maxDailyFee,
        maxDailyFeeSafe,
        sumDailyFee30,
        daysWithFeeData,
        maxSender,
        maxReceiver,
        chartWindowDays,
        setChartWindowDays,
    } = ctx;

    const nodes: ReactNode[] = [];
    let i = 0;

    while (i < order.length) {
        const k = order[i];
        if (!v[k]) {
            i += 1;
            continue;
        }

        if (k === 'daily') {
            const nv = nextVisibleSectionIndex(order, i, v);
            if (nv !== null && order[nv] === 'topSenders') {
                nodes.push(
                    <div key="jt-pair-daily-senders" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <DailyChartsSection
                            panel={panel}
                            stats={stats}
                            dailyChartScale={dailyChartScale}
                            setDailyChartScale={setDailyChartScale}
                            maxDaily={maxDaily}
                            maxDailySafe={maxDailySafe}
                            sumDaily30={sumDaily30}
                            daysWithData={daysWithData}
                            maxDailyFee={maxDailyFee}
                            maxDailyFeeSafe={maxDailyFeeSafe}
                            sumDailyFee30={sumDailyFee30}
                            daysWithFeeData={daysWithFeeData}
                            chartWindowDays={chartWindowDays}
                            setChartWindowDays={setChartWindowDays}
                        />
                        <TopSendersPanel
                            panel={panel}
                            topLimit={topLimit}
                            senderRows={senderRows}
                            maxSender={maxSender}
                            showAllTop={showAllTop}
                            setShowAllTop={setShowAllTop}
                        />
                    </div>,
                );
                i = nv + 1;
                continue;
            }
        }

        if (k === 'topSenders') {
            const pv = prevVisibleSectionIndex(order, i, v);
            if (pv !== null && order[pv] === 'daily') {
                i += 1;
                continue;
            }
        }

        if (k === 'summary') {
            nodes.push(
                <div key="summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <StatCard label="รายการทั้งหมด" value={stats.total.toLocaleString()} icon="📦" accent="from-sky-500 to-blue-700" hint="ในฐานข้อมูล" />
                    <StatCard label="วันนี้" value={stats.today.toLocaleString()} icon="📅" accent="from-emerald-500 to-teal-700" hint="ตั้งแต่เที่ยงคืน (ตามเบราว์เซอร์)" />
                    <StatCard label="7 วันล่าสุด" value={stats.week.toLocaleString()} icon="📈" accent="from-violet-500 to-purple-800" hint="ย้อนหลัง 7 วัน" />
                    <StatCard label="เดือนนี้" value={stats.month.toLocaleString()} icon="🗓️" accent="from-amber-500 to-orange-700" hint="วันที่ 1 ของเดือนปัจจุบัน" />
                </div>,
            );
        } else if (k === 'fees') {
            nodes.push(
                <div key="fees" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                    <FeeCard label="ค่าส่งรวม" value={`฿${stats.totalFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} icon="💰" accent="text-emerald-300" />
                    <FeeCard
                        label="เฉลี่ยต่อรายการ (แพลตฟอร์ม)"
                        value={`฿${stats.avgFeeMarketplace.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                        icon="📊"
                        accent="text-sky-300"
                        hint={`TikTok · tiktok_reverse · Shein · Temu · Shopee — ${stats.countAvgFeeMarketplace.toLocaleString()} รายการ`}
                    />
                    <FeeCard
                        label="เฉลี่ยต่อรายการ (JMS)"
                        value={`฿${stats.avgFeeJms.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                        icon="📮"
                        accent="text-violet-300"
                        hint={`${stats.countAvgFeeJms.toLocaleString()} รายการ`}
                    />
                    <FeeCard label="ค่าส่งสูงสุด / รายการ" value={`฿${stats.maxFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} icon="🏆" accent="text-amber-300" />
                </div>,
            );
        } else if (k === 'platforms') {
            nodes.push(
                <div key="platforms" className={`${panel} p-5 md:p-6`}>
                    <div className="mb-5">
                        <h2 className="text-lg font-bold flex items-center gap-2 tracking-tight">🛒 แพลตฟอร์ม / ช่องทาง</h2>
                        <p className="text-xs text-zinc-500 mt-1.5 max-w-3xl leading-relaxed">
                            ใช้ลำดับฟิลด์จาก{' '}
                            <Link href="/admin/settings#jt-channel-fields" className="text-blue-400 hover:underline font-medium">
                                ตั้งค่าเว็บไซต์ → แดชบอร์ด J&amp;T
                            </Link>{' '}
                            (ค่าเริ่มต้น: platform → order_source) — แก้ที่{' '}
                            <Link href="/admin/shipments" className="text-blue-400 hover:underline font-medium">
                                J&T Shipments
                            </Link>{' '}
                            หรือ Import / n8n
                        </p>
                    </div>
                    {!stats.platformCounts.length ? (
                        <div className="rounded-xl border border-dashed border-zinc-700/80 px-4 py-10 text-center text-sm text-zinc-500 bg-zinc-950/40">
                            ยังไม่มีข้อมูลแยกแพลตฟอร์ม หรือคอลัมน์ว่างทั้งหมด
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {stats.platformCounts.map((row, idx) => {
                                const pct = (row.count / platformDen) * 100;
                                return (
                                    <div
                                        key={`${row.name}-${idx}`}
                                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 rounded-xl border border-zinc-800/80 bg-zinc-950/35 px-3 py-3 sm:px-4"
                                    >
                                        <span
                                            className={`inline-flex w-fit max-w-full items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${platformPillClass(row.name)}`}
                                            title={row.name}
                                        >
                                            {row.name}
                                        </span>
                                        <div className="flex flex-1 items-center gap-3 min-w-0">
                                            <div className="flex-1 h-3.5 sm:h-4 bg-zinc-800/90 rounded-full overflow-hidden ring-1 ring-zinc-700/40 min-w-[6rem]">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 shadow-inner"
                                                    style={{ width: `${Math.max(pct, row.count > 0 ? 4 : 0)}%` }}
                                                />
                                            </div>
                                            <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                                                <span className="text-sm font-bold text-zinc-100 w-[4.5rem] sm:w-auto text-right">
                                                    {row.count.toLocaleString()}
                                                </span>
                                                <span className="text-[11px] text-zinc-500 w-12 text-right">{pct.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>,
            );
        } else if (k === 'daily') {
            nodes.push(
                <DailyChartsSection
                    key="daily-only"
                    panel={panel}
                    stats={stats}
                    dailyChartScale={dailyChartScale}
                    setDailyChartScale={setDailyChartScale}
                    maxDaily={maxDaily}
                    maxDailySafe={maxDailySafe}
                    sumDaily30={sumDaily30}
                    daysWithData={daysWithData}
                    maxDailyFee={maxDailyFee}
                    maxDailyFeeSafe={maxDailyFeeSafe}
                    sumDailyFee30={sumDailyFee30}
                    daysWithFeeData={daysWithFeeData}
                    chartWindowDays={chartWindowDays}
                    setChartWindowDays={setChartWindowDays}
                />,
            );
        } else if (k === 'topSenders') {
            nodes.push(
                <div key="topSenders-only" className="grid grid-cols-1 gap-6">
                    <TopSendersPanel
                        panel={panel}
                        topLimit={topLimit}
                        senderRows={senderRows}
                        maxSender={maxSender}
                        showAllTop={showAllTop}
                        setShowAllTop={setShowAllTop}
                    />
                </div>,
            );
        } else if (k === 'topReceivers') {
            nodes.push(
                <div key="topRecv-only" className="grid grid-cols-1 gap-6">
                    <TopReceiversPanel panel={panel} topLimit={topLimit} receiverRows={receiverRows} maxReceiver={maxReceiver} />
                </div>,
            );
        } else if (k === 'recent') {
            nodes.push(
                <div key="recent" className={`${panel} overflow-hidden`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-4 md:p-5 border-b border-zinc-800/90 bg-zinc-950/40">
                        <h2 className="text-lg font-bold tracking-tight">📋 รายการล่าสุด</h2>
                        <Link
                            href="/admin/shipments"
                            className="text-sm font-semibold text-sky-400 hover:text-sky-300 transition shrink-0"
                        >
                            ดูทั้งหมด →
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[520px]">
                            <thead>
                                <tr className="bg-zinc-950/80 text-left border-b border-zinc-800">
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">AWB</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">วันที่จอง</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">ผู้ส่ง</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">ผู้รับ</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide text-right">ค่าส่ง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/80">
                                {recentRows.map((r, rowIdx) => (
                                    <tr key={`${r.awb_number}-${rowIdx}`} className="hover:bg-zinc-900/50 transition">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-sky-400 whitespace-nowrap">{r.awb_number || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatBookingThai(r.booking_date)}</td>
                                        <td className="px-4 py-3 max-w-[140px] truncate font-medium text-zinc-200" title={r.sender_name}>
                                            {r.sender_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 max-w-[140px] truncate text-zinc-400" title={r.receiver_name}>
                                            {r.receiver_name || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                            <span className={r.shipping_fee > 0 ? 'text-emerald-400' : 'text-zinc-500'}>
                                                ฿{r.shipping_fee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {!recentRows.length && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-zinc-500">
                                            ไม่มีข้อมูลล่าสุด
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>,
            );
        }

        i += 1;
    }

    return nodes;
}
