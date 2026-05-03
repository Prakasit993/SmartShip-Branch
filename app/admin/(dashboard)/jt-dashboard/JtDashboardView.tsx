'use client';

import Link from 'next/link';
import { AlertCircle, Banknote, Package, RotateCcw, Scale } from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import type { JtCustomMetricCardDefinition } from '@/lib/jtCustomMetricCards';
import type { JtDashboardChartsPayload } from './jtDashboardStatsChartTypes';
import type { JtDashboardMetrics, JtDashboardShipmentRow } from './jtDashboardTypes';
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

export type JtDashboardViewProps = {
    metrics: JtDashboardMetrics;
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
    /** ช่วงวันที่ที่กด “ใช้ช่วงนี้” แล้ว (แสดงใต้การ์ดพัสดุทั้งหมด) */
    appliedRange: { from: string; to: string } | null;
    /** Step 1: แสดงป้ายว่าเป็นข้อมูลจำลอง */
    mockMode?: boolean;
};

function SummaryCardSkeleton() {
    return (
        <div className="animate-pulse rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="mb-4 h-10 w-10 rounded-lg bg-slate-800" />
            <div className="mb-2 h-3 w-24 rounded bg-slate-800" />
            <div className="h-8 w-20 rounded bg-slate-800/80" />
        </div>
    );
}

function TableSkeleton() {
    return (
        <div className="animate-pulse space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="h-5 w-48 rounded bg-slate-800" />
            {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-800/60" />
            ))}
        </div>
    );
}

/**
 * โครง UI หลักของแดชบอร์ด J&T — พื้นหลังเข้ม slate-950/900 ตามธีมแอดมิน
 * (Sidebar / ภาษา TH|EN อยู่ที่ layout แม่ — ไม่ซ้ำในไฟล์นี้)
 */
export function JtDashboardView({
    metrics,
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
}: JtDashboardViewProps) {
    const showContent = !loading && !error;

    return (
        <div className="min-w-0 space-y-8">
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
                    className="flex flex-col gap-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-5 sm:flex-row sm:items-center sm:justify-between"
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
                            className="shrink-0 rounded-lg bg-red-500/20 px-4 py-2.5 text-sm font-medium text-red-100 ring-1 ring-red-500/40 transition hover:bg-red-500/30"
                        >
                            ลองอีกครั้ง
                        </button>
                    ) : null}
                </div>
            ) : null}

            <section aria-labelledby="summary-heading">
                <h2 id="summary-heading" className="sr-only">
                    สรุปภาพรวม
                </h2>

                <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4 ring-1 ring-white/5">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                        กรองตามวันที่จอง (booking_date)
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-slate-400">
                            <span className="text-[11px] text-slate-500">ตั้งแต่วันที่</span>
                            <input
                                type="date"
                                value={parcelDateFrom}
                                onChange={(e) => onParcelDateFromChange(e.target.value)}
                                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500/40 focus:border-sky-500/50 focus:ring-2"
                            />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-slate-400">
                            <span className="text-[11px] text-slate-500">ถึงวันที่</span>
                            <input
                                type="date"
                                value={parcelDateTo}
                                onChange={(e) => onParcelDateToChange(e.target.value)}
                                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-sky-500/40 focus:border-sky-500/50 focus:ring-2"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={onApplyRange}
                            disabled={loading}
                            className="rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-sky-900/30 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            ใช้ช่วงนี้
                        </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-snug text-slate-600">
                        {mockMode
                            ? 'โหมดจำลอง: ไม่ยิง API'
                            : 'กรองจาก booking_date (text) — เว้นทั้งคู่ = ทั้งตาราง · การ์ดและตารางล่าสุดใช้ช่วงเดียวกัน'}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {loading ? (
                        <>
                            <SummaryCardSkeleton />
                            <SummaryCardSkeleton />
                            <SummaryCardSkeleton />
                            <SummaryCardSkeleton />
                        </>
                    ) : showContent ? (
                        <>
                            <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg shadow-black/20 ring-1 ring-white/5 backdrop-blur-sm transition hover:border-slate-700/80">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25">
                                    <Package className="h-5 w-5" aria-hidden />
                                </div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    พัสดุทั้งหมด
                                </p>
                                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                                    {metrics.totalParcels.toLocaleString('th-TH')}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                    นับจาก awb_number
                                    {appliedRange && (appliedRange.from || appliedRange.to) ? (
                                        <span className="block text-sky-400/90">
                                            ช่วงที่เลือก: {appliedRange.from || '…'} → {appliedRange.to || '…'}
                                        </span>
                                    ) : (
                                        <span className="block text-slate-600">ทั้งระบบ (ไม่กรองวันที่)</span>
                                    )}
                                </p>
                            </article>

                            <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg shadow-black/20 ring-1 ring-white/5 backdrop-blur-sm transition hover:border-slate-700/80">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25">
                                    <Banknote className="h-5 w-5" aria-hidden />
                                </div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    ยอดเก็บปลายทาง (COD)
                                </p>
                                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                                    ฿{formatThb(metrics.sumCod)}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">ผลรวม cod_amount</p>
                            </article>

                            <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg shadow-black/20 ring-1 ring-white/5 backdrop-blur-sm transition hover:border-slate-700/80">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25">
                                    <Scale className="h-5 w-5" aria-hidden />
                                </div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    ค่าส่งเฉลี่ย
                                </p>
                                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                                    ฿{formatThb(metrics.avgShippingFee)}
                                </p>
                                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                                    จากแถวที่ shipping_fee &gt; 0 เท่านั้น
                                </p>
                            </article>

                            <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg shadow-black/20 ring-1 ring-white/5 backdrop-blur-sm transition hover:border-slate-700/80">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
                                    <RotateCcw className="h-5 w-5" aria-hidden />
                                </div>
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                    พัสดุตีกลับ
                                </p>
                                <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                                    {metrics.returnCount.toLocaleString('th-TH')}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                    latest_scan_type มีคำว่า &quot;ตีกลับ&quot; หรือ Return
                                </p>
                            </article>

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
            </section>

            {!mockMode ? (
                <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_min(100%,280px)] xl:items-start xl:gap-6">
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

            <section aria-labelledby="recent-heading" className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 id="recent-heading" className="text-lg font-semibold text-white">
                            รายการล่าสุด
                        </h2>
                        <p className="text-sm text-slate-500">5 รายการล่าสุดตาม booking_date</p>
                    </div>
                    <Link
                        href="/admin/shipments"
                        className="text-sm font-medium text-sky-400 hover:text-sky-300"
                    >
                        ดูทั้งหมด →
                    </Link>
                </div>

                {loading ? (
                    <TableSkeleton />
                ) : showContent ? (
                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl shadow-black/25 ring-1 ring-white/5">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wide text-slate-500">
                                        <th className="px-4 py-3 font-medium">AWB</th>
                                        <th className="px-4 py-3 font-medium">วันที่จอง</th>
                                        <th className="px-4 py-3 font-medium">ผู้รับ</th>
                                        <th className="px-4 py-3 font-medium text-right">ค่าส่ง</th>
                                        <th className="px-4 py-3 font-medium text-right">COD</th>
                                        <th className="px-4 py-3 font-medium">สถานะสแกน</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80">
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
                                                    className="hover:bg-slate-800/30"
                                                >
                                                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-sky-300/95">
                                                        {strOrDash(row.awb_number)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                                                        {formatBookingDateThai(row.booking_date)}
                                                    </td>
                                                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-300">
                                                        {strOrDash(row.receiver_name)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-200">
                                                        ฿{formatThb(moneyOrZero(row.shipping_fee))}
                                                    </td>
                                                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-200">
                                                        ฿{formatThb(moneyOrZero(row.cod_amount))}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span
                                                            className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${badge.className}`}
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
