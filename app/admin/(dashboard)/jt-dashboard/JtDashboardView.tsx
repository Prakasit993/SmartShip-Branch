'use client';

import Link from 'next/link';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, Calendar, CheckCircle2, Clock, HandCoins, Hourglass, Minus, Package, Percent, RefreshCw, RotateCcw, Search, Truck } from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import type { JtCustomMetricCardDefinition } from '@/lib/jtCustomMetricCards';
import type { JtDashboardChartsPayload } from './jtDashboardStatsChartTypes';
import type {
    JtDashboardMetrics,
    JtDashboardPreviousMetrics,
    JtDashboardShipmentRow,
} from './jtDashboardTypes';
import { JtDashboardCustomMetrics } from './JtDashboardCustomMetrics';
import { JtDashboardDailyCharts } from './JtDashboardDailyCharts';
import { JtTopSendersPanel, type JtTopSenderRow } from './JtTopSendersPanel';
import {
    formatBookingDateThai,
    formatThb,
    moneyOrZero,
    scanStatusPresentation,
    strOrDash,
} from './jtDashboardFormatters';
import { useAnimatedCounter } from './useAnimatedCounter';

export type JtDashboardViewProps = {
    metrics: JtDashboardMetrics;
    previousMetrics: JtDashboardPreviousMetrics | null;
    recentRows: JtDashboardShipmentRow[];
    /** สถิติรายวันจาก `/api/admin/jt-shipments/stats` — โหมด mock ไม่ใช้ */
    charts: JtDashboardChartsPayload | null;
    chartError: string | null;
    chartsAlignedWithSummaryCards: boolean;
    topSenders: JtTopSenderRow[];
    customMetricDefinitions: JtCustomMetricCardDefinition[];
    customMetrics: Array<{
        id: string;
        title: string;
        subtitle?: string;
        icon: string;
        display: string;
        format: string;
    }>;
    onSaveCustomMetricCards: (cards: JtCustomMetricCardDefinition[]) => Promise<void>;
    loading: boolean;
    error: string | null;
    parcelDateFrom: string;
    parcelDateTo: string;
    onParcelDateFromChange: (v: string) => void;
    onParcelDateToChange: (v: string) => void;
    onApplyRange: () => void;
    onRetry?: () => void;
    /** ช่วงวันที่ที่กด "ใช้ช่วงนี้" แล้ว (แสดงใต้การ์ดพัสดุทั้งหมด) */
    appliedRange: { from: string; to: string } | null;
    /** Step 1: แสดงป้ายว่าเป็นข้อมูลจำลอง */
    mockMode?: boolean;
    /** เวลาที่โหลดข้อมูลสำเร็จล่าสุด */
    lastRefreshed?: Date | null;
};

/** Compare current vs previous. `inverseGood = true` flips color (e.g. returnCount: ▼ = good). */
function DeltaBadge({
    current,
    previous,
    previousRangeDays,
    inverseGood = false,
}: {
    current: number;
    previous: number;
    previousRangeDays: number;
    inverseGood?: boolean;
}) {
    const hint = `เทียบ ${previousRangeDays} วันก่อนหน้า (${previous.toLocaleString('th-TH', { maximumFractionDigits: 2 })})`;

    if (previous === 0 && current === 0) {
        return (
            <span
                className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-700/60"
                title={hint}
            >
                <Minus className="h-2.5 w-2.5" aria-hidden />
                ไม่มีข้อมูลเทียบ
            </span>
        );
    }

    const delta = current - previous;
    const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : current > 0 ? 100 : 0;
    const isUp = delta > 0;
    const isDown = delta < 0;
    const isFlat = delta === 0;

    const isGood = isFlat ? true : inverseGood ? isDown : isUp;
    const tone = isFlat
        ? 'bg-slate-800/60 text-slate-400 ring-slate-700/60'
        : isGood
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
            : 'bg-rose-500/15 text-rose-300 ring-rose-500/30';

    const Icon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight;
    const sign = isUp ? '+' : '';
    const pctText = Math.abs(pct) >= 1000
        ? `${sign}${Math.round(pct).toLocaleString('th-TH')}%`
        : `${sign}${pct.toFixed(1)}%`;

    return (
        <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${tone}`}
            title={hint}
        >
            <Icon className="h-2.5 w-2.5" aria-hidden />
            {pctText}
        </span>
    );
}

/* ─── Animated KPI Card ─── */
function AnimatedKpiCard({
    icon,
    iconBg,
    iconRing,
    iconFg,
    glowColor,
    label,
    value,
    prefix,
    suffix,
    hint,
    index,
    decimals,
    delta,
}: {
    icon: React.ReactNode;
    iconBg: string;
    iconRing: string;
    iconFg: string;
    glowColor: string;
    label: string;
    value: number;
    prefix?: string;
    suffix?: string;
    hint?: React.ReactNode;
    index: number;
    decimals?: number;
    delta?: { previous: number; previousRangeDays: number; inverseGood?: boolean };
}) {
    const animated = useAnimatedCounter(value, { duration: 900, decimals: decimals ?? 0 });
    const formatted = (decimals ?? 0) > 0
        ? animated.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        : animated.toLocaleString('th-TH');

    return (
        <article
            className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/60 via-slate-900/50 to-slate-950/80 p-4 sm:p-5 shadow-lg shadow-black/20 ring-1 ring-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
            style={{
                animation: `fadeSlideIn 0.5s ease-out ${index * 80}ms both`,
            }}
        >
            {/* Gradient glow behind card */}
            <div
                className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full ${glowColor} opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100`}
            />
            <div
                className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full ${glowColor} opacity-20 blur-2xl`}
            />

            <div className={`relative mb-3 sm:mb-4 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl ${iconBg} ${iconFg} ring-1 ${iconRing} transition-transform duration-300 group-hover:scale-110`}>
                {icon}
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {label}
            </p>
            <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl lg:text-[1.75rem] font-bold tabular-nums tracking-tight text-white">
                {prefix}{formatted}{suffix}
            </p>
            {delta ? (
                <DeltaBadge
                    current={value}
                    previous={delta.previous}
                    previousRangeDays={delta.previousRangeDays}
                    inverseGood={delta.inverseGood}
                />
            ) : null}
            {hint ? (
                <div className="mt-1 sm:mt-1.5 text-[10px] sm:text-[11px] leading-snug text-slate-500">
                    {hint}
                </div>
            ) : null}
        </article>
    );
}

function SummaryCardSkeleton() {
    return (
        <div className="animate-pulse rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/40 to-slate-950/60 p-5">
            <div className="mb-4 h-11 w-11 rounded-xl bg-slate-800/80" />
            <div className="mb-2 h-3 w-24 rounded bg-slate-800/60" />
            <div className="h-8 w-20 rounded bg-slate-800/50" />
        </div>
    );
}

function TableSkeleton() {
    return (
        <div className="animate-pulse space-y-3 rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/40 to-slate-950/60 p-4">
            <div className="h-5 w-48 rounded bg-slate-800/60" />
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-800/40" />
            ))}
        </div>
    );
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'เมื่อสักครู่';
    if (seconds < 60) return `${seconds} วินาทีที่แล้ว`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

/**
 * โครง UI หลักของแดชบอร์ด J&T — พื้นหลังเข้ม slate-950/900 ตามธีมแอดมิน
 * (Sidebar / ภาษา TH|EN อยู่ที่ layout แม่ — ไม่ซ้ำในไฟล์นี้)
 */
export function JtDashboardView({
    metrics,
    previousMetrics,
    recentRows,
    charts,
    chartError,
    chartsAlignedWithSummaryCards,
    topSenders,
    customMetricDefinitions,
    customMetrics,
    onSaveCustomMetricCards,
    loading,
    error,
    parcelDateFrom,
    parcelDateTo,
    onParcelDateFromChange,
    onParcelDateToChange,
    onApplyRange,
    onRetry,
    appliedRange,
    mockMode,
    lastRefreshed,
}: JtDashboardViewProps) {
    const showContent = !loading && !error;

    return (
        <div className="min-w-0 space-y-5 sm:space-y-6 lg:space-y-8">
            {/* Global animations */}
            <style jsx global>{`
                @keyframes fadeSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(12px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes fadeSlideInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes subtlePulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                .jt-row-fade {
                    animation: fadeSlideInLeft 0.35s ease-out both;
                }
            `}</style>

            <AdminPageHeader
                title="แดชบอร์ด J&T"
                description={
                    mockMode
                        ? 'สรุปข้อมูลจากตาราง jt_shipments — โหมดตัวอย่าง UI (Mock data · Step 1)'
                        : 'สรุปข้อมูลจากตาราง jt_shipments — โหลดแบบเรียลไทม์จาก Supabase'
                }
                tone="dark"
                meta={
                    mockMode ? (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
                            Mock UI
                        </span>
                    ) : null
                }
            />

            {error ? (
                <div
                    role="alert"
                    className="flex flex-col gap-4 rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                    style={{ animation: 'fadeSlideIn 0.4s ease-out' }}
                >
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
                        <div>
                            <p className="font-medium text-red-200">โหลดข้อมูลไม่สำเร็จ</p>
                            <p className="mt-1 text-sm text-red-300/90">{error}</p>
                        </div>
                    </div>
                    {onRetry ? (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="group/retry shrink-0 rounded-xl bg-red-500/20 px-4 py-2.5 text-sm font-medium text-red-100 ring-1 ring-red-500/40 transition-all hover:bg-red-500/30 hover:ring-red-500/60"
                        >
                            <RefreshCw className="mr-1.5 inline-block h-3.5 w-3.5 transition-transform group-hover/retry:rotate-180" />
                            ลองอีกครั้ง
                        </button>
                    ) : null}
                </div>
            ) : null}

            <section aria-labelledby="summary-heading">
                <h2 id="summary-heading" className="sr-only">
                    สรุปภาพรวม
                </h2>

                {/* ── Date Filter Bar ── */}
                <div
                    className="mb-4 sm:mb-5 rounded-2xl border border-slate-800/70 bg-gradient-to-r from-slate-900/50 via-slate-900/40 to-slate-950/60 p-3 sm:p-4 ring-1 ring-white/[0.04]"
                    style={{ animation: 'fadeSlideIn 0.4s ease-out' }}
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25">
                                <Calendar className="h-4 w-4" aria-hidden />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-400">
                                    กรองตามวันที่จอง
                                </p>
                                <p className="hidden sm:block text-[10px] text-slate-600">
                                    {mockMode
                                        ? 'โหมดจำลอง: ไม่ยิง API'
                                        : 'booking_date · เว้นทั้งคู่ = ทั้งตาราง'}
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:flex sm:items-end">
                            <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-400">
                                <span className="text-[10px] font-medium text-slate-500">ตั้งแต่</span>
                                <input
                                    type="date"
                                    value={parcelDateFrom}
                                    onChange={(e) => onParcelDateFromChange(e.target.value)}
                                    className="min-h-[44px] sm:min-h-0 w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/40 transition-all focus:border-sky-500/50 focus:ring-2 hover:border-slate-600"
                                />
                            </label>
                            <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-400">
                                <span className="text-[10px] font-medium text-slate-500">ถึง</span>
                                <input
                                    type="date"
                                    value={parcelDateTo}
                                    onChange={(e) => onParcelDateToChange(e.target.value)}
                                    className="min-h-[44px] sm:min-h-0 w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/40 transition-all focus:border-sky-500/50 focus:ring-2 hover:border-slate-600"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={onApplyRange}
                                disabled={loading}
                                className="group/btn self-end flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 min-h-[44px] sm:min-h-0 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all hover:from-sky-500 hover:to-sky-400 hover:shadow-sky-800/40 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                            >
                                <Search className="h-3.5 w-3.5 transition-transform group-hover/btn:scale-110" aria-hidden />
                                <span className="hidden sm:inline">กรองข้อมูล</span>
                                <span className="sm:hidden">กรอง</span>
                            </button>
                        </div>
                    </div>

                    {/* Refresh timestamp */}
                    {lastRefreshed ? (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
                            <Clock className="h-3 w-3 shrink-0" aria-hidden />
                            <span>อัปเดตล่าสุด: {formatTimeAgo(lastRefreshed)}</span>
                        </div>
                    ) : null}
                </div>

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                    {loading ? (
                        <>
                            <SummaryCardSkeleton />
                            <SummaryCardSkeleton />
                            <SummaryCardSkeleton />
                            <SummaryCardSkeleton />
                        </>
                    ) : showContent ? (
                        <>
                            <AnimatedKpiCard
                                index={0}
                                icon={<Package className="h-5 w-5" aria-hidden />}
                                iconBg="bg-sky-500/15"
                                iconRing="ring-sky-500/25"
                                iconFg="text-sky-400"
                                glowColor="bg-sky-500/40"
                                label="พัสดุทั้งหมด"
                                value={metrics.totalParcels}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.count,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint={
                                    appliedRange && (appliedRange.from || appliedRange.to) ? (
                                        <span className="text-sky-400/90">
                                            ช่วง: {appliedRange.from || '…'} → {appliedRange.to || '…'}
                                        </span>
                                    ) : (
                                        <span className="text-slate-600">ทั้งระบบ (ไม่กรองวันที่)</span>
                                    )
                                }
                            />

                            <AnimatedKpiCard
                                index={1}
                                icon={<Banknote className="h-5 w-5" aria-hidden />}
                                iconBg="bg-amber-500/15"
                                iconRing="ring-amber-500/25"
                                iconFg="text-amber-400"
                                glowColor="bg-amber-500/40"
                                label="ยอดเก็บปลายทาง (COD)"
                                value={metrics.sumCod}
                                prefix="฿"
                                decimals={2}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.sumCod,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint="ผลรวม cod_amount"
                            />

                            <AnimatedKpiCard
                                index={2}
                                icon={<Truck className="h-5 w-5" aria-hidden />}
                                iconBg="bg-violet-500/15"
                                iconRing="ring-violet-500/25"
                                iconFg="text-violet-400"
                                glowColor="bg-violet-500/40"
                                label="ส่งโดย JMS"
                                value={metrics.jmsCount}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.jmsCount,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint={
                                    metrics.totalParcels > 0 ? (
                                        <span>
                                            {metrics.jmsCount.toLocaleString('th-TH')} จาก{' '}
                                            {metrics.totalParcels.toLocaleString('th-TH')} พัสดุ
                                            {' · '}
                                            {(
                                                Math.round(
                                                    (metrics.jmsCount / metrics.totalParcels) * 1000,
                                                ) / 10
                                            ).toLocaleString('th-TH')}
                                            %
                                        </span>
                                    ) : (
                                        <span>ช่องทาง = JMS (เราเก็บค่าส่งเอง)</span>
                                    )
                                }
                            />

                            <AnimatedKpiCard
                                index={3}
                                icon={<RotateCcw className="h-5 w-5" aria-hidden />}
                                iconBg="bg-rose-500/15"
                                iconRing="ring-rose-500/25"
                                iconFg="text-rose-400"
                                glowColor="bg-rose-500/40"
                                label="พัสดุตีกลับ"
                                value={metrics.returnCount}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.returnCount,
                                              previousRangeDays: previousMetrics.range.days,
                                              inverseGood: true,
                                          }
                                        : undefined
                                }
                                hint={'latest_scan_type มีคำว่า "ตีกลับ" หรือ Return'}
                            />

                            {!mockMode ? (
                                <JtDashboardCustomMetrics
                                    definitions={customMetricDefinitions}
                                    computed={customMetrics}
                                    disabled={loading}
                                    onSave={onSaveCustomMetricCards}
                                />
                            ) : null}
                        </>
                    ) : null}
                </div>

                {/* ─── Row 2: Business KPIs (P6) — แยกตาม channel/COD status ─── */}
                {!mockMode && !loading && showContent ? (
                    <div className="mt-5 sm:mt-6">
                        <div className="mb-3 flex items-center gap-2 px-1">
                            <span
                                className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
                                aria-hidden
                            />
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                สรุปรายได้ &amp; สถานะ COD
                            </h3>
                            <span className="text-[10px] text-slate-600">
                                (แยก JMS / Marketplace / Other อัตโนมัติ)
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                            <AnimatedKpiCard
                                index={4}
                                icon={<HandCoins className="h-5 w-5" aria-hidden />}
                                iconBg="bg-emerald-500/15"
                                iconRing="ring-emerald-500/25"
                                iconFg="text-emerald-400"
                                glowColor="bg-emerald-500/40"
                                label="รายได้ค่าส่ง (JMS)"
                                value={metrics.sumTotalFeeJms}
                                prefix="฿"
                                decimals={2}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.sumTotalFeeJms,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint="total_shipping_fee เฉพาะ bucket=jms (เราเก็บเอง)"
                            />

                            <AnimatedKpiCard
                                index={5}
                                icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
                                iconBg="bg-teal-500/15"
                                iconRing="ring-teal-500/25"
                                iconFg="text-teal-400"
                                glowColor="bg-teal-500/40"
                                label="COD เก็บแล้ว"
                                value={metrics.codPaidAmount}
                                prefix="฿"
                                decimals={2}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.codPaidAmount,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint={
                                    <span>
                                        {metrics.codPaidCount.toLocaleString('th-TH')} เคส ·
                                        สถานะ &ldquo;ชำระเงินแล้ว&rdquo;
                                    </span>
                                }
                            />

                            <AnimatedKpiCard
                                index={6}
                                icon={<Hourglass className="h-5 w-5" aria-hidden />}
                                iconBg="bg-orange-500/15"
                                iconRing="ring-orange-500/25"
                                iconFg="text-orange-400"
                                glowColor="bg-orange-500/40"
                                label="COD รอเก็บ"
                                value={metrics.codPendingAmount}
                                prefix="฿"
                                decimals={2}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.codPendingAmount,
                                              previousRangeDays: previousMetrics.range.days,
                                              inverseGood: true,
                                          }
                                        : undefined
                                }
                                hint={
                                    <span>
                                        {metrics.codPendingCount.toLocaleString('th-TH')} เคสค้าง ·
                                        ยังไม่จ่าย
                                    </span>
                                }
                            />

                            <AnimatedKpiCard
                                index={7}
                                icon={<Percent className="h-5 w-5" aria-hidden />}
                                iconBg="bg-indigo-500/15"
                                iconRing="ring-indigo-500/25"
                                iconFg="text-indigo-400"
                                glowColor="bg-indigo-500/40"
                                label="อัตราเก็บ COD"
                                value={metrics.codCollectionRate}
                                suffix="%"
                                decimals={2}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.codCollectionRate,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint={
                                    <span>
                                        {metrics.codPaidCount.toLocaleString('th-TH')} /{' '}
                                        {(
                                            metrics.codPaidCount + metrics.codPendingCount
                                        ).toLocaleString('th-TH')}{' '}
                                        เคส · ไม่เก็บ COD อีก{' '}
                                        {metrics.codNoCollectionCount.toLocaleString('th-TH')}
                                    </span>
                                }
                            />
                        </div>
                    </div>
                ) : null}
            </section>

            {!mockMode ? (
                <div
                    className="xl:grid xl:grid-cols-[minmax(0,1fr)_min(100%,280px)] xl:items-start xl:gap-6"
                    style={{ animation: 'fadeSlideIn 0.5s ease-out 0.3s both' }}
                >
                    <div className="min-w-0">
                        <JtDashboardDailyCharts
                            data={charts}
                            loading={loading}
                            error={chartError}
                            chartsAlignedWithSummaryCards={chartsAlignedWithSummaryCards}
                        />
                    </div>
                    {topSenders.length > 0 ? (
                        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
                            <JtTopSendersPanel rows={topSenders} />
                        </div>
                    ) : null}
                </div>
            ) : null}

            {/* ── Recent Shipments Table ── */}
            <section
                aria-labelledby="recent-heading"
                className="space-y-4"
                style={{ animation: 'fadeSlideIn 0.5s ease-out 0.4s both' }}
            >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 id="recent-heading" className="text-lg font-semibold text-white">
                            รายการล่าสุด
                        </h2>
                        <p className="text-sm text-slate-500">5 รายการล่าสุดตาม booking_date</p>
                    </div>
                    <Link
                        href="/admin/shipments"
                        className="group/link flex items-center gap-1 text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
                    >
                        ดูทั้งหมด
                        <span className="inline-block transition-transform group-hover/link:translate-x-0.5">→</span>
                    </Link>
                </div>

                {loading ? (
                    <TableSkeleton />
                ) : showContent ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900/50 to-slate-950/70 shadow-xl shadow-black/25 ring-1 ring-white/[0.04]">
                        <div className="overflow-x-auto overscroll-x-contain -webkit-overflow-scrolling-touch">
                            <table className="w-full min-w-[580px] text-left text-[13px] sm:text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800/80 bg-slate-950/60 text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500">
                                        <th className="px-3 sm:px-4 py-3 sm:py-3.5 font-semibold">AWB</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-3.5 font-semibold">วันที่จอง</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-3.5 font-semibold">ผู้รับ</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-3.5 font-semibold text-right">ค่าส่ง</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-3.5 font-semibold text-right">COD</th>
                                        <th className="px-3 sm:px-4 py-3 sm:py-3.5 font-semibold">สถานะสแกน</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {recentRows.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-10 text-center text-slate-500"
                                            >
                                                ไม่มีข้อมูลในตาราง
                                            </td>
                                        </tr>
                                    ) : (
                                        recentRows.map((row, idx) => {
                                            const badge = scanStatusPresentation(row.latest_scan_type);
                                            return (
                                                <tr
                                                    key={`${idx}-${strOrDash(row.awb_number)}-${String(row.booking_date ?? '')}`}
                                                    className="jt-row-fade group/row relative transition-colors duration-200 hover:bg-slate-800/25"
                                                    style={{ animationDelay: `${idx * 60 + 200}ms` }}
                                                >
                                                    {/* Left accent bar on hover */}
                                                    <td className="relative whitespace-nowrap px-3 sm:px-4 py-3 sm:py-3.5 font-mono text-[11px] sm:text-xs text-sky-300/95">
                                                        <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-r bg-sky-500/0 transition-all duration-200 group-hover/row:bg-sky-500/80" />
                                                        {strOrDash(row.awb_number)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 sm:px-4 py-3 sm:py-3.5 text-slate-300">
                                                        {formatBookingDateThai(row.booking_date)}
                                                    </td>
                                                    <td className="max-w-[140px] sm:max-w-[200px] truncate px-3 sm:px-4 py-3 sm:py-3.5 text-slate-300">
                                                        {strOrDash(row.receiver_name)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 sm:px-4 py-3 sm:py-3.5 text-right tabular-nums text-slate-200">
                                                        ฿{formatThb(moneyOrZero(row.shipping_fee))}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 sm:px-4 py-3 sm:py-3.5 text-right tabular-nums text-slate-200">
                                                        ฿{formatThb(moneyOrZero(row.cod_amount))}
                                                    </td>
                                                    <td className="px-3 sm:px-4 py-3 sm:py-3.5">
                                                        <span
                                                            className={`inline-flex max-w-full items-center rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-[11px] sm:text-xs font-medium ring-1 transition-all duration-200 ${badge.className}`}
                                                        >
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}
            </section>
        </div>
    );
}
