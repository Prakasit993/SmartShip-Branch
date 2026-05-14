'use client';

import { useEffect, useState } from 'react';

import { AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, Calendar, Check, CheckCircle2, CheckSquare, Clock, Copy, HandCoins, Hourglass, Minus, Package, Percent, RefreshCw, RotateCcw, Search, Truck, X } from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import type { JtCustomMetricCardDefinition } from '@/lib/jtCustomMetricCards';
import type { JtDashboardChartsPayload } from './jtDashboardStatsChartTypes';
import type {
    JtDashboardMetrics,
    JtDashboardPreviousMetrics,
} from './jtDashboardTypes';
import { JtDashboardCustomMetrics } from './JtDashboardCustomMetrics';
import { JtDashboardDailyCharts } from './JtDashboardDailyCharts';
import {
    JtTopProductsPanel,
    JtTopSendersCountPanel,
    JtTopSendersPanel,
    type JtTopProductRow,
    type JtTopSenderCountRow,
    type JtTopSenderRow,
} from './JtTopSendersPanel';
import {
    formatThb,
} from './jtDashboardFormatters';
import { useAnimatedCounter } from './useAnimatedCounter';
import { DEFAULT_JT_SHIPMENT_DETAIL_FIELDS } from '@/lib/jtShipmentDetailFields';

export type JtDashboardViewProps = {
    metrics: JtDashboardMetrics;
    previousMetrics: JtDashboardPreviousMetrics | null;
    /** สถิติรายวันจาก `/api/admin/jt-shipments/stats` — โหมด mock ไม่ใช้ */
    charts: JtDashboardChartsPayload | null;
    chartError: string | null;
    chartsAlignedWithSummaryCards: boolean;
    topSenders: JtTopSenderRow[];
    topSendersCount: JtTopSenderCountRow[];
    topProducts: JtTopProductRow[];
    customMetricDefinitions: JtCustomMetricCardDefinition[];
    customMetrics: Array<{
        id: string;
        title: string;
        subtitle?: string;
        icon: string;
        display: string;
        format: string;
    }>;
    detailFields: string[];
    availableDetailFields: string[];
    onSaveCustomMetricCards: (cards: JtCustomMetricCardDefinition[]) => Promise<void>;
    onSaveDetailFields: (fields: string[]) => Promise<void>;
    onAcknowledgeReturn: (awbNumber: string, reason: string) => Promise<void>;
    showKpiPercentDelta: boolean;
    onToggleKpiPercentDelta: () => void;
    loading: boolean;
    error: string | null;
    parcelDateFrom: string;
    parcelDateTo: string;
    onParcelDateFromChange: (v: string) => void;
    onParcelDateToChange: (v: string) => void;
    onApplyRange: (range?: { from: string; to: string }) => void;
    onRetry?: () => void;
    /** ช่วงวันที่ที่กด "ใช้ช่วงนี้" แล้ว (แสดงใต้การ์ดพัสดุทั้งหมด) */
    appliedRange: { from: string; to: string } | null;
    /** Step 1: แสดงป้ายว่าเป็นข้อมูลจำลอง */
    mockMode?: boolean;
    /** เวลาที่โหลดข้อมูลสำเร็จล่าสุด */
    lastRefreshed?: Date | null;
    /** charts/topSenders ยังโหลดอยู่ (Phase B) — KPI cards แสดงแล้วแต่ charts ยังไม่มา */
    chartsLoading?: boolean;
    /** COD cards ยังโหลดอยู่ (Phase C) — โหลดจาก /cod-summary แยก */
    codLoading?: boolean;
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
    showDelta = true,
    onClick,
    isActive,
    className,
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
    showDelta?: boolean;
    onClick?: () => void;
    isActive?: boolean;
    /** เช่น `h-full` เมื่ออยู่ในกริดที่ต้องการความสูงเท่ากัน */
    className?: string;
}) {
    const animated = useAnimatedCounter(value, { duration: 900, decimals: decimals ?? 0 });
    const formatted = (decimals ?? 0) > 0
        ? animated.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
        : animated.toLocaleString('th-TH');

    return (
        <article
            className={`group relative flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900/60 via-slate-900/50 to-slate-950/80 p-4 sm:p-5 shadow-lg shadow-black/20 ring-1 backdrop-blur-sm transition-all duration-300 ${
                onClick
                    ? `cursor-pointer ${
                          isActive
                              ? 'border-sky-500/60 ring-sky-500/35 shadow-sky-900/20'
                              : 'border-slate-800/80 ring-white/[0.06] hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5'
                      }`
                    : 'border-slate-800/80 ring-white/[0.06] hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5'
            }${className ? ` ${className}` : ''}`}
            style={{
                animation: `fadeSlideIn 0.5s ease-out ${index * 80}ms both`,
            }}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            aria-pressed={onClick ? Boolean(isActive) : undefined}
            onClick={onClick}
            onKeyDown={
                onClick
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onClick();
                          }
                      }
                    : undefined
            }
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
            {showDelta && delta ? (
                <DeltaBadge
                    current={value}
                    previous={delta.previous}
                    previousRangeDays={delta.previousRangeDays}
                    inverseGood={delta.inverseGood}
                />
            ) : null}
            {hint ? (
                <div className="mt-auto pt-1.5 text-[10px] sm:pt-2 sm:text-[11px] leading-snug text-slate-500">
                    {hint}
                </div>
            ) : null}
        </article>
    );
}

function SummaryCardSkeleton() {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/40 to-slate-950/60 p-5 shadow-inner ring-1 ring-white/[0.03]">
            <div
                className="pointer-events-none absolute inset-y-0 left-0 w-[55%] animate-[jtDashShimmer_1.85s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
                aria-hidden
            />
            <div className="relative mb-4 h-11 w-11 rounded-xl bg-slate-800/80" />
            <div className="relative mb-2 h-3 w-24 rounded bg-slate-800/60" />
            <div className="relative h-8 w-28 rounded bg-slate-800/50" />
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

type DateRangePreset = 'today' | 'last7' | 'last14' | 'last30' | 'thisMonth';

function getPresetDateRange(preset: DateRangePreset): { from: string; to: string } {
    const today = new Date();
    if (preset === 'today') {
        const value = toLocalYmd(today);
        return { from: value, to: value };
    }
    if (preset === 'last7') {
        return { from: toLocalYmd(addLocalDays(today, -6)), to: toLocalYmd(today) };
    }
    if (preset === 'last14') {
        return { from: toLocalYmd(addLocalDays(today, -13)), to: toLocalYmd(today) };
    }
    if (preset === 'last30') {
        return { from: toLocalYmd(addLocalDays(today, -29)), to: toLocalYmd(today) };
    }
    return { from: toLocalYmd(new Date(today.getFullYear(), today.getMonth(), 1)), to: toLocalYmd(today) };
}

/**
 * โครง UI หลักของแดชบอร์ด J&T — พื้นหลังเข้ม slate-950/900 ตามธีมแอดมิน
 * (Sidebar / ภาษา TH|EN อยู่ที่ layout แม่ — ไม่ซ้ำในไฟล์นี้)
 */
export function JtDashboardView({
    metrics,
    previousMetrics,
    charts,
    chartError,
    chartsAlignedWithSummaryCards,
    topSenders,
    topSendersCount,
    topProducts,
    customMetricDefinitions,
    customMetrics,
    detailFields,
    availableDetailFields,
    onSaveCustomMetricCards,
    onSaveDetailFields,
    onAcknowledgeReturn,
    showKpiPercentDelta,
    onToggleKpiPercentDelta,
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
    chartsLoading,
    codLoading,
}: JtDashboardViewProps) {
    const [showAllIssues, setShowAllIssues] = useState(false);
    const [showAllReturns, setShowAllReturns] = useState(false);
    const [activeDrilldown, setActiveDrilldown] = useState<'exception' | 'return' | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailAwb, setDetailAwb] = useState('');
    const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
    const [editableDetailFields, setEditableDetailFields] = useState<string[]>(detailFields);
    const [savingDetailFields, setSavingDetailFields] = useState(false);
    const [detailFieldsErr, setDetailFieldsErr] = useState<string | null>(null);
    const [showFieldChooser, setShowFieldChooser] = useState(false);
    const [awbQuickSearch, setAwbQuickSearch] = useState('');
    const [ackReturnAwb, setAckReturnAwb] = useState('');
    const [ackReason, setAckReason] = useState('');
    const [ackLoading, setAckLoading] = useState(false);
    const [ackError, setAckError] = useState<string | null>(null);
    const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);
    const showContent = !loading && !error;
    const dateRangeError =
        parcelDateFrom && parcelDateTo && parcelDateFrom > parcelDateTo
            ? 'วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด'
            : null;
    const hasDateDraft = Boolean(parcelDateFrom || parcelDateTo);
    const appliedFrom = appliedRange?.from ?? '';
    const appliedTo = appliedRange?.to ?? '';
    const dateDraftChanged = parcelDateFrom !== appliedFrom || parcelDateTo !== appliedTo;
    const fieldLabelMap = new Map(
        availableDetailFields.map((key) => [
            key,
            key
                .split('_')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(' '),
        ]),
    );

    useEffect(() => {
        if (!savingDetailFields) {
            setEditableDetailFields(detailFields);
        }
    }, [detailFields, savingDetailFields]);

    async function openShipmentDetail(awb: string) {
        const value = awb.trim();
        if (!value) return;
        setDetailAwb(value);
        setDetailModalOpen(true);
        setDetailLoading(true);
        setDetailError(null);
        setDetailData(null);
        try {
            const res = await fetch(`/api/admin/jt-shipments/by-awb?awb=${encodeURIComponent(value)}`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            const raw = await res.text();
            let payload: { data?: Record<string, unknown>; error?: string } = {};
            try {
                payload = JSON.parse(raw) as typeof payload;
            } catch {
                throw new Error('รูปแบบข้อมูลไม่ถูกต้อง');
            }
            if (!res.ok) throw new Error(payload.error || 'โหลดรายละเอียดพัสดุไม่สำเร็จ');
            setDetailData(payload.data ?? null);
        } catch (e) {
            setDetailError(e instanceof Error ? e.message : 'โหลดรายละเอียดพัสดุไม่สำเร็จ');
        } finally {
            setDetailLoading(false);
        }
    }

    async function copyAwb(awb: string) {
        const value = awb.trim();
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedAwb(value);
            setCopyMessage(`คัดลอก AWB ${value} แล้ว`);
            window.setTimeout(() => {
                setCopiedAwb((prev) => (prev === value ? null : prev));
            }, 1800);
            window.setTimeout(() => setCopyMessage(null), 2200);
        } catch {
            setCopyMessage('คัดลอกไม่สำเร็จ กรุณาลองใหม่');
            window.setTimeout(() => setCopyMessage(null), 2200);
        }
    }

    async function copyAwbList(awbs: string[]) {
        const clean = awbs.map((x) => x.trim()).filter(Boolean);
        if (clean.length === 0) return;
        try {
            await navigator.clipboard.writeText(clean.join('\n'));
            setCopyMessage(`คัดลอก AWB ${clean.length.toLocaleString('th-TH')} รายการแล้ว`);
            window.setTimeout(() => setCopyMessage(null), 2500);
        } catch {
            setCopyMessage('คัดลอกชุด AWB ไม่สำเร็จ');
            window.setTimeout(() => setCopyMessage(null), 2200);
        }
    }

    function toggleDetailField(key: string) {
        setDetailFieldsErr(null);
        setEditableDetailFields((prev) => {
            const has = prev.includes(key);
            if (has) {
                return prev.filter((x) => x !== key);
            }
            return [...prev, key];
        });
    }

    async function saveDetailFields() {
        setSavingDetailFields(true);
        setDetailFieldsErr(null);
        try {
            await onSaveDetailFields(editableDetailFields);
        } catch (e) {
            setDetailFieldsErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
        } finally {
            setSavingDetailFields(false);
        }
    }

    function applyPreset(mode: 'default' | 'all') {
        const all = availableDetailFields;
        if (mode === 'all') {
            setEditableDetailFields(all);
            return;
        }
        setEditableDetailFields([...DEFAULT_JT_SHIPMENT_DETAIL_FIELDS]);
    }

    function openReturnAcknowledgement(awb: string) {
        setAckReturnAwb(awb);
        setAckReason('');
        setAckError(null);
    }

    async function submitReturnAcknowledgement() {
        const awb = ackReturnAwb.trim();
        const reason = ackReason.trim();
        if (!awb || ackLoading) return;
        if (!reason) {
            setAckError('กรุณาใส่เหตุผลที่รับทราบ');
            return;
        }
        setAckLoading(true);
        setAckError(null);
        try {
            await onAcknowledgeReturn(awb, reason);
            setAckReturnAwb('');
            setAckReason('');
        } catch (e) {
            setAckError(e instanceof Error ? e.message : 'บันทึกการรับทราบไม่สำเร็จ');
        } finally {
            setAckLoading(false);
        }
    }

    function applyDatePreset(preset: DateRangePreset) {
        const next = getPresetDateRange(preset);
        onParcelDateFromChange(next.from);
        onParcelDateToChange(next.to);
        onApplyRange(next);
    }

    function clearDateRange() {
        onParcelDateFromChange('');
        onParcelDateToChange('');
        onApplyRange({ from: '', to: '' });
    }

    return (
        <div className="min-w-0 space-y-5 pb-2 sm:space-y-6 sm:pb-0 lg:space-y-8">
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
                @keyframes jtDashShimmer {
                    0% {
                        transform: translateX(-120%);
                    }
                    100% {
                        transform: translateX(280%);
                    }
                }
            `}</style>

            <AdminPageHeader
                title="แดชบอร์ดขนส่ง"
                description={
                    mockMode
                        ? 'ตัวอย่างหน้าสรุปข้อมูลขนส่งจากตาราง jt_shipments'
                        : 'พัสดุ ยอด COD และเรื่องที่ต้องติดตาม — สอดคล้องรายงาน JMS'
                }
                titleLeft={
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
                        <Truck className="h-5 w-5" aria-hidden />
                    </span>
                }
                tone="dark"
                meta={
                    mockMode ? (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
                            Mock UI
                        </span>
                    ) : (
                        <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/30">
                            JMS · JT
                        </span>
                    )
                }
                actions={
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {lastRefreshed ? (
                            <span
                                className="inline-flex max-w-full items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-slate-400 backdrop-blur-sm"
                                title={lastRefreshed.toLocaleString('th-TH')}
                            >
                                <Clock className="h-3.5 w-3.5 shrink-0 text-sky-400/90" aria-hidden />
                                <span className="hidden min-[380px]:inline">อัปเดตล่าสุด · </span>
                                {formatTimeAgo(lastRefreshed)}
                            </span>
                        ) : null}
                        {onRetry ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                disabled={loading}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-600/90 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm ring-1 ring-white/[0.04] transition hover:border-sky-500/45 hover:bg-sky-500/10 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                                <RefreshCw
                                    className={`h-3.5 w-3.5 shrink-0 ${loading ? 'animate-spin' : ''}`}
                                    aria-hidden
                                />
                                โหลดใหม่
                            </button>
                        ) : null}
                    </div>
                }
            />

            <section
                className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/35 p-4 ring-1 ring-white/[0.04] backdrop-blur-sm sm:p-5"
                aria-label="การเปรียบเทียบ KPI"
            >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25">
                            <Percent className="h-5 w-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">เปรียบเทียบกับช่วงก่อนหน้า</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                ค่าเริ่มต้นซ่อน % ใต้การ์ด KPI — เปิดเมื่อต้องการดูการเปลี่ยนแปลงเทียบช่วงเวลาเดียวกัน
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-pressed={showKpiPercentDelta}
                        onClick={onToggleKpiPercentDelta}
                        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 px-4 py-2.5 text-[11px] font-semibold text-slate-200 transition-colors hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-100 sm:w-auto"
                    >
                        <Percent className="h-3.5 w-3.5" aria-hidden />
                        {showKpiPercentDelta ? 'ซ่อน % เปรียบเทียบ' : 'แสดง % เปรียบเทียบ'}
                    </button>
                </div>
            </section>

            {error ? (
                <div
                    role="alert"
                    className="flex flex-col gap-4 rounded-2xl border border-red-500/35 bg-gradient-to-br from-red-950/50 to-red-950/25 px-4 py-5 shadow-lg shadow-red-950/20 ring-1 ring-red-500/20 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
                    style={{ animation: 'fadeSlideIn 0.4s ease-out' }}
                >
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-300 ring-1 ring-red-500/35">
                            <AlertCircle className="h-5 w-5" aria-hidden />
                        </span>
                        <div>
                            <p className="font-semibold text-red-100">โหลดข้อมูลไม่สำเร็จ</p>
                            <p className="mt-1 text-sm leading-relaxed text-red-200/90">{error}</p>
                        </div>
                    </div>
                    {onRetry ? (
                        <button
                            type="button"
                            onClick={onRetry}
                            className="group/retry shrink-0 rounded-xl bg-red-600/90 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-950/40 ring-1 ring-red-400/30 transition hover:bg-red-500"
                        >
                            <RefreshCw className="mr-2 inline-block h-3.5 w-3.5 transition-transform group-hover/retry:rotate-180" aria-hidden />
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
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!dateRangeError) onApplyRange();
                    }}
                    className="mb-4 sm:mb-5 rounded-2xl border border-slate-800/70 bg-gradient-to-r from-slate-900/50 via-slate-900/40 to-slate-950/60 p-3 sm:p-4 ring-1 ring-white/[0.04]"
                    style={{ animation: 'fadeSlideIn 0.4s ease-out' }}
                >
                    <div className="flex flex-col gap-4 xl:grid xl:grid-cols-12 xl:items-end xl:gap-x-4 xl:gap-y-3">
                        <div className="flex min-w-0 items-start gap-3 xl:col-span-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25">
                                <Calendar className="h-4 w-4" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-400">
                                    กรองตามวันที่จองพัสดุ
                                </p>
                                <p className="mt-0.5 hidden text-[10px] leading-snug text-slate-600 sm:block sm:text-[11px]">
                                    {mockMode
                                        ? 'โหมดตัวอย่าง: ไม่เรียก API จริง'
                                        : 'ใช้วันที่จองพัสดุเป็นเกณฑ์ · เว้นว่างเพื่อดูทั้งหมด'}
                                </p>
                                {appliedRange && (appliedRange.from || appliedRange.to) ? (
                                    <p className="mt-1 text-[11px] font-medium text-sky-300">
                                        กำลังดูช่วง: {appliedRange.from || 'ไม่กำหนด'} ถึง {appliedRange.to || 'ไม่กำหนด'}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:col-span-5 xl:grid-cols-2 xl:gap-3">
                            <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-400">
                                <span className="text-[10px] font-medium text-slate-500">วันที่เริ่มต้น</span>
                                <input
                                    type="date"
                                    value={parcelDateFrom}
                                    onChange={(e) => onParcelDateFromChange(e.target.value)}
                                    max={parcelDateTo || undefined}
                                    className={`min-h-[44px] w-full rounded-xl border bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/40 transition-all focus:ring-2 hover:border-slate-600 sm:min-h-0 ${
                                        dateRangeError
                                            ? 'border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/30'
                                            : 'border-slate-700/80 focus:border-sky-500/50'
                                    }`}
                                />
                            </label>
                            <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-400">
                                <span className="text-[10px] font-medium text-slate-500">วันที่สิ้นสุด</span>
                                <input
                                    type="date"
                                    value={parcelDateTo}
                                    onChange={(e) => onParcelDateToChange(e.target.value)}
                                    min={parcelDateFrom || undefined}
                                    className={`min-h-[44px] w-full rounded-xl border bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/40 transition-all focus:ring-2 hover:border-slate-600 sm:min-h-0 ${
                                        dateRangeError
                                            ? 'border-rose-500/60 focus:border-rose-400 focus:ring-rose-500/30'
                                            : 'border-slate-700/80 focus:border-sky-500/50'
                                    }`}
                                />
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 xl:col-span-4 xl:justify-end">
                            {[
                                { key: 'today', label: 'วันนี้' },
                                { key: 'last7', label: '7 วัน' },
                                { key: 'last14', label: '14 วัน' },
                                { key: 'last30', label: '30 วัน' },
                                { key: 'thisMonth', label: 'เดือนนี้' },
                            ].map((preset) => (
                                <button
                                    key={preset.key}
                                    type="button"
                                    disabled={loading}
                                    onClick={() => applyDatePreset(preset.key as DateRangePreset)}
                                    className="min-h-[36px] rounded-full border border-slate-700/80 bg-slate-950/50 px-3 text-[11px] font-semibold text-slate-300 transition-colors hover:border-sky-500/45 hover:bg-sky-500/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {preset.label}
                                </button>
                            ))}
                            <button
                                type="button"
                                disabled={loading || !hasDateDraft}
                                onClick={clearDateRange}
                                className="flex min-h-[36px] items-center gap-1 rounded-full border border-slate-700/80 bg-slate-950/50 px-3 text-[11px] font-semibold text-slate-400 transition-colors hover:border-slate-500 hover:bg-slate-800/70 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <X className="h-3 w-3" aria-hidden />
                                ล้างวันที่
                            </button>
                            <button
                                type="submit"
                                disabled={loading || Boolean(dateRangeError)}
                                className="group/btn flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all hover:from-sky-500 hover:to-sky-400 hover:shadow-sky-800/40 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] min-[420px]:w-auto sm:min-h-0 lg:min-w-[9.5rem]"
                            >
                                <Search className="h-3.5 w-3.5 transition-transform group-hover/btn:scale-110" aria-hidden />
                                <span className="hidden sm:inline">{dateDraftChanged ? 'ใช้ช่วงนี้' : 'กรองข้อมูล'}</span>
                                <span className="sm:hidden">กรอง</span>
                            </button>
                        </div>
                    </div>

                    {dateRangeError ? (
                        <p className="mt-2 text-[11px] font-medium text-rose-300">{dateRangeError}</p>
                    ) : null}
                </form>

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
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
                                label="จำนวนพัสดุ"
                                value={metrics.totalParcels}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.count,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                showDelta={showKpiPercentDelta}
                                hint={
                                    appliedRange && (appliedRange.from || appliedRange.to) ? (
                                        <span className="text-sky-400/90">
                                            ช่วงวันที่: {appliedRange.from || '…'} ถึง {appliedRange.to || '…'}
                                        </span>
                                    ) : (
                                        <span className="text-slate-600">ข้อมูลทั้งหมด ไม่จำกัดวันที่</span>
                                    )
                                }
                            />

                            <AnimatedKpiCard
                                index={1}
                                icon={<CheckSquare className="h-5 w-5" aria-hidden />}
                                iconBg="bg-indigo-500/15"
                                iconRing="ring-indigo-500/25"
                                iconFg="text-indigo-400"
                                glowColor="bg-indigo-500/40"
                                label="ปิดงานแล้ว"
                                value={metrics.closedCount}
                                hint={
                                    <span>
                                        จากทั้งหมด {metrics.totalParcels.toLocaleString('th-TH')} ชิ้น ·
                                        ยังไม่ปิดงาน {(metrics.totalParcels - metrics.closedCount).toLocaleString('th-TH')} ชิ้น
                                    </span>
                                }
                            />

                            <AnimatedKpiCard
                                index={2}
                                icon={<HandCoins className="h-5 w-5" aria-hidden />}
                                iconBg="bg-emerald-500/15"
                                iconRing="ring-emerald-500/25"
                                iconFg="text-emerald-400"
                                glowColor="bg-emerald-500/40"
                                label="ค่าจัดส่งรวม"
                                value={metrics.sumTotalShippingFee ?? metrics.sumTotalFeeJms}
                                prefix="฿"
                                decimals={2}
                                showDelta={showKpiPercentDelta}
                                delta={
                                    previousMetrics && previousMetrics.sumTotalShippingFee !== undefined
                                        ? {
                                              previous: previousMetrics.sumTotalShippingFee,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint="รวมค่าส่งทั้งหมดในช่วงที่เลือก"
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
                                className={`inline-block h-1.5 w-1.5 rounded-full ${codLoading ? 'bg-slate-600 animate-pulse' : 'bg-emerald-400'}`}
                                aria-hidden
                            />
                            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                รายได้และสถานะเก็บเงินปลายทาง
                            </h3>
                            <span className="text-[10px] text-slate-600">
                                แยกช่องทาง JMS / Marketplace / อื่นๆ ให้อัตโนมัติ
                            </span>
                            {codLoading ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                                    <span className="inline-block h-2 w-2 animate-spin rounded-full border border-slate-500 border-t-transparent" />
                                    กำลังโหลด...
                                </span>
                            ) : null}
                        </div>
                        <div className="space-y-3 sm:space-y-4">
                        {codLoading ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                                {[...Array(4)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse rounded-2xl border border-white/[0.06] bg-slate-900/60 p-4 sm:p-5"
                                    >
                                        <div className="mb-3 flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-white/[0.06]" />
                                            <div className="h-3 w-24 rounded bg-white/[0.06]" />
                                        </div>
                                        <div className="mb-2 h-7 w-32 rounded bg-white/[0.08]" />
                                        <div className="h-2.5 w-40 rounded bg-white/[0.05]" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                            <AnimatedKpiCard
                                index={4}
                                icon={<Banknote className="h-5 w-5" aria-hidden />}
                                iconBg="bg-amber-500/15"
                                iconRing="ring-amber-500/25"
                                iconFg="text-amber-400"
                                glowColor="bg-amber-500/40"
                                label="ยอด COD ทั้งหมด"
                                value={metrics.sumCod}
                                prefix="฿"
                                decimals={2}
                                showDelta={showKpiPercentDelta}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.sumCod,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint="รวมยอดเก็บเงินปลายทางในช่วงที่เลือก"
                            />

                            <AnimatedKpiCard
                                index={5}
                                icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
                                iconBg="bg-teal-500/15"
                                iconRing="ring-teal-500/25"
                                iconFg="text-teal-400"
                                glowColor="bg-teal-500/40"
                                label="COD ชำระแล้ว"
                                value={metrics.codPaidAmount}
                                prefix="฿"
                                decimals={2}
                                showDelta={showKpiPercentDelta}
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
                                        ชำระเงินแล้ว
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
                                label="COD ค้างชำระ"
                                value={metrics.codPendingAmount}
                                prefix="฿"
                                decimals={2}
                                showDelta={showKpiPercentDelta}
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
                                        {metrics.codPendingCount.toLocaleString('th-TH')} เคส ·
                                        ยังรอชำระ
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
                                label="อัตราชำระ COD"
                                value={metrics.codCollectionRate}
                                suffix="%"
                                decimals={2}
                                showDelta={showKpiPercentDelta}
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
                                        เคส · ไม่มี COD{' '}
                                        {metrics.codNoCollectionCount.toLocaleString('th-TH')}
                                    </span>
                                }
                            />
                        </div>
                        )}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 xl:items-stretch">
                            <AnimatedKpiCard
                                index={8}
                                className="h-full"
                                icon={<RotateCcw className="h-5 w-5" aria-hidden />}
                                iconBg="bg-rose-500/15"
                                iconRing="ring-rose-500/25"
                                iconFg="text-rose-400"
                                glowColor="bg-rose-500/40"
                                label="พัสดุถูกตีกลับ"
                                value={metrics.returnCount}
                                showDelta={showKpiPercentDelta}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.returnCount,
                                              previousRangeDays: previousMetrics.range.days,
                                              inverseGood: true,
                                          }
                                        : undefined
                                }
                                hint={'นับจากรายการที่มีสถานะตีกลับ'}
                                onClick={() =>
                                    setActiveDrilldown((prev) => (prev === 'return' ? null : 'return'))
                                }
                                isActive={activeDrilldown === 'return'}
                            />

                            <AnimatedKpiCard
                                index={9}
                                className="h-full"
                                icon={<AlertCircle className="h-5 w-5" aria-hidden />}
                                iconBg="bg-rose-500/15"
                                iconRing="ring-rose-500/25"
                                iconFg="text-rose-300"
                                glowColor="bg-rose-500/40"
                                label="พัสดุมีปัญหา"
                                value={metrics.exceptionCount}
                                showDelta={showKpiPercentDelta}
                                delta={
                                    previousMetrics
                                        ? {
                                              previous: previousMetrics.exceptionCount,
                                              previousRangeDays: previousMetrics.range.days,
                                              inverseGood: true,
                                          }
                                        : undefined
                                }
                                hint={
                                    metrics.topExceptionCases.length > 0 ? (
                                        <span>
                                            {metrics.topExceptionCases[0]?.exception_reason || '-'}
                                        </span>
                                    ) : (
                                        'นับเฉพาะรายการที่ยังไม่มีรหัสสาขาปลายทาง'
                                    )
                                }
                                onClick={() =>
                                    setActiveDrilldown((prev) => (prev === 'exception' ? null : 'exception'))
                                }
                                isActive={activeDrilldown === 'exception'}
                            />

                            <article
                                className="group relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/60 via-slate-900/50 to-slate-950/80 p-4 sm:p-5 shadow-lg shadow-black/20 ring-1 ring-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
                                style={{ animation: `fadeSlideIn 0.5s ease-out ${10 * 80}ms both` }}
                            >
                                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-cyan-500/40 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
                                <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-cyan-500/40 opacity-20 blur-2xl" />

                                <div className="relative mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/25 transition-transform duration-300 group-hover:scale-110 sm:mb-4 sm:h-11 sm:w-11">
                                    <Search className="h-5 w-5" aria-hidden />
                                </div>
                                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                    ค้นหาเลขพัสดุ
                                </p>

                                <form
                                    className="mt-1.5 flex min-w-0 flex-1 flex-col gap-2 sm:mt-2"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void openShipmentDetail(awbQuickSearch);
                                    }}
                                >
                                    <label htmlFor="jt-awb-quick-search" className="sr-only">
                                        เลขพัสดุ AWB
                                    </label>
                                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                                        <input
                                            id="jt-awb-quick-search"
                                            type="text"
                                            value={awbQuickSearch}
                                            onChange={(e) => setAwbQuickSearch(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            placeholder="พิมพ์เลข AWB..."
                                            autoComplete="off"
                                            className="h-11 min-h-0 w-full min-w-0 flex-1 rounded-xl border border-slate-700/90 bg-slate-950/85 px-3 text-sm tabular-nums text-white shadow-inner outline-none ring-cyan-500/25 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/25 sm:h-10"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!awbQuickSearch.trim()}
                                            className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 text-sm font-semibold text-white shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500/30 transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:px-4"
                                        >
                                            <Search className="h-4 w-4 opacity-90" aria-hidden />
                                            ค้นหา
                                        </button>
                                    </div>
                                </form>
                                <p className="mt-auto pt-2 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
                                    กด Enter หรือปุ่มค้นหาเพื่อดูรายละเอียด
                                </p>
                            </article>
                        </div>
                        </div>
                        {activeDrilldown === 'exception' ? (
                            <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/45 p-3 ring-1 ring-white/[0.03]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        รายการพัสดุมีปัญหา (ยังไม่มีรหัสสาขาปลายทาง)
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void copyAwbList(
                                                (showAllIssues ? metrics.topExceptionCases : metrics.topExceptionCases.slice(0, 3)).map(
                                                    (r) => r.awb_number,
                                                ),
                                            )
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                                    >
                                        <Copy className="h-3.5 w-3.5" aria-hidden />
                                        คัดลอก AWB ทั้งชุด
                                    </button>
                                </div>
                                {metrics.topExceptionCases.length > 0 ? (
                                    <>
                                        <div className="mt-2 space-y-1.5 overflow-x-auto">
                                            <div className="grid min-w-[940px] grid-cols-[1.6rem_1fr_1.1fr_1fr_1.7fr_1fr] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                <span>#</span>
                                                <span>เลขพัสดุ</span>
                                                <span>ผู้ส่ง</span>
                                                <span>เบอร์ติดต่อ</span>
                                                <span>เหตุผล</span>
                                                <span className="text-right">เวลา</span>
                                            </div>
                                            {(showAllIssues ? metrics.topExceptionCases : metrics.topExceptionCases.slice(0, 3)).map((r, idx) => (
                                                <div
                                                    key={`${r.awb_number}-${idx}`}
                                                    className="grid min-w-[940px] grid-cols-[1.6rem_1fr_1.1fr_1fr_1.7fr_1fr] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]"
                                                >
                                                    <span className="tabular-nums text-slate-500">{idx + 1}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyAwb(r.awb_number)}
                                                        onDoubleClick={() => void openShipmentDetail(r.awb_number)}
                                                        className="inline-flex min-w-0 items-center gap-1 truncate text-left text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
                                                        title={`คลิกเพื่อคัดลอก • ดับเบิลคลิกเพื่อเปิดรายละเอียด ${r.awb_number}`}
                                                    >
                                                        {r.awb_number}
                                                        {copiedAwb === r.awb_number ? (
                                                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                                                        )}
                                                    </button>
                                                    <span className="min-w-0 truncate text-slate-300" title={r.sender_name}>
                                                        {r.sender_name}
                                                    </span>
                                                    <span className="min-w-0 truncate tabular-nums text-slate-400" title={r.receiver_phone}>
                                                        {r.receiver_phone}
                                                    </span>
                                                    <span className="min-w-0 truncate text-rose-200" title={r.exception_reason}>
                                                        {r.exception_reason}
                                                    </span>
                                                    <span className="min-w-0 truncate text-right tabular-nums text-slate-400" title={r.issue_registered_time ?? '-'}>
                                                        {r.issue_registered_time && r.issue_registered_time !== '-' ? r.issue_registered_time.slice(0, 16) : '-'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {metrics.topExceptionCases.length > 3 ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllIssues(!showAllIssues)}
                                                className="mt-2 w-full rounded-lg bg-slate-900/50 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-300 ring-1 ring-white/[0.04]"
                                            >
                                                {showAllIssues ? 'แสดงน้อยลง' : `ดูเพิ่มเติมอีก ${metrics.topExceptionCases.length - 3} รายการ`}
                                            </button>
                                        ) : null}
                                    </>
                                ) : (
                                    <p className="mt-2 text-xs text-slate-500">
                                        ยังไม่พบรายการที่มีเหตุผลปัญหาและยังไม่มีรหัสสาขาปลายทางในช่วงนี้
                                    </p>
                                )}
                            </div>
                        ) : null}
                        {activeDrilldown === 'return' ? (
                            <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/45 p-3 ring-1 ring-white/[0.03]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        รายการพัสดุถูกตีกลับ (ตัดรายการที่รับทราบแล้ว)
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void copyAwbList(
                                                (showAllReturns ? metrics.topReturnTypeCases : metrics.topReturnTypeCases.slice(0, 3)).map(
                                                    (r) => r.awb_number,
                                                ),
                                            )
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                                    >
                                        <Copy className="h-3.5 w-3.5" aria-hidden />
                                        คัดลอก AWB ทั้งชุด
                                    </button>
                                </div>
                                {metrics.topReturnTypeCases.length > 0 ? (
                                    <>
                                        <div className="mt-2 space-y-1.5 overflow-x-auto">
                                            <div className="grid min-w-[1040px] grid-cols-[1.6rem_1fr_1.1fr_1fr_1.7fr_1fr_6rem] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                <span>#</span>
                                                <span>เลขพัสดุ</span>
                                                <span>ผู้ส่ง</span>
                                                <span>เบอร์ติดต่อ</span>
                                                <span>เหตุผล</span>
                                                <span className="text-right">เวลา</span>
                                                <span className="text-right">จัดการ</span>
                                            </div>
                                            {(showAllReturns ? metrics.topReturnTypeCases : metrics.topReturnTypeCases.slice(0, 3)).map((r, idx) => (
                                                <div
                                                    key={`${r.awb_number}-${idx}`}
                                                    className="grid min-w-[1040px] grid-cols-[1.6rem_1fr_1.1fr_1fr_1.7fr_1fr_6rem] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]"
                                                >
                                                    <span className="tabular-nums text-slate-500">{idx + 1}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyAwb(r.awb_number)}
                                                        onDoubleClick={() => void openShipmentDetail(r.awb_number)}
                                                        className="inline-flex min-w-0 items-center gap-1 truncate text-left text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
                                                        title={`คลิกเพื่อคัดลอก • ดับเบิลคลิกเพื่อเปิดรายละเอียด ${r.awb_number}`}
                                                    >
                                                        {r.awb_number}
                                                        {copiedAwb === r.awb_number ? (
                                                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                                                        )}
                                                    </button>
                                                    <span className="min-w-0 truncate text-slate-300" title={r.sender_name}>
                                                        {r.sender_name}
                                                    </span>
                                                    <span className="min-w-0 truncate tabular-nums text-slate-400" title={r.receiver_phone}>
                                                        {r.receiver_phone}
                                                    </span>
                                                    <span className="min-w-0 truncate text-rose-200" title={r.exception_reason}>
                                                        {r.exception_reason}
                                                    </span>
                                                    <span className="min-w-0 truncate text-slate-400 text-right tabular-nums" title={r.issue_registered_time ?? '-'}>
                                                        {r.issue_registered_time && r.issue_registered_time !== '-' ? r.issue_registered_time.slice(0, 16) : '-'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => openReturnAcknowledgement(r.awb_number)}
                                                        className="justify-self-end rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/20"
                                                    >
                                                        รับทราบ
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        {metrics.topReturnTypeCases.length > 3 ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllReturns(!showAllReturns)}
                                                className="mt-2 w-full rounded-lg bg-slate-900/50 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-300 ring-1 ring-white/[0.04]"
                                            >
                                                {showAllReturns ? 'แสดงน้อยลง' : `ดูเพิ่มเติมอีก ${metrics.topReturnTypeCases.length - 3} รายการ`}
                                            </button>
                                        ) : null}
                                    </>
                                ) : (
                                    <p className="mt-2 text-xs text-slate-500">
                                        ยังไม่พบรายการพัสดุตีกลับที่ยังไม่ได้รับทราบในช่วงนี้
                                    </p>
                                )}
                            </div>
                        ) : null}
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
                            loading={chartsLoading ?? loading}
                            error={chartError}
                            chartsAlignedWithSummaryCards={chartsAlignedWithSummaryCards}
                        />
                    </div>
                    {topSenders.length > 0 || topSendersCount.length > 0 || topProducts.length > 0 ? (
                        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
                            <div className="space-y-4">
                                {topSenders.length > 0 ? <JtTopSendersPanel rows={topSenders} /> : null}
                                {topSendersCount.length > 0 ? (
                                    <JtTopSendersCountPanel rows={topSendersCount} />
                                ) : null}
                                {topProducts.length > 0 ? <JtTopProductsPanel rows={topProducts} /> : null}
                            </div>
                        </div>
                    ) : chartsLoading ? (
                        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
                            <div className="space-y-4">
                                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 animate-pulse">
                                    <div className="h-4 w-32 rounded bg-white/10 mb-3" />
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="flex items-center justify-between py-1.5">
                                            <div className="h-3 w-24 rounded bg-white/10" />
                                            <div className="h-3 w-16 rounded bg-white/10" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            {ackReturnAwb ? (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="jt-return-ack-title"
                >
                    <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl ring-1 ring-white/10">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                            <h3 id="jt-return-ack-title" className="text-lg font-semibold text-white">
                                รับทราบพัสดุตีกลับ
                            </h3>
                            <button
                                type="button"
                                disabled={ackLoading}
                                onClick={() => setAckReturnAwb('')}
                                className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                            >
                                ปิด
                            </button>
                        </div>
                        <div className="space-y-3 px-4 py-4">
                            <p className="text-sm text-slate-300">
                                เลขพัสดุ <span className="font-semibold text-sky-300">{ackReturnAwb}</span> จะไม่แสดงในรายการตีกลับอีกหลังบันทึก
                            </p>
                            <label className="block">
                                <span className="text-xs font-medium text-slate-400">เหตุผลที่รับทราบ</span>
                                <textarea
                                    value={ackReason}
                                    onChange={(e) => setAckReason(e.target.value)}
                                    rows={4}
                                    maxLength={500}
                                    placeholder="เช่น ตรวจสอบแล้วเป็นรายการที่ดำเนินการเรียบร้อย"
                                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-emerald-500/25 placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2"
                                />
                            </label>
                            {ackError ? <p className="text-sm text-rose-400">{ackError}</p> : null}
                            <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                                <button
                                    type="button"
                                    disabled={ackLoading}
                                    onClick={() => setAckReturnAwb('')}
                                    className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    disabled={ackLoading || !ackReason.trim()}
                                    onClick={() => void submitReturnAcknowledgement()}
                                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {ackLoading ? 'กำลังบันทึก...' : 'บันทึกรับทราบ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {detailModalOpen ? (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="jt-awb-detail-title"
                >
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl ring-1 ring-white/10">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                            <h3 id="jt-awb-detail-title" className="text-lg font-semibold text-white">
                                รายละเอียดพัสดุ {detailAwb}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setDetailModalOpen(false)}
                                className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
                            >
                                ปิด
                            </button>
                        </div>
                        <div className="space-y-3 px-4 py-4">
                            {detailLoading ? (
                                <p className="text-sm text-slate-400">กำลังโหลดข้อมูล...</p>
                            ) : detailError ? (
                                <p className="text-sm text-rose-400">{detailError}</p>
                            ) : detailData ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {editableDetailFields.map((key) => (
                                        <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                {fieldLabelMap.get(key) ?? key}
                                            </p>
                                            <p className="mt-1 break-words text-sm text-slate-200">
                                                {(() => {
                                                    const value = detailData[key];
                                                    return value == null || value === '' ? '-' : String(value);
                                                })()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">ไม่พบข้อมูล</p>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {!mockMode ? (
                <section className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-4 ring-1 ring-white/[0.03]">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">ตั้งค่าข้อมูลที่แสดงในรายละเอียดพัสดุ</h3>
                        <span className="text-[11px] text-slate-500">เลือกฟิลด์ที่ต้องการเห็นเมื่อเปิดรายละเอียดเลขพัสดุ</span>
                        <button
                            type="button"
                            onClick={() => setShowFieldChooser((v) => !v)}
                            className="ml-auto rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
                        >
                            {showFieldChooser ? 'ซ่อนตัวเลือกฟิลด์' : 'เลือกฟิลด์ที่แสดง'}
                        </button>
                    </div>
                    {showFieldChooser ? (
                        <>
                            <div className="mb-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => applyPreset('default')}
                                    className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
                                >
                                    ใช้ค่าเริ่มต้น
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('all')}
                                    className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
                                >
                                    เลือกทั้งหมด
                                </button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {availableDetailFields.map((key) => {
                                    const checked = editableDetailFields.includes(key);
                                    return (
                                        <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/35 px-3 py-2 text-sm text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleDetailField(key)}
                                                className="rounded border-slate-600"
                                            />
                                            <span>{fieldLabelMap.get(key) ?? key}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </>
                    ) : null}
                    {detailFieldsErr ? <p className="mt-2 text-sm text-rose-400">{detailFieldsErr}</p> : null}
                    <div className="mt-3 flex justify-end">
                        <button
                            type="button"
                            onClick={() => void saveDetailFields()}
                            disabled={savingDetailFields}
                            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
                        >
                            {savingDetailFields ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                        </button>
                    </div>
                </section>
            ) : null}

            {copyMessage ? (
                <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs font-medium text-slate-200 shadow-xl shadow-black/30">
                    {copyMessage}
                </div>
            ) : null}

        </div>
    );
}
