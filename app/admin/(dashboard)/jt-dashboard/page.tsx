'use client';

import Link from 'next/link';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { channelOrNullFromRow } from '@/lib/jtChannel';
import { sanitizeJtChannelPriority } from '@/lib/jtChannelSettings';
import {
    anyJtSectionVisible,
    clearJtDashboardLocalOverride,
    defaultJtDashboardSections,
    JT_DASHBOARD_SECTION_KEYS,
    JT_DASHBOARD_SECTION_LABELS,
    readJtDashboardLocalOverride,
    writeJtDashboardLocalOverride,
    type JtDashboardSectionKey,
} from '@/lib/jtDashboardSections';

/** ความสูงแท่ง 0–100: linear หรือ sqrt */
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

export interface Stats {
    total: number;
    today: number;
    week: number;
    month: number;
    totalFee: number;
    avgFee: number;
    maxFee: number;
    recent: {
        awb_number: string;
        booking_date: string;
        sender_name: string;
        receiver_name: string;
        shipping_fee: number;
        platform?: string | null;
        order_source?: string | null;
    }[];
    topSenders: { name: string; count: number }[];
    topReceivers: { name: string; count: number }[];
    daily30: { date: string; count: number }[];
    platformCounts: { name: string; count: number }[];
    ui?: { sections: Record<JtDashboardSectionKey, boolean> };
    /** ลำดับฟิลด์ที่ใช้แสดงแพลตฟอร์ม — จากการตั้งค่าแอดมิน */
    channelFieldPriority?: string[];
}

function normalizeStatsPayload(d: Record<string, unknown>): Stats {
    const daily30 = Array.isArray(d.daily30)
        ? (d.daily30 as { date?: string; count?: unknown }[]).map((x) => ({
              date: String(x.date ?? ''),
              count: Math.max(0, Number(x.count) || 0),
          }))
        : [];

    const platformCounts = Array.isArray(d.platformCounts)
        ? (d.platformCounts as { name?: string; count?: unknown }[]).map((x) => ({
              name: String(x.name ?? 'ไม่ระบุ'),
              count: Math.max(0, Number(x.count) || 0),
          }))
        : [];

    const topSenders = Array.isArray(d.topSenders)
        ? (d.topSenders as { name?: string; count?: unknown }[]).map((x) => ({
              name: String(x.name ?? ''),
              count: Math.max(0, Number(x.count) || 0),
          }))
        : [];

    const topReceivers = Array.isArray(d.topReceivers)
        ? (d.topReceivers as { name?: string; count?: unknown }[]).map((x) => ({
              name: String(x.name ?? ''),
              count: Math.max(0, Number(x.count) || 0),
          }))
        : [];

    const recent = Array.isArray(d.recent)
        ? (d.recent as Record<string, unknown>[]).map((r) => ({
              awb_number: String(r.awb_number ?? ''),
              booking_date: String(r.booking_date ?? ''),
              sender_name: String(r.sender_name ?? ''),
              receiver_name: String(r.receiver_name ?? ''),
              shipping_fee: Number(r.shipping_fee) || 0,
              platform: r.platform != null ? String(r.platform) : null,
              order_source: r.order_source != null ? String(r.order_source) : null,
          }))
        : [];

    return {
        total: Math.max(0, Number(d.total) || 0),
        today: Math.max(0, Number(d.today) || 0),
        week: Math.max(0, Number(d.week) || 0),
        month: Math.max(0, Number(d.month) || 0),
        totalFee: Number(d.totalFee) || 0,
        avgFee: Number(d.avgFee) || 0,
        maxFee: Number(d.maxFee) || 0,
        recent,
        topSenders,
        topReceivers,
        daily30,
        platformCounts,
        ui: d.ui as Stats['ui'],
        channelFieldPriority: Array.isArray(d.channelFieldPriority)
            ? sanitizeJtChannelPriority(d.channelFieldPriority)
            : sanitizeJtChannelPriority(null),
    };
}

const panel =
    'rounded-2xl border border-zinc-800/90 bg-[#0a1326]/95 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm';

export default function JTDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [showAllTop, setShowAllTop] = useState(false);
    const [visible, setVisible] = useState<Record<JtDashboardSectionKey, boolean> | null>(null);
    const [hasLocalPrefs, setHasLocalPrefs] = useState(false);
    const [dailyChartScale, setDailyChartScale] = useState<'linear' | 'sqrt'>('sqrt');

    const fetchStats = useCallback(() => {
        setLoading(true);
        setLoadError(false);
        fetch('/api/admin/jt-shipments/stats')
            .then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            })
            .then((d: Record<string, unknown>) => {
                const normalized = normalizeStatsPayload(d);
                setStats(normalized);
                const server = parseSectionsFromApi(d.ui);
                const local = readJtDashboardLocalOverride();
                setVisible(local ?? server);
                setHasLocalPrefs(local !== null);
            })
            .catch(() => {
                setLoadError(true);
                setStats(null);
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    function parseSectionsFromApi(ui: unknown): Record<JtDashboardSectionKey, boolean> {
        const d = defaultJtDashboardSections();
        if (ui == null || typeof ui !== 'object') return d;
        const sections = (ui as { sections?: Record<string, boolean> }).sections;
        if (sections && typeof sections === 'object') {
            for (const k of JT_DASHBOARD_SECTION_KEYS) {
                if (typeof sections[k] === 'boolean') d[k] = sections[k];
            }
        }
        return d;
    }

    const serverSections = stats?.ui?.sections ?? defaultJtDashboardSections();

    const toggleSection = (key: JtDashboardSectionKey) => {
        setVisible((prev) => {
            if (!prev) return prev;
            const next = { ...prev, [key]: !prev[key] };
            writeJtDashboardLocalOverride(next);
            setHasLocalPrefs(true);
            return next;
        });
    };

    const useServerLayout = () => {
        clearJtDashboardLocalOverride();
        setVisible(serverSections);
        setHasLocalPrefs(false);
    };

    const platformSum = useMemo(
        () => stats?.platformCounts.reduce((a, x) => a + x.count, 0) ?? 0,
        [stats?.platformCounts],
    );

    if (loading) {
        return (
            <div className="space-y-4 w-full pb-20">
                <div className="h-28 rounded-2xl bg-zinc-900/80 border border-zinc-800 animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-28 rounded-2xl bg-zinc-900/70 border border-zinc-800 animate-pulse" />
                    ))}
                </div>
                <div className="h-56 rounded-2xl bg-zinc-900/70 border border-zinc-800 animate-pulse" />
            </div>
        );
    }

    if (loadError || !stats || !visible) {
        return (
            <div className={`${panel} px-6 py-16 text-center max-w-lg mx-auto`}>
                <p className="text-zinc-300 font-semibold mb-2">โหลดแดชบอร์ดไม่สำเร็จ</p>
                <p className="text-sm text-zinc-500 mb-6">ตรวจสอบการล็อกอินแอดมินและการเชื่อมต่อ Supabase</p>
                <button
                    type="button"
                    onClick={() => fetchStats()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg transition"
                >
                    ลองโหลดอีกครั้ง
                </button>
            </div>
        );
    }

    const v = visible;
    const maxDaily = Math.max(...stats.daily30.map((d) => d.count), 0);
    const maxDailySafe = Math.max(maxDaily, 1);
    const sumDaily30 = stats.daily30.reduce((acc, d) => acc + d.count, 0);
    const daysWithData = stats.daily30.filter((d) => d.count > 0).length;
    const maxSender = stats.topSenders[0]?.count || 1;
    const maxReceiver = stats.topReceivers[0]?.count || 1;
    const topLimit = showAllTop ? 10 : 5;
    const senderRows = stats.topSenders.slice(0, topLimit);
    const receiverRows = stats.topReceivers.slice(0, topLimit);
    const recentRows = stats.recent.slice(0, 5);
    const platformDen = platformSum > 0 ? platformSum : 1;

    return (
        <div className="space-y-6 w-full pb-20 text-zinc-100">
            {/* Header + visibility */}
            <div className={`${panel} p-4 md:p-6 flex flex-col gap-5`}>
                <AdminPageHeader
                    className="mb-0"
                    title="J&T Dashboard"
                    description="ภาพรวมการจัดส่ง — ข้อมูลจากตาราง jt_shipments แบบเรียลไทม์"
                    titleLeft={<span aria-hidden>🚚</span>}
                    actions={
                        <div className="flex flex-wrap gap-2">
                            <Link
                                href="/admin/settings#jt-dashboard-sections"
                                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition border border-zinc-600/50"
                            >
                                ⚙️ ค่าเริ่มต้น
                            </Link>
                            <Link
                                href="/admin/shipments"
                                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition shadow-md shadow-blue-900/30"
                            >
                                📋 จัดการรายการ
                            </Link>
                        </div>
                    }
                />

                <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 bg-zinc-950/30">
                        <div>
                            <p className="text-sm font-semibold text-zinc-100">เลือกบล็อกที่แสดง</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                จัดเก็บในเบราว์เซอร์นี้ — ไม่กระทบผู้ใช้คนอื่น
                            </p>
                        </div>
                        {hasLocalPrefs ? (
                            <span className="text-[11px] font-medium text-amber-300/95 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25">
                                มุมมองเฉพาะเครื่องนี้
                            </span>
                        ) : null}
                    </div>
                    <div className="px-4 py-4 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {JT_DASHBOARD_SECTION_KEYS.map((key) => (
                                <label
                                    key={key}
                                    className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/90 cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/80 transition-colors"
                                >
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 rounded border-zinc-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-950"
                                        checked={v[key]}
                                        onChange={() => toggleSection(key)}
                                    />
                                    <span className="text-xs text-zinc-200 leading-snug">{JT_DASHBOARD_SECTION_LABELS[key]}</span>
                                </label>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={useServerLayout}
                            className="text-xs px-3 py-2 rounded-lg bg-zinc-800/90 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                        >
                            ใช้ค่าจากระบบ (ล้างมุมมองเฉพาะเครื่อง)
                        </button>
                    </div>
                </div>
            </div>

            {!anyJtSectionVisible(v) && (
                <div className="rounded-2xl border border-amber-700/40 bg-amber-950/25 px-4 py-6 text-center text-amber-100/95 text-sm">
                    ไม่มีบล็อกใดถูกเลือก — เปิดการเลือกด้านบน หรือไปที่{' '}
                    <Link href="/admin/settings#jt-dashboard-sections" className="underline font-medium text-amber-200">
                        ตั้งค่าเว็บไซต์
                    </Link>
                </div>
            )}

            {v.summary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <StatCard label="รายการทั้งหมด" value={stats.total.toLocaleString()} icon="📦" accent="from-sky-500 to-blue-700" hint="ในฐานข้อมูล" />
                    <StatCard label="วันนี้" value={stats.today.toLocaleString()} icon="📅" accent="from-emerald-500 to-teal-700" hint="ตั้งแต่เที่ยงคืน (ตามเบราว์เซอร์)" />
                    <StatCard label="7 วันล่าสุด" value={stats.week.toLocaleString()} icon="📈" accent="from-violet-500 to-purple-800" hint="ย้อนหลัง 7 วัน" />
                    <StatCard label="เดือนนี้" value={stats.month.toLocaleString()} icon="🗓️" accent="from-amber-500 to-orange-700" hint="วันที่ 1 ของเดือนปัจจุบัน" />
                </div>
            )}

            {v.fees && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    <FeeCard label="ค่าส่งรวม" value={`฿${stats.totalFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} icon="💰" accent="text-emerald-300" />
                    <FeeCard label="เฉลี่ยต่อรายการ" value={`฿${stats.avgFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} icon="📊" accent="text-sky-300" />
                    <FeeCard label="ค่าส่งสูงสุด / รายการ" value={`฿${stats.maxFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`} icon="🏆" accent="text-amber-300" />
                </div>
            )}

            {v.platforms && (
                <div className={`${panel} p-5 md:p-6`}>
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
                            {stats.platformCounts.map((row, i) => {
                                const pct = (row.count / platformDen) * 100;
                                return (
                                    <div
                                        key={`${row.name}-${i}`}
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
                </div>
            )}

            {(v.daily || v.topSenders) && (
                <div className={`grid grid-cols-1 gap-6 ${v.daily && v.topSenders ? 'lg:grid-cols-2' : ''}`}>
                    {v.daily && (
                        <div className={`${panel} p-5 md:p-6`}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold mb-1 tracking-tight">📈 จำนวนรายการ 30 วันล่าสุด</h2>
                                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                                        นับตามวันที่จอง (<strong className="text-zinc-400">UTC</strong> ต่อวัน) — ชี้ที่แท่งเพื่อดูจำนวน
                                        {dailyChartScale === 'sqrt' ? (
                                            <span>
                                                {' '}
                                                · โหมด <strong className="text-zinc-400">สมดุล (√)</strong> ช่วยเมื่อมีวันที่สูงมากโดด
                                            </span>
                                        ) : (
                                            <span>
                                                {' '}
                                                · โหมด <strong className="text-zinc-400">ตามสัดส่วนจริง</strong>
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-[11px] text-zinc-500 mt-2 tabular-nums">
                                        ช่วงนี้ <strong className="text-zinc-200">{sumDaily30.toLocaleString()}</strong> รายการ · วันที่มีข้อมูล{' '}
                                        <strong className="text-zinc-200">{daysWithData}</strong> / 30
                                        {maxDaily > 0 ? (
                                            <>
                                                {' '}
                                                · สูงสุด <strong className="text-zinc-200">{maxDaily.toLocaleString()}</strong> / วัน
                                            </>
                                        ) : null}
                                    </p>
                                </div>
                                <div
                                    className="flex shrink-0 rounded-xl border border-zinc-700/90 bg-zinc-950/70 p-0.5 text-[11px] font-semibold"
                                    role="group"
                                    aria-label="โหมดสเกลกราฟ"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setDailyChartScale('sqrt')}
                                        className={`rounded-lg px-3 py-1.5 transition ${dailyChartScale === 'sqrt' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                        สมดุล (√)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDailyChartScale('linear')}
                                        className={`rounded-lg px-3 py-1.5 transition ${dailyChartScale === 'linear' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                        ตามจริง
                                    </button>
                                </div>
                            </div>

                            <div className="relative rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-950/60 to-zinc-950/30 px-2 pt-3 pb-2">
                                <div
                                    className="pointer-events-none absolute left-2 right-2 top-3 h-48 flex flex-col justify-between"
                                    aria-hidden
                                >
                                    <div className="border-t border-dashed border-zinc-700/30" />
                                    <div className="border-t border-dashed border-zinc-700/30" />
                                    <div className="border-t border-dashed border-zinc-700/30" />
                                </div>
                                <div className="relative flex h-48 w-full min-w-0 items-end justify-between gap-px sm:gap-0.5 md:gap-1">
                                    {stats.daily30.map((d, i) => {
                                        const rawPct = dailyBarHeightPct(d.count, maxDailySafe, dailyChartScale);
                                        const barPct =
                                            dailyChartScale === 'sqrt'
                                                ? Math.max(rawPct, d.count > 0 ? 5 : 0)
                                                : Math.max(rawPct, d.count > 0 ? 2.5 : 0);
                                        const isLatest = i === stats.daily30.length - 1;
                                        return (
                                            <div
                                                key={d.date}
                                                className="group relative flex min-w-0 flex-1 flex-col justify-end"
                                                style={{ height: '100%' }}
                                            >
                                                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-[min(90vw,14rem)] -translate-x-1/2 rounded-lg bg-zinc-800 px-2 py-1.5 text-center text-[10px] leading-snug text-white opacity-0 shadow-xl ring-1 ring-zinc-600/50 transition-opacity duration-150 group-hover:opacity-100">
                                                    <span className="font-semibold text-blue-200">{formatDayLabel(d.date)}</span>
                                                    <br />
                                                    <span className="tabular-nums">{d.count.toLocaleString()} รายการ</span>
                                                </div>
                                                <div
                                                    className={`w-full rounded-t-md transition-all ${isLatest ? 'bg-gradient-to-t from-blue-600 to-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.35)]' : 'bg-gradient-to-t from-blue-700/90 to-blue-500/70 group-hover:from-blue-500 group-hover:to-sky-400/90'}`}
                                                    style={{
                                                        height: `${Math.min(barPct, 100)}%`,
                                                        minHeight: d.count > 0 ? '3px' : '2px',
                                                        opacity: d.count > 0 ? 1 : 0.28,
                                                    }}
                                                    title={`${d.date}: ${d.count}`}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-2 flex justify-between px-0.5 text-[10px] text-zinc-500">
                                    <span>{stats.daily30[0] ? formatDayLabel(stats.daily30[0].date) : ''}</span>
                                    <span className="font-semibold text-sky-400/95">
                                        ล่าสุด {stats.daily30[stats.daily30.length - 1] ? formatDayLabel(stats.daily30[stats.daily30.length - 1].date) : ''}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {v.topSenders && (
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
                    )}
                </div>
            )}

            {(v.topReceivers || v.hints) && (
                <div className={`grid grid-cols-1 gap-6 ${v.topReceivers && v.hints ? 'lg:grid-cols-2' : ''}`}>
                    {v.topReceivers && (
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
                    )}

                    {v.hints && (
                        <div className={`${panel} p-5 md:p-6`}>
                            <h2 className="text-lg font-bold mb-4 tracking-tight">🎯 คำแนะนำ</h2>
                            <div className="space-y-3 text-sm text-zinc-300">
                                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/80">
                                    <p className="font-semibold text-zinc-100">สรุปบนแดชบอร์ด</p>
                                    <p className="text-zinc-500 mt-1 text-xs leading-relaxed">
                                        Top ผู้ส่ง/ผู้รับแสดงค่าเริ่มต้น 5 แถว — กด &quot;ดูเพิ่ม&quot; เพื่อเห็น 10 แถว
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/80">
                                    <p className="font-semibold text-zinc-100">รายละเอียดเต็ม</p>
                                    <p className="text-zinc-500 mt-1 text-xs leading-relaxed">
                                        ใช้หน้า J&T Shipments สำหรับค้นหา กรองวันที่ และแก้ไขรายการ
                                    </p>
                                </div>
                                <Link
                                    href="/admin/shipments"
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition shadow-lg shadow-blue-900/20"
                                >
                                    เปิดหน้าจัดการรายการ <span aria-hidden>→</span>
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {v.recent && (
                <div className={`${panel} overflow-hidden`}>
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
                        <table className="w-full text-sm min-w-[640px]">
                            <thead>
                                <tr className="bg-zinc-950/80 text-left border-b border-zinc-800">
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">AWB</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">วันที่จอง</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">แพลตฟอร์ม</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">ผู้ส่ง</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide">ผู้รับ</th>
                                    <th className="px-4 py-3 font-semibold text-zinc-500 text-xs uppercase tracking-wide text-right">ค่าส่ง</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/80">
                                {recentRows.map((r, i) => {
                                    const channel = channelOrNullFromRow(
                                        r as Record<string, unknown>,
                                        stats.channelFieldPriority,
                                    );
                                    return (
                                    <tr key={`${r.awb_number}-${i}`} className="hover:bg-zinc-900/50 transition">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-sky-400 whitespace-nowrap">{r.awb_number || '—'}</td>
                                        <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatBookingThai(r.booking_date)}</td>
                                        <td className="px-4 py-3">
                                            {channel ? (
                                                <span
                                                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${platformPillClass(channel)}`}
                                                >
                                                    {channel}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-600 text-xs">—</span>
                                            )}
                                        </td>
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
                                );
                                })}
                                {!recentRows.length && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                                            ไม่มีข้อมูลล่าสุด
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({
    label,
    value,
    icon,
    accent,
    hint,
}: {
    label: string;
    value: string;
    icon: string;
    accent: string;
    hint: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-5 shadow-inner">
            <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`} />
            <p className="text-2xl mb-2 drop-shadow-sm">{icon}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="text-2xl font-black mt-1 tabular-nums tracking-tight text-white">{value}</p>
            <p className="text-[10px] text-zinc-600 mt-1 leading-snug">{hint}</p>
        </div>
    );
}

function FeeCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent: string }) {
    return (
        <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-5 flex items-start gap-4 shadow-inner">
            <span className="text-3xl shrink-0">{icon}</span>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
                <p className={`text-xl font-black tabular-nums mt-0.5 ${accent}`}>{value}</p>
            </div>
        </div>
    );
}
