'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, InboxIcon } from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { TiktokN8nUpload } from './TiktokN8nUpload';
import { TiktokTopSendersPanel, TiktokTopProductsPanel } from './TiktokTopPanels';
import { ThailandChoropleth, type MapMetrics } from './ThailandChoropleth';
import { TiktokIssueTracking } from './TiktokIssueTracking';
import { CostAreaInspectionSection } from '@app/admin/(dashboard)/jt-dashboard/JtCostAreaInspection';

function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Stats = { total: number; closedCount: number };
type SenderRow = { sender: string; shop: string; count: number };
type ProductRow = { name: string; count: number };
type TopLists = { topSenders: SenderRow[]; topProducts: ProductRow[] };

export function TiktokDashboardClient() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [topLists, setTopLists] = useState<TopLists | null>(null);
    const [topLoading, setTopLoading] = useState(false);
    const [provinceCounts, setProvinceCounts] = useState<Record<string, number> | null>(null);
    const [mapMetrics, setMapMetrics] = useState<MapMetrics | null>(null);
    const [issueRefreshToken, setIssueRefreshToken] = useState(0);

    const loadStats = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/tiktok-shipments/stats', { credentials: 'include' });
            if (!res.ok) return;
            const json = (await res.json()) as Stats;
            setStats({ total: json.total ?? 0, closedCount: json.closedCount ?? 0 });
        } catch {
            /* คงค่าเดิม */
        }
    }, []);

    const loadTopLists = useCallback(async () => {
        setTopLoading(true);
        try {
            const res = await fetch('/api/admin/tiktok-shipments/top-lists', { credentials: 'include' });
            if (!res.ok) return;
            const json = (await res.json()) as TopLists;
            setTopLists({
                topSenders: Array.isArray(json.topSenders) ? json.topSenders : [],
                topProducts: Array.isArray(json.topProducts) ? json.topProducts : [],
            });
        } catch {
            /* คงค่าเดิม */
        } finally {
            setTopLoading(false);
        }
    }, []);

    const loadProvinces = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/tiktok-shipments/by-province', { credentials: 'include' });
            if (!res.ok) return;
            const json = (await res.json()) as { counts: Record<string, number> };
            setProvinceCounts(json.counts ?? {});
        } catch {
            /* คงค่าเดิม */
        }
    }, []);

    const loadMapMetrics = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/tiktok-shipments/map-metrics', { credentials: 'include' });
            if (!res.ok) return; // ยังไม่รัน migration → แผนที่ใช้โหมด total อย่างเดียว
            const json = (await res.json()) as MapMetrics;
            setMapMetrics(json);
        } catch {
            /* คงค่าเดิม */
        }
    }, []);

    useEffect(() => {
        loadStats();
        loadTopLists();
        loadProvinces();
        loadMapMetrics();
    }, [loadStats, loadTopLists, loadProvinces, loadMapMetrics]);

    const refreshAll = () => {
        loadStats();
        loadTopLists();
        loadProvinces();
        loadMapMetrics();
        setIssueRefreshToken((t) => t + 1);
    };

    const handleUploadSuccess = () => {
        loadStats();
        loadTopLists();
        loadProvinces();
        loadMapMetrics();
        setIssueRefreshToken((t) => t + 1);
    };

    const closedPct = stats && stats.total > 0 ? (stats.closedCount / stats.total) * 100 : 0;
    const isEmpty = stats !== null && stats.total === 0;
    const initialLoading = stats === null;

    // ช่วงวันที่สำหรับ "พื้นที่ปิดงานช้า" — tiktok ไม่มี date filter ใช้ย้อนหลัง 1 ปี
    const areaRange = useMemo(() => {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 365);
        return { from: ymd(from), to: ymd(to) };
    }, []);

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="relative">
                <AdminPageHeader
                    className="pr-24"
                    title="TikTok Shop"
                    description="ข้อมูลการจัดส่งจาก TikTok Shop — นำเข้าจากไฟล์ Excel หรือ CSV ผ่านปุ่มอัปโหลด"
                    tone="dark"
                    meta={
                        <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30">
                            TikTok · ขนส่ง
                        </span>
                    }
                />
                <div className="absolute right-0 top-0 z-10 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={refreshAll}
                        title="รีเฟรชข้อมูล"
                        aria-label="รีเฟรชข้อมูล"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                    >
                        <RefreshCw className={`h-4 w-4 ${topLoading ? 'animate-spin' : ''}`} aria-hidden />
                    </button>
                    <TiktokN8nUpload onUploadSuccess={handleUploadSuccess} />
                </div>
            </div>

            {/* กำลังโหลดครั้งแรก */}
            {initialLoading && (
                <div className="flex items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-900/45 p-16">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                        <RefreshCw className="h-8 w-8 animate-spin" aria-hidden />
                        <p className="text-sm">กำลังโหลดข้อมูล…</p>
                    </div>
                </div>
            )}

            {/* ยังไม่มีข้อมูล */}
            {isEmpty && (
                <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20">
                        <InboxIcon className="h-8 w-8" aria-hidden />
                    </div>
                    <div className="space-y-1">
                        <p className="text-base font-semibold text-slate-200">ยังไม่มีข้อมูล TikTok Shop</p>
                        <p className="text-sm text-slate-500">กดปุ่ม <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/25">📊 xlsx</span> มุมขวาบน เพื่อนำเข้าไฟล์ Excel หรือ CSV</p>
                    </div>
                </div>
            )}

            {/* การ์ดสรุป */}
            {stats && !isEmpty && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        label="จำนวนพัสดุ"
                        value={stats.total.toLocaleString('th-TH')}
                        icon="📦"
                        accent="from-sky-500 to-blue-700"
                        hint="พัสดุ TikTok ทั้งหมดในฐานข้อมูล"
                    />
                    <StatCard
                        label="ปิดงานแล้ว"
                        value={stats.closedCount.toLocaleString('th-TH')}
                        icon="✅"
                        accent="from-emerald-500 to-teal-700"
                        hint={`มีผู้เซ็นรับ (${closedPct.toFixed(1)}% ของทั้งหมด)`}
                    />
                </div>
            )}

            {/* ติดตามปัญหา — มีปัญหา / ตกค้าง / ตีกลับ (ตรวจสอบเท่านั้น ไม่มีต้นทุน) */}
            {stats && !isEmpty && <TiktokIssueTracking refreshToken={issueRefreshToken} />}

            {/* สรุป: กำลังคำนวณครั้งแรก */}
            {topLoading && !topLists && !isEmpty && (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/45 px-4 py-3 text-sm text-slate-400 ring-1 ring-white/[0.03]">
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                    กำลังสรุปผู้ส่ง / สินค้าขายดี…
                </div>
            )}

            {/* สรุป: ผู้ส่งมากสุด + สินค้าในระบบ (pattern เดียวกับ jt-dashboard) */}
            {topLists && !isEmpty && (topLists.topSenders.length > 0 || topLists.topProducts.length > 0) && (
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                    <TiktokTopSendersPanel rows={topLists.topSenders} />
                    <TiktokTopProductsPanel rows={topLists.topProducts} />
                </div>
            )}

            {/* แผนที่ปลายทางรายจังหวัด */}
            {provinceCounts && !isEmpty && Object.keys(provinceCounts).length > 0 && (
                <ThailandChoropleth data={mapMetrics} fallbackTotals={provinceCounts} />
            )}

            {/* พื้นที่ปิดงานช้า (area-only — tiktok ไม่มีต้นทุน) */}
            {stats && !isEmpty && (
                <CostAreaInspectionSection
                    range={areaRange}
                    apiPath="/api/admin/tiktok-shipments/area-detail"
                    showCostView={false}
                    title="พื้นที่ปิดงานช้า"
                    subtitle="พัสดุ TikTok ตามพื้นที่ปลายทาง + จำนวนวันที่ใช้ปิดงาน (ย้อนหลัง 1 ปี)"
                />
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
            <p className="mb-2 text-2xl drop-shadow-sm">{icon}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-white">{value}</p>
            <p className="mt-1 text-[10px] leading-snug text-zinc-600">{hint}</p>
        </div>
    );
}
