'use client';

import Link from 'next/link';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sanitizeJtChannelPriority } from '@/lib/jtChannelSettings';
import { buildOrderedDashboardBlocks } from './buildOrderedDashboardBlocks';
import {
    anyJtSectionVisible,
    clearAllJtDashboardLocalPrefs,
    DEFAULT_JT_DASHBOARD_SECTION_ORDER,
    defaultJtDashboardSections,
    hasDashboardSectionLocalDelta,
    JT_DASHBOARD_SECTION_KEYS,
    JT_DASHBOARD_SECTION_LABELS,
    mergeDashboardSectionVisibility,
    readJtDashboardLocalOverride,
    readJtDashboardSectionOrder,
    sanitizeJtDashboardSectionOrder,
    writeJtDashboardLocalOverride,
    writeJtDashboardSectionOrder,
    type JtDashboardSectionKey,
} from '@/lib/jtDashboardSections';

export interface Stats {
    total: number;
    today: number;
    week: number;
    month: number;
    totalFee: number;
    /** เฉลี่ยทุกรายการ (รวมช่องทางอื่น) — อ้างอิง */
    avgFee: number;
    /** เฉลี่ยเฉพาะ TikTok / Shopee / Shein / Temu / … */
    avgFeeMarketplace: number;
    /** เฉลี่ยเฉพาะ JMS */
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
        platform?: string | null;
        order_source?: string | null;
    }[];
    topSenders: { name: string; count: number }[];
    topReceivers: { name: string; count: number }[];
    daily30: { date: string; count: number }[];
    /** รวมค่าส่งต่อวัน (shipping_fee) ตามวันที่จอง UTC เดียวกับกราฟซ้าย */
    dailyFee30: { date: string; feeTotal: number }[];
    sumDaily30: number;
    sumDailyFee30: number;
    bookingDateNullCount: number;
    platformCounts: { name: string; count: number }[];
    ui?: { sections: Record<JtDashboardSectionKey, boolean> };
    /** ลำดับฟิลด์ที่ใช้แสดงแพลตฟอร์ม — จากการตั้งค่าแอดมิน */
    channelFieldPriority?: string[];
    /** อธิบายช่วงกราฟรายวัน (UTC) — ทำไมยอดในตารางอาจไม่เท่าแท่ง */
    chartWindow?: {
        windowDays: number;
        utcStart: string;
        utcEnd: string;
        distinctDaysWithData: number;
        rowsInWindow: number;
        rowsOutsideWindowApprox: number;
        anchorHint: string;
    };
}

function normalizeStatsPayload(d: Record<string, unknown>): Stats {
    const daily30 = Array.isArray(d.daily30)
        ? (d.daily30 as { date?: string; count?: unknown }[]).map((x) => ({
              date: String(x.date ?? ''),
              count: Math.max(0, Number(x.count) || 0),
          }))
        : [];

    const dailyFee30 = Array.isArray(d.dailyFee30)
        ? (d.dailyFee30 as { date?: string; feeTotal?: unknown }[]).map((x) => ({
              date: String(x.date ?? ''),
              feeTotal: Math.max(0, Number(x.feeTotal) || 0),
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
        avgFeeMarketplace: Number(d.avgFeeMarketplace) || 0,
        avgFeeJms: Number(d.avgFeeJms) || 0,
        countAvgFeeMarketplace: Math.max(0, Number(d.countAvgFeeMarketplace) || 0),
        countAvgFeeJms: Math.max(0, Number(d.countAvgFeeJms) || 0),
        maxFee: Number(d.maxFee) || 0,
        recent,
        topSenders,
        topReceivers,
        daily30,
        dailyFee30,
        sumDaily30: Math.max(0, Number(d.sumDaily30) || daily30.reduce((a, x) => a + x.count, 0)),
        sumDailyFee30: Math.max(0, Number(d.sumDailyFee30) || dailyFee30.reduce((a, x) => a + x.feeTotal, 0)),
        bookingDateNullCount: Math.max(0, Number(d.bookingDateNullCount) || 0),
        platformCounts,
        ui: d.ui as Stats['ui'],
        channelFieldPriority: Array.isArray(d.channelFieldPriority)
            ? sanitizeJtChannelPriority(d.channelFieldPriority)
            : sanitizeJtChannelPriority(null),
        chartWindow:
            d.chartWindow != null && typeof d.chartWindow === 'object'
                ? (() => {
                      const c = d.chartWindow as Record<string, unknown>;
                      return {
                          windowDays: Math.min(365, Math.max(7, Number(c.windowDays) || 30)),
                          utcStart: String(c.utcStart ?? ''),
                          utcEnd: String(c.utcEnd ?? ''),
                          distinctDaysWithData: Math.max(0, Number(c.distinctDaysWithData) || 0),
                          rowsInWindow: Math.max(0, Number(c.rowsInWindow) || 0),
                          rowsOutsideWindowApprox: Math.max(0, Number(c.rowsOutsideWindowApprox) || 0),
                          anchorHint: String(c.anchorHint ?? ''),
                      };
                  })()
                : undefined,
    };
}

const panel =
    'rounded-2xl border border-zinc-800/90 bg-[#0a1326]/95 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-sm';

const CHART_WINDOW_LS = 'smartship_jt_chart_window_days';
const CHART_WINDOW_OPTIONS = [30, 90, 180, 365] as const;

function readChartWindowDaysFromLs(): (typeof CHART_WINDOW_OPTIONS)[number] {
    if (typeof window === 'undefined') return 30;
    try {
        const n = parseInt(localStorage.getItem(CHART_WINDOW_LS) || '30', 10);
        if (CHART_WINDOW_OPTIONS.includes(n as (typeof CHART_WINDOW_OPTIONS)[number])) {
            return n as (typeof CHART_WINDOW_OPTIONS)[number];
        }
    } catch {
        /* ignore */
    }
    return 30;
}

export default function JTDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [showAllTop, setShowAllTop] = useState(false);
    const [visible, setVisible] = useState<Record<JtDashboardSectionKey, boolean> | null>(null);
    const [sectionOrder, setSectionOrder] = useState<JtDashboardSectionKey[]>(DEFAULT_JT_DASHBOARD_SECTION_ORDER);
    const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);
    const [hasLocalPrefs, setHasLocalPrefs] = useState(false);
    const [dailyChartScale, setDailyChartScale] = useState<'linear' | 'sqrt'>('sqrt');
    const [pickBlocksOpen, setPickBlocksOpen] = useState(true);
    const [orderBlocksOpen, setOrderBlocksOpen] = useState(true);
    const [chartWindowDays, setChartWindowDays] = useState<(typeof CHART_WINDOW_OPTIONS)[number]>(30);

    useEffect(() => {
        setChartWindowDays(readChartWindowDaysFromLs());
    }, []);

    const fetchStats = useCallback(() => {
        setLoading(true);
        setLoadError(false);
        fetch(`/api/admin/jt-shipments/stats?window_days=${chartWindowDays}`)
            .then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            })
            .then((d: Record<string, unknown>) => {
                const normalized = normalizeStatsPayload(d);
                setStats(normalized);
                const server = parseSectionsFromApi(d.ui);
                const local = readJtDashboardLocalOverride();
                const localOrder = readJtDashboardSectionOrder();
                setVisible(mergeDashboardSectionVisibility(server, local));
                setSectionOrder(localOrder ?? DEFAULT_JT_DASHBOARD_SECTION_ORDER);
                setHasLocalPrefs(
                    localOrder !== null || hasDashboardSectionLocalDelta(server, local),
                );
            })
            .catch(() => {
                setLoadError(true);
                setStats(null);
            })
            .finally(() => setLoading(false));
    }, [chartWindowDays]);

    const setChartWindowDaysPersist = useCallback((n: (typeof CHART_WINDOW_OPTIONS)[number]) => {
        setChartWindowDays(n);
        try {
            localStorage.setItem(CHART_WINDOW_LS, String(n));
        } catch {
            /* ignore */
        }
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
        if (!serverSections[key]) return;
        setVisible((prev) => {
            if (!prev) return prev;
            const nextMerged = { ...prev, [key]: !prev[key] };
            const stored = defaultJtDashboardSections();
            for (const k of JT_DASHBOARD_SECTION_KEYS) {
                if (serverSections[k]) {
                    stored[k] = nextMerged[k];
                }
            }
            writeJtDashboardLocalOverride(stored);
            const merged = mergeDashboardSectionVisibility(serverSections, stored);
            const order = readJtDashboardSectionOrder();
            setHasLocalPrefs(order !== null || hasDashboardSectionLocalDelta(serverSections, stored));
            return merged;
        });
    };

    const useServerLayout = () => {
        clearAllJtDashboardLocalPrefs();
        setVisible(serverSections);
        setSectionOrder([...DEFAULT_JT_DASHBOARD_SECTION_ORDER]);
        setHasLocalPrefs(false);
    };

    const reorderSections = (fromIdx: number, toIdx: number) => {
        if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
        setSectionOrder((prev) => {
            const next = [...prev];
            const [removed] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, removed);
            const sanitized = sanitizeJtDashboardSectionOrder(next);
            writeJtDashboardSectionOrder(sanitized);
            return sanitized;
        });
        setHasLocalPrefs(true);
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
    const sumDaily30 = stats.sumDaily30;
    const daysWithData = stats.daily30.filter((d) => d.count > 0).length;
    const maxDailyFee = Math.max(...stats.dailyFee30.map((d) => d.feeTotal), 0);
    const maxDailyFeeSafe = Math.max(maxDailyFee, 1);
    const sumDailyFee30 = stats.sumDailyFee30;
    const daysWithFeeData = stats.dailyFee30.filter((d) => d.feeTotal > 0).length;
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
                    <button
                        type="button"
                        id="jt-dash-toggle-pick"
                        aria-expanded={pickBlocksOpen}
                        aria-controls="jt-dash-panel-pick"
                        onClick={() => setPickBlocksOpen((o) => !o)}
                        className="w-full px-4 py-3 flex flex-wrap items-start gap-3 text-left border-b border-zinc-800/80 bg-zinc-950/30 hover:bg-zinc-900/40 transition-colors"
                    >
                        <span
                            className={`mt-0.5 text-zinc-500 shrink-0 transition-transform duration-200 ${pickBlocksOpen ? '' : '-rotate-90'}`}
                            aria-hidden
                        >
                            ▼
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-100">เลือกบล็อกที่แสดง</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                                การซ่อนบล็อกจากหน้านี้เก็บในเบราว์เซอร์ — ถ้าปิดบล็อกใน{' '}
                                <Link href="/admin/settings#jt-dashboard-sections" className="text-sky-400 hover:underline font-medium">
                                    ตั้งค่าเว็บไซต์
                                </Link>{' '}
                                บล็อกนั้นจะไม่แสดงเสมอ (ไม่ถูกค่าที่เลือกในเครื่องเปิดทับ)
                            </p>
                        </div>
                        {hasLocalPrefs ? (
                            <span className="text-[11px] font-medium text-amber-300/95 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 shrink-0">
                                มุมมองเฉพาะเครื่องนี้
                            </span>
                        ) : null}
                    </button>
                    {pickBlocksOpen ? (
                        <div id="jt-dash-panel-pick" className="px-4 py-4 border-b border-zinc-800/80" role="region" aria-labelledby="jt-dash-toggle-pick">
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {JT_DASHBOARD_SECTION_KEYS.map((key) => {
                                    const allowedOnServer = serverSections[key];
                                    return (
                                        <label
                                            key={key}
                                            className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                                                allowedOnServer
                                                    ? 'bg-zinc-900/50 border-zinc-800/90 cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/80'
                                                    : 'bg-zinc-950/60 border-zinc-800/50 cursor-not-allowed opacity-60'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                disabled={!allowedOnServer}
                                                className="mt-0.5 rounded border-zinc-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-zinc-950 disabled:opacity-50"
                                                checked={v[key]}
                                                onChange={() => toggleSection(key)}
                                            />
                                            <span className="text-xs text-zinc-200 leading-snug">
                                                {JT_DASHBOARD_SECTION_LABELS[key]}
                                                {!allowedOnServer ? (
                                                    <span className="block text-[10px] text-zinc-600 mt-1">
                                                        ปิดจากระบบ — เปิดได้ที่ตั้งค่าเว็บไซต์
                                                    </span>
                                                ) : null}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    <button
                        type="button"
                        id="jt-dash-toggle-order"
                        aria-expanded={orderBlocksOpen}
                        aria-controls="jt-dash-panel-order"
                        onClick={() => setOrderBlocksOpen((o) => !o)}
                        className="w-full px-4 py-3 flex items-start gap-3 text-left border-b border-zinc-800/80 bg-zinc-950/30 hover:bg-zinc-900/40 transition-colors"
                    >
                        <span
                            className={`mt-0.5 text-zinc-500 shrink-0 transition-transform duration-200 ${orderBlocksOpen ? '' : '-rotate-90'}`}
                            aria-hidden
                        >
                            ▼
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-100">ลำดับบล็อกบนแดชบอร์ด</p>
                            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                                ลากแถวเพื่อเปลี่ยนตำแหน่ง — ถ้า &quot;กราฟ 30 วัน&quot; ถัดจาก &quot;Top ผู้ส่ง&quot; ทั้งคู่เปิด บนจอใหญ่จะได้กราฟรายวัน (จำนวน + ค่าส่ง) คู่กับ Top ผู้ส่ง · แมปฟิลด์แพลตฟอร์ม/ช่องทาง (เช่น platform ก่อน order_source){' '}
                                <Link href="/admin/settings#jt-channel-fields" className="text-sky-400 hover:underline font-medium whitespace-nowrap">
                                    ตั้งค่าที่นี่
                                </Link>
                            </p>
                        </div>
                    </button>
                    {orderBlocksOpen ? (
                        <div id="jt-dash-panel-order" className="px-4 py-4 border-b border-zinc-800/80" role="region" aria-labelledby="jt-dash-toggle-order">
                            <ul className="space-y-1.5 max-w-xl">
                                {sectionOrder.map((sectionKey, idx) => (
                                    <li
                                        key={sectionKey}
                                        draggable
                                        onDragStart={(e) => {
                                            setDragSectionIdx(idx);
                                            e.dataTransfer.effectAllowed = 'move';
                                            e.dataTransfer.setData('text/plain', String(idx));
                                        }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            e.dataTransfer.dropEffect = 'move';
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            const from = dragSectionIdx;
                                            if (from != null) reorderSections(from, idx);
                                            setDragSectionIdx(null);
                                        }}
                                        onDragEnd={() => setDragSectionIdx(null)}
                                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs cursor-grab active:cursor-grabbing transition-colors ${
                                            dragSectionIdx === idx
                                                ? 'border-blue-500/60 bg-blue-950/40 text-zinc-100'
                                                : 'border-zinc-700/90 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600'
                                        }`}
                                    >
                                        <span className="text-zinc-500 select-none" aria-hidden>
                                            ⋮⋮
                                        </span>
                                        <span className="font-medium text-zinc-100">{JT_DASHBOARD_SECTION_LABELS[sectionKey]}</span>
                                        <span className="text-[10px] text-zinc-600 ml-auto font-mono">{sectionKey}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <div className="px-4 py-3 bg-zinc-950/20">
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

            {anyJtSectionVisible(v)
                ? buildOrderedDashboardBlocks({
                      stats,
                      v,
                      sectionOrder,
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
                      setChartWindowDays: setChartWindowDaysPersist,
                  })
                : null}
        </div>
    );
}
