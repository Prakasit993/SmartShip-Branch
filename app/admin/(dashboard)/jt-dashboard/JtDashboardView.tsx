'use client';

import { useEffect, useState } from 'react';

import { AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, Calendar, CheckCircle2, CheckSquare, Clock, HandCoins, Hourglass, Minus, Package, Percent, RefreshCw, RotateCcw, Search, Truck } from 'lucide-react';
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
            {delta ? (
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
        <div className="animate-pulse rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/40 to-slate-950/60 p-5">
            <div className="mb-4 h-11 w-11 rounded-xl bg-slate-800/80" />
            <div className="mb-2 h-3 w-24 rounded bg-slate-800/60" />
            <div className="h-8 w-20 rounded bg-slate-800/50" />
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

function normalizeChatText(text: string): string {
    // Support text returned as escaped newlines from upstream workflow.
    return text.replace(/\\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
    const showContent = !loading && !error;
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

    async function submitAiChat() {
        const text = chatInput.trim();
        if (!text || chatLoading) return;
        setChatLoading(true);
        setChatError(null);
        setChatInput('');
        setChatMessages((prev) => [...prev, { role: 'user', text }]);
        try {
            const res = await fetch('/api/admin/ai-chat', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    message: text,
                    context: {
                        appliedRange,
                        metrics,
                        topReturnTypeCases: metrics.topReturnTypeCases.slice(0, 10),
                    },
                }),
            });
            const raw = await res.text();
            let parsed: { answer?: string; error?: string } = {};
            try {
                parsed = JSON.parse(raw) as { answer?: string; error?: string };
            } catch {
                parsed = {};
            }
            if (!res.ok) {
                throw new Error(parsed.error || 'ส่งคำถามไม่สำเร็จ');
            }
            setChatMessages((prev) => [...prev, { role: 'assistant', text: parsed.answer ?? '-' }]);
        } catch (e) {
            setChatError(e instanceof Error ? e.message : 'ส่งคำถามไม่สำเร็จ');
        } finally {
            setChatLoading(false);
        }
    }

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
            `}</style>

            <AdminPageHeader
                title="Dashboard"
                description={
                    mockMode
                        ? 'สรุปข้อมูลจากตาราง jt_shipments — โหมดตัวอย่าง UI (Mock data · Step 1)'
                        : 'ข้อมูลสรุปจาก Report - JMS'
                }
                tone="dark"
                meta={
                    mockMode ? (
                        <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
                            Mock UI
                        </span>
                    ) : null
                }
                actions={
                    !mockMode ? (
                        <section className="w-full max-w-full rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-950/90 via-slate-950/75 to-slate-900/80 p-3 shadow-xl shadow-black/20 ring-1 ring-white/[0.04] sm:p-3.5 lg:max-w-md xl:max-w-lg 2xl:max-w-xl">
                            <div className="mb-2 flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-semibold text-white">AI Assistant (ผ่าน n8n)</h3>
                                    <p className="text-[11px] text-slate-400">ถามสรุปตัวเลขหรือแนวโน้มจากข้อมูลหน้า dashboard</p>
                                </div>
                                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                                    Beta
                                </span>
                            </div>
                            <div className="scrollbar-hide mb-2 max-h-56 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-slate-800/90 bg-slate-950/80 p-2.5">
                                {chatMessages.length === 0 ? (
                                    <p className="text-sm leading-relaxed text-slate-400">
                                        ลองถาม: "สรุป KPI วันนี้" หรือ "สาเหตุ return_type สูงขึ้นคืออะไร?"
                                    </p>
                                ) : (
                                    chatMessages.slice(-4).map((m, idx) => (
                                        <div
                                            key={`${m.role}-${idx}`}
                                            className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                                m.role === 'user'
                                                    ? 'ml-8 border border-sky-500/35 bg-sky-500/15 text-sky-50'
                                                    : 'mr-8 border border-slate-700/90 bg-slate-900/95 text-slate-100'
                                            }`}
                                        >
                                            <p
                                                className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${
                                                    m.role === 'user' ? 'text-sky-300/90' : 'text-slate-400'
                                                }`}
                                            >
                                                {m.role === 'user' ? 'คุณ' : 'AI Assistant'}
                                            </p>
                                            <p className="whitespace-pre-wrap break-words">
                                                {normalizeChatText(m.text)}
                                            </p>
                                        </div>
                                    ))
                                )}
                                {chatLoading ? (
                                    <div className="mr-8 rounded-xl border border-slate-700/90 bg-slate-900/95 px-3 py-2 text-sm text-slate-300">
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                            AI Assistant
                                        </p>
                                        <p className="animate-pulse">กำลังคิดคำตอบ...</p>
                                    </div>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void submitAiChat();
                                        }
                                    }}
                                    placeholder="พิมพ์คำถาม..."
                                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none ring-sky-500/30 placeholder:text-slate-500 focus:border-sky-500/50 focus:ring-2"
                                />
                                <button
                                    type="button"
                                    disabled={chatLoading || !chatInput.trim()}
                                    onClick={() => void submitAiChat()}
                                    className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500 disabled:opacity-50"
                                >
                                    {chatLoading ? 'กำลังส่ง...' : 'ส่ง'}
                                </button>
                            </div>
                            {chatError ? (
                                <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
                                    <p className="text-sm leading-relaxed text-rose-200">{chatError}</p>
                                    {chatError.includes('N8N_AI_WEBHOOK_URL') ? (
                                        <p className="mt-1 text-[11px] text-rose-200/90">
                                            กรุณาเพิ่ม `N8N_AI_WEBHOOK_URL` ใน `.env.local` แล้วรีสตาร์ทเซิร์ฟเวอร์
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                        </section>
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
                    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-4 lg:gap-y-3">
                        <div className="flex min-w-0 items-start gap-2 lg:col-span-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25">
                                <Calendar className="h-4 w-4" aria-hidden />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-400">
                                    กรองตามวันที่จอง
                                </p>
                                <p className="mt-0.5 hidden text-[10px] leading-snug text-slate-600 sm:block sm:text-[11px]">
                                    {mockMode
                                        ? 'โหมดจำลอง: ไม่ยิง API'
                                        : 'booking_date · เว้นทั้งคู่ = ทั้งตาราง'}
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:col-span-6 lg:grid-cols-2 lg:gap-3">
                            <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-400">
                                <span className="text-[10px] font-medium text-slate-500">ตั้งแต่</span>
                                <input
                                    type="date"
                                    value={parcelDateFrom}
                                    onChange={(e) => onParcelDateFromChange(e.target.value)}
                                    className="min-h-[44px] w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/40 transition-all focus:border-sky-500/50 focus:ring-2 hover:border-slate-600 sm:min-h-0"
                                />
                            </label>
                            <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-400">
                                <span className="text-[10px] font-medium text-slate-500">ถึง</span>
                                <input
                                    type="date"
                                    value={parcelDateTo}
                                    onChange={(e) => onParcelDateToChange(e.target.value)}
                                    className="min-h-[44px] w-full rounded-xl border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/40 transition-all focus:border-sky-500/50 focus:ring-2 hover:border-slate-600 sm:min-h-0"
                                />
                            </label>
                        </div>
                        <div className="flex lg:col-span-3 lg:justify-end">
                            <button
                                type="button"
                                onClick={onApplyRange}
                                disabled={loading}
                                className="group/btn flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-900/30 transition-all hover:from-sky-500 hover:to-sky-400 hover:shadow-sky-800/40 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] min-[420px]:w-auto sm:min-h-0 lg:min-w-[9.5rem]"
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
                                icon={<CheckSquare className="h-5 w-5" aria-hidden />}
                                iconBg="bg-indigo-500/15"
                                iconRing="ring-indigo-500/25"
                                iconFg="text-indigo-400"
                                glowColor="bg-indigo-500/40"
                                label="ปิดงาน (มีผู้จัดส่ง)"
                                value={metrics.closedCount}
                                hint={
                                    <span>
                                        ยอดรวม {metrics.totalParcels.toLocaleString('th-TH')} ชิ้น ·
                                        เหลือ {(metrics.totalParcels - metrics.closedCount).toLocaleString('th-TH')} ชิ้น
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
                                label="รายรับ"
                                value={metrics.sumTotalShippingFee ?? metrics.sumTotalFeeJms}
                                prefix="฿"
                                decimals={2}
                                delta={
                                    previousMetrics && previousMetrics.sumTotalShippingFee !== undefined
                                        ? {
                                              previous: previousMetrics.sumTotalShippingFee,
                                              previousRangeDays: previousMetrics.range.days,
                                          }
                                        : undefined
                                }
                                hint="ผลรวม total_shipping_fee"
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
                        <div className="space-y-3 sm:space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
                            <AnimatedKpiCard
                                index={4}
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

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 xl:items-stretch">
                            <AnimatedKpiCard
                                index={8}
                                className="h-full"
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
                                hint={'อ้างอิงจาก return_type (ตัด EMPTY/NULL/-)'}
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
                                label="เคสมีปัญหา"
                                value={metrics.exceptionCount}
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
                                    metrics.topReturnTypeCases.length > 0 ? (
                                        <span>
                                            {metrics.topReturnTypeCases[0]?.exception_reason || '-'}
                                        </span>
                                    ) : (
                                        'ไม่พบเคสจาก issue_registered_time'
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
                                    ค้นหาเลขพัสดุ AWB
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
                                    Enter / ปุ่ม · เปิดรายละเอียดจาก API
                                </p>
                            </article>
                        </div>
                        </div>
                        {activeDrilldown === 'exception' && metrics.topReturnTypeCases.length > 0 ? (
                            <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/45 p-3 ring-1 ring-white/[0.03]">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    รายการเคสมีปัญหา ({metrics.topReturnTypeCases.length} รายการล่าสุด)
                                </p>
                                <div className="mt-2 grid grid-cols-[1.6rem_1fr_1fr_1.5fr_1fr] sm:grid-cols-[1.6rem_1.1fr_1.1fr_2fr_1fr] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    <span>#</span>
                                    <span>AWB Number</span>
                                    <span>Sender Name</span>
                                    <span>Exception Reason</span>
                                    <span className="text-right">Issue Registered Time</span>
                                </div>
                                <div className="mt-2 space-y-1.5">
                                    {(showAllIssues ? metrics.topReturnTypeCases : metrics.topReturnTypeCases.slice(0, 3)).map((r, idx) => (
                                        <div
                                            key={`${r.awb_number}-${idx}`}
                                            className="grid grid-cols-[1.6rem_1fr_1fr_1.5fr_1fr] sm:grid-cols-[1.6rem_1.1fr_1.1fr_2fr_1fr] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]"
                                        >
                                            <span className="tabular-nums text-slate-500">{idx + 1}</span>
                                            <button
                                                type="button"
                                                onClick={() => void openShipmentDetail(r.awb_number)}
                                                className="min-w-0 truncate text-left text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
                                                title={`เปิดรายละเอียด ${r.awb_number}`}
                                            >
                                                {r.awb_number}
                                            </button>
                                            <span className="min-w-0 truncate text-slate-300" title={r.sender_name}>
                                                {r.sender_name}
                                            </span>
                                            <span className="min-w-0 truncate text-rose-200" title={r.exception_reason}>
                                                {r.exception_reason}
                                            </span>
                                            <span className="min-w-0 truncate text-slate-400 text-right tabular-nums" title={r.issue_registered_time}>
                                                {r.issue_registered_time && r.issue_registered_time !== '-' ? r.issue_registered_time.slice(0, 16) : '-'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {metrics.topReturnTypeCases.length > 3 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAllIssues(!showAllIssues)}
                                        className="mt-2 w-full rounded-lg bg-slate-900/50 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-300 ring-1 ring-white/[0.04]"
                                    >
                                        {showAllIssues ? 'ย่อเก็บ' : `ดูเพิ่มเติมอีก ${metrics.topReturnTypeCases.length - 3} รายการ`}
                                    </button>
                                )}
                            </div>
                        ) : null}
                        {activeDrilldown === 'return' ? (
                            <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/45 p-3 ring-1 ring-white/[0.03]">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    รายการพัสดุตีกลับ (อ้างอิง return_type)
                                </p>
                                {metrics.topReturnTypeCases.length > 0 ? (
                                    <>
                                        <div className="mt-2 space-y-1.5 overflow-x-auto">
                                            <div className="grid min-w-[920px] grid-cols-[1.2fr_1.1fr_1.4fr_1.2fr_1fr] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                <span>AWB</span>
                                                <span>Sender</span>
                                                <span>Exception Reason</span>
                                                <span>Return Branch</span>
                                                <span className="text-right">Issue Time</span>
                                            </div>
                                            {(showAllReturns ? metrics.topReturnTypeCases : metrics.topReturnTypeCases.slice(0, 3)).map((r, idx) => (
                                                <div
                                                    key={`${r.awb_number}-${idx}`}
                                                    className="grid min-w-[920px] grid-cols-[1.2fr_1.1fr_1.4fr_1.2fr_1fr] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => void openShipmentDetail(r.awb_number)}
                                                        className="min-w-0 truncate text-left text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
                                                        title={`เปิดรายละเอียด ${r.awb_number}`}
                                                    >
                                                        {r.awb_number}
                                                    </button>
                                                    <span className="min-w-0 truncate text-slate-300" title={r.sender_name}>
                                                        {r.sender_name}
                                                    </span>
                                                    <span className="min-w-0 truncate text-rose-200" title={r.exception_reason}>
                                                        {r.exception_reason}
                                                    </span>
                                                    <span className="min-w-0 truncate text-slate-300" title={r.return_branch_name}>
                                                        {r.return_branch_name}
                                                    </span>
                                                    <span className="min-w-0 truncate text-slate-400 text-right tabular-nums" title={r.issue_registered_time ?? '-'}>
                                                        {r.issue_registered_time && r.issue_registered_time !== '-' ? r.issue_registered_time.slice(0, 16) : '-'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        {metrics.topReturnTypeCases.length > 3 ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowAllReturns(!showAllReturns)}
                                                className="mt-2 w-full rounded-lg bg-slate-900/50 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-300 ring-1 ring-white/[0.04]"
                                            >
                                                {showAllReturns ? 'ย่อเก็บ' : `ดูเพิ่มเติมอีก ${metrics.topReturnTypeCases.length - 3} รายการ`}
                                            </button>
                                        ) : null}
                                    </>
                                ) : (
                                    <p className="mt-2 text-xs text-slate-500">
                                        ไม่พบรายการล่าสุดที่มีค่า return_type ที่ใช้งานได้
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
                            loading={loading}
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
                    ) : null}
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
                                รายละเอียดพัสดุ: {detailAwb}
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
                        <h3 className="text-sm font-semibold text-white">ตั้งค่าฟิลด์รายละเอียดพัสดุ</h3>
                        <span className="text-[11px] text-slate-500">กำหนดฟิลด์ที่จะแสดงเมื่อกดเลข AWB</span>
                        <button
                            type="button"
                            onClick={() => setShowFieldChooser((v) => !v)}
                            className="ml-auto rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
                        >
                            {showFieldChooser ? 'ซ่อนรายการฟิลด์' : 'แสดงรายการฟิลด์'}
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
                                    ค่าเริ่มต้น
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('all')}
                                    className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
                                >
                                    ทั้งหมด
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

        </div>
    );
}
