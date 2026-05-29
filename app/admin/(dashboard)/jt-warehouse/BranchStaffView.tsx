'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Users, Package, CheckCircle2, Clock, AlertTriangle, RefreshCw, Search, Warehouse, Banknote, ChevronRight, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StaffDetailModal } from './StaffDetailModal';
import { CodBucketDrawer, type CodBucketKey } from './CodBucketDrawer';
import { AlertDrawer, type AlertKind } from './AlertDrawer';
import { MiddayKpiCard } from './MiddayKpiCard';
import { CollapsibleSection } from '@app/admin/components/CollapsibleSection';
import type { CodSummary, AlertSummary, DateRange } from './page';

type BranchSummary = {
    delivery_branch_code: string;
    delivery_branch_name: string | null;
    parcel_count: number;
    staff_count: number;
    delivered_count: number;
    pending_count: number;
    stuck_count: number;
};

type StaffSummary = {
    delivery_branch_code: string;
    delivery_branch_name: string | null;
    delivery_staff_id: string;
    delivery_staff_name: string | null;
    delivery_staff_position: string | null;
    delivery_staff_phone: string | null;
    parcel_count: number;
    delivered_count: number;
    pending_count: number;
    stuck_count: number;
    cod_total: number;
};

type LastUploadMeta = {
    last_uploaded_at: string | null;
    total_parcels: number;
    branch_count: number;
    staff_count: number;
};

type Props = {
    branches: BranchSummary[];
    staff: StaffSummary[];
    meta: LastUploadMeta;
    codSummaryByBranch: Record<string, CodSummary>;
    alertSummaryByBranch: Record<string, AlertSummary>;
    range: DateRange;
    today: string; // YYYY-MM-DD ของ Asia/Bangkok — ส่งต่อให้ child fetch
};

function formatTimeAgo(iso: string | null, nowMs: number): string {
    if (!iso) return 'ยังไม่มีการอัปโหลด';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const diffMs = nowMs - then;
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return 'เมื่อสักครู่';
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hrs / 24);
    return `${days} วันที่แล้ว`;
}

// อ่าน hour ใน Asia/Bangkok โดยไม่พึ่ง browser TZ
function bangkokHour(nowMs: number): number {
    return Number.parseInt(
        new Date(nowMs).toLocaleString('en-US', {
            timeZone: 'Asia/Bangkok',
            hour: 'numeric',
            hour12: false,
        }),
        10,
    );
}

// Stale = อยู่ในเวลาทำงาน (06:00–20:59 TZ Bangkok) และข้อมูลค้างเกิน 30 นาที
// ดู [[project-jt-warehouse-business-rules]] § Reporting Cadence
const STALE_THRESHOLD_MIN = 30;

function getStaleStatus(
    iso: string | null,
    nowMs: number,
): { isStale: boolean; minutesAgo: number } {
    if (!iso) return { isStale: false, minutesAgo: 0 };
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return { isStale: false, minutesAgo: 0 };

    const hour = bangkokHour(nowMs);
    if (hour < 6 || hour >= 21) return { isStale: false, minutesAgo: 0 };

    const minutesAgo = Math.floor((nowMs - then) / 60_000);
    return { isStale: minutesAgo > STALE_THRESHOLD_MIN, minutesAgo };
}

function formatNumber(n: number): string {
    return n.toLocaleString('th-TH');
}

function formatCurrency(n: number): string {
    return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BranchStaffView({ branches, staff, meta, codSummaryByBranch, alertSummaryByBranch, range, today }: Props) {
    const router = useRouter();
    const [activeBranch, setActiveBranch] = useState<string>(
        branches[0]?.delivery_branch_code ?? ''
    );
    const [query, setQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // ใช้ nowMs สำหรับ time-based UI — null ก่อน mount เพื่อหลีกเลี่ยง hydration mismatch
    const [nowMs, setNowMs] = useState<number | null>(null);
    useEffect(() => {
        setNowMs(Date.now());
        const id = setInterval(() => setNowMs(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    const staleInfo = useMemo(
        () => (nowMs === null ? null : getStaleStatus(meta.last_uploaded_at, nowMs)),
        [meta.last_uploaded_at, nowMs],
    );

    // Lazy-load detail รายพนักงาน
    const [selectedStaff, setSelectedStaff] = useState<{
        branchCode: string;
        staffId: string;
        staffName: string | null;
    } | null>(null);

    // COD bucket drill-down
    const [selectedBucket, setSelectedBucket] = useState<CodBucketKey | null>(null);
    const activeCodSummary = codSummaryByBranch[activeBranch];

    // Alert kind drill-down
    const [selectedAlert, setSelectedAlert] = useState<AlertKind | null>(null);
    const activeAlertSummary = alertSummaryByBranch[activeBranch];

    // แยกพัสดุที่ยังไม่ assign พนักงาน (staff_id ว่าง) ออกจากพนักงานจริง
    const branchStaff = useMemo(
        () => staff.filter((s) => s.delivery_branch_code === activeBranch),
        [staff, activeBranch]
    );

    const unassignedRow = useMemo(
        () => branchStaff.find((s) => !s.delivery_staff_id || s.delivery_staff_id.trim() === ''),
        [branchStaff]
    );

    const assignedStaff = useMemo(
        () => branchStaff.filter((s) => s.delivery_staff_id && s.delivery_staff_id.trim() !== ''),
        [branchStaff]
    );

    const filteredStaff = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return assignedStaff;
        return assignedStaff.filter((s) =>
            (s.delivery_staff_name ?? '').toLowerCase().includes(q) ||
            (s.delivery_staff_id ?? '').toLowerCase().includes(q) ||
            (s.delivery_staff_phone ?? '').toLowerCase().includes(q)
        );
    }, [assignedStaff, query]);

    const handleRefresh = () => {
        setRefreshing(true);
        router.refresh();
        setTimeout(() => setRefreshing(false), 600);
    };

    if (branches.length === 0) {
        return (
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 px-6 py-10 text-center">
                <Package className="mx-auto h-10 w-10 text-slate-600" aria-hidden />
                <p className="mt-3 text-sm text-slate-400">
                    ยังไม่มีข้อมูล — กดปุ่ม <span className="text-amber-300">อัปโหลดข้อมูล</span> มุมขวาบน
                    เพื่อนำเข้าไฟล์แรก
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Meta strip: last upload + total + refresh */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-slate-500">อัปเดตล่าสุด:</span>
                        <span className="font-medium text-amber-300" suppressHydrationWarning>
                            {nowMs === null ? '—' : formatTimeAgo(meta.last_uploaded_at, nowMs)}
                        </span>
                        {staleInfo?.isStale ? (
                            <span
                                role="alert"
                                title={`ข้อมูลไม่อัปเดตเกิน ${STALE_THRESHOLD_MIN} นาที — auto-sync อาจมีปัญหา`}
                                className="inline-flex animate-pulse items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-300 ring-1 ring-red-500/40"
                            >
                                <AlertCircle className="h-3 w-3" aria-hidden />
                                ข้อมูลค้าง
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-slate-500">รวม:</span>
                        <span className="font-medium text-white">{formatNumber(meta.total_parcels)}</span>
                        <span className="text-slate-500">พัสดุ</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-slate-500">สาขา:</span>
                        <span className="font-medium text-white">{meta.branch_count}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                        <span className="text-slate-500">พนักงาน:</span>
                        <span className="font-medium text-white">{meta.staff_count}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Date range toggle: วันนี้ | ทั้งหมด */}
                    <div
                        role="tablist"
                        aria-label="ช่วงเวลา"
                        className="inline-flex rounded-lg border border-slate-700 bg-slate-900/80 p-0.5 text-xs"
                    >
                        <Link
                            href="?range=today"
                            role="tab"
                            aria-selected={range === 'today'}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                                range === 'today'
                                    ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Calendar className="h-3 w-3" aria-hidden />
                            วันนี้
                        </Link>
                        <Link
                            href="?range=all"
                            role="tab"
                            aria-selected={range === 'all'}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                                range === 'all'
                                    ? 'bg-slate-700 text-white ring-1 ring-slate-600'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            ทั้งหมด
                        </Link>
                    </div>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                        รีเฟรช
                    </button>
                </div>
            </div>

            {/* Branch tabs / cards */}
            <div
                role="tablist"
                aria-label="เลือกสาขา"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
                {branches.map((b) => {
                    const active = b.delivery_branch_code === activeBranch;
                    return (
                        <button
                            key={b.delivery_branch_code}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setActiveBranch(b.delivery_branch_code)}
                            className={`group rounded-2xl border px-4 py-3.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                                active
                                    ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30 shadow-lg shadow-amber-950/30'
                                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className={`text-xs font-mono ${active ? 'text-amber-300' : 'text-slate-500'}`}>
                                        {b.delivery_branch_code}
                                    </p>
                                    <p className={`mt-0.5 truncate font-semibold ${active ? 'text-white' : 'text-slate-200'}`}>
                                        {b.delivery_branch_name || '—'}
                                    </p>
                                </div>
                                <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
                                    active ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-800 text-slate-400'
                                }`}>
                                    <Users className="h-3 w-3" aria-hidden />
                                    {b.staff_count}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                                <Stat
                                    icon={<Package className="h-3 w-3" aria-hidden />}
                                    label="พัสดุ"
                                    value={formatNumber(b.parcel_count)}
                                    tone={active ? 'amber' : 'default'}
                                />
                                <Stat
                                    icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}
                                    label="สำเร็จ"
                                    value={formatNumber(b.delivered_count)}
                                    tone="success"
                                />
                                <Stat
                                    icon={<Clock className="h-3 w-3" aria-hidden />}
                                    label="ค้าง"
                                    value={formatNumber(b.pending_count)}
                                    tone="warn"
                                />
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Phase 4: Mid-day KPI gate */}
            {activeBranch ? <MiddayKpiCard branchCode={activeBranch} /> : null}

            {/* Alert summary card — pending / stuck / problem */}
            {activeAlertSummary ? (
                <CollapsibleSection
                    id="alert-summary"
                    defaultCollapsed
                    icon={<AlertTriangle className="h-4 w-4 text-red-400" aria-hidden />}
                    title="สรุป Alert"
                    subtitle={`(${range === 'today' ? 'วันนี้' : 'ทั้งหมด'})`}
                    summary={
                        <>
                            <span className="text-amber-300 font-mono">{formatNumber(activeAlertSummary.pending.count)}</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-red-300 font-mono">{formatNumber(activeAlertSummary.stuck.count)}</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-orange-300 font-mono">{formatNumber(activeAlertSummary.problem.count)}</span>
                        </>
                    }
                >
                    <div className="grid grid-cols-1 gap-px bg-slate-800/40 sm:grid-cols-3">
                        <AlertTile
                            label="ยังไม่ปิดงาน"
                            count={activeAlertSummary.pending.count}
                            codSum={activeAlertSummary.pending.cod_sum}
                            tone="amber"
                            onClick={() => setSelectedAlert('pending')}
                        />
                        <AlertTile
                            label="ตกค้าง"
                            count={activeAlertSummary.stuck.count}
                            codSum={activeAlertSummary.stuck.cod_sum}
                            tone="red"
                            priority
                            onClick={() => setSelectedAlert('stuck')}
                        />
                        <AlertTile
                            label="มีปัญหา"
                            count={activeAlertSummary.problem.count}
                            codSum={activeAlertSummary.problem.cod_sum}
                            tone="orange"
                            onClick={() => setSelectedAlert('problem')}
                        />
                    </div>
                </CollapsibleSection>
            ) : null}

            {/* COD bucket card — เร่งจัดส่งพัสดุ COD สูง */}
            {activeCodSummary && activeCodSummary.pending_count > 0 ? (
                <CollapsibleSection
                    id="cod-bucket"
                    defaultCollapsed
                    icon={<Banknote className="h-4 w-4 text-emerald-400" aria-hidden />}
                    title="COD ค้างเก็บ"
                    subtitle={`(${formatNumber(activeCodSummary.pending_count)} พัสดุที่ยังไม่ปิดงาน)`}
                    summary={
                        <>
                            <span className="font-mono text-emerald-300 font-bold">
                                ฿{formatCurrency(activeCodSummary.pending_total)}
                            </span>
                            {activeCodSummary.buckets.very_high.count > 0 ? (
                                <>
                                    <span className="text-slate-600">·</span>
                                    <span className="text-red-300">
                                        {activeCodSummary.buckets.very_high.count} ตัว &gt; ฿5k
                                    </span>
                                </>
                            ) : null}
                        </>
                    }
                >
                    <div className="grid grid-cols-2 gap-px bg-slate-800/40 sm:grid-cols-4">
                        <CodBucketTile
                            label="< ฿1,000"
                            count={activeCodSummary.buckets.low.count}
                            sum={activeCodSummary.buckets.low.sum}
                            tone="muted"
                            onClick={() => setSelectedBucket('low')}
                        />
                        <CodBucketTile
                            label="฿1k – 2k"
                            count={activeCodSummary.buckets.mid.count}
                            sum={activeCodSummary.buckets.mid.sum}
                            tone="amber"
                            onClick={() => setSelectedBucket('mid')}
                        />
                        <CodBucketTile
                            label="฿2k – 5k"
                            count={activeCodSummary.buckets.high.count}
                            sum={activeCodSummary.buckets.high.sum}
                            tone="orange"
                            onClick={() => setSelectedBucket('high')}
                        />
                        <CodBucketTile
                            label="> ฿5,000  ⚠️"
                            count={activeCodSummary.buckets.very_high.count}
                            sum={activeCodSummary.buckets.very_high.sum}
                            tone="red"
                            priority
                            onClick={() => setSelectedBucket('very_high')}
                        />
                    </div>
                </CollapsibleSection>
            ) : null}

            {/* Banner: พัสดุยังอยู่ในคลัง รอแจกจ่ายให้พนักงาน */}
            {unassignedRow && unassignedRow.parcel_count > 0 ? (
                <section
                    className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-900/40 px-5 py-4 ring-1 ring-amber-500/10"
                    aria-label="พัสดุที่ยังอยู่ในคลังรอแจกจ่าย"
                >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30">
                        <Warehouse className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                            ยังอยู่ในคลัง — รอแจกจ่ายให้พนักงาน
                        </p>
                        <p className="mt-0.5 flex items-baseline gap-2 text-2xl font-black tabular-nums text-white">
                            {formatNumber(unassignedRow.parcel_count)}
                            <span className="text-sm font-medium text-slate-400">ชิ้น</span>
                        </p>
                    </div>
                    {unassignedRow.cod_total > 0 ? (
                        <div className="border-l border-slate-700/60 pl-4 text-right">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">COD รวม</p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-200">
                                ฿{formatCurrency(unassignedRow.cod_total)}
                            </p>
                        </div>
                    ) : null}
                </section>
            ) : null}

            {/* Staff table */}
            <CollapsibleSection
                id="staff-table"
                defaultCollapsed={false}
                icon={<Users className="h-4 w-4 text-slate-300" aria-hidden />}
                title="พนักงานนำจ่าย"
                subtitle={`(${filteredStaff.length} คน)`}
                summary={
                    <>
                        <span className="font-mono text-slate-300">
                            {formatNumber(assignedStaff.reduce((acc, s) => acc + s.parcel_count, 0))} พัสดุ
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-emerald-300 font-mono">
                            ฿{formatCurrency(assignedStaff.reduce((acc, s) => acc + s.cod_total, 0))}
                        </span>
                    </>
                }
            >
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/40 px-4 py-3">
                    <span className="text-xs text-slate-500">
                        คลิกแถวเพื่อดูรายละเอียดรายคน
                    </span>
                    <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ค้นหา ชื่อ / รหัส / เบอร์"
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/80 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none"
                        />
                    </div>
                </header>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800/80 text-sm">
                        <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-4 py-2.5 text-left font-medium">พนักงาน</th>
                                <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">รหัส / เบอร์</th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                    <span className="inline-flex items-center gap-1">
                                        <Package className="h-3 w-3" aria-hidden />
                                        พัสดุ
                                    </span>
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                    <span className="inline-flex items-center gap-1 text-emerald-400">
                                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                                        สำเร็จ
                                    </span>
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                    <span className="inline-flex items-center gap-1 text-amber-400">
                                        <Clock className="h-3 w-3" aria-hidden />
                                        ค้าง
                                    </span>
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">
                                    <span className="inline-flex items-center gap-1 text-red-400">
                                        <AlertTriangle className="h-3 w-3" aria-hidden />
                                        ตกค้าง
                                    </span>
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium hidden lg:table-cell">COD รวม</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {filteredStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                                        {query ? '🔍 ไม่พบพนักงานตามคำค้นหา' : '— ยังไม่มีข้อมูลพนักงาน —'}
                                    </td>
                                </tr>
                            ) : (
                                filteredStaff.map((s) => (
                                    <tr
                                        key={`${s.delivery_branch_code}-${s.delivery_staff_id}`}
                                        className="cursor-pointer transition hover:bg-slate-900/60"
                                        onClick={() => setSelectedStaff({
                                            branchCode: s.delivery_branch_code,
                                            staffId: s.delivery_staff_id,
                                            staffName: s.delivery_staff_name,
                                        })}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`ดูรายละเอียดพนักงาน ${s.delivery_staff_name || s.delivery_staff_id}`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedStaff({
                                                    branchCode: s.delivery_branch_code,
                                                    staffId: s.delivery_staff_id,
                                                    staffName: s.delivery_staff_name,
                                                });
                                            }
                                        }}
                                    >
                                        <td className="px-4 py-2.5">
                                            <div className="font-medium text-slate-100">
                                                {s.delivery_staff_name || '—'}
                                            </div>
                                            {s.delivery_staff_position ? (
                                                <div className="mt-0.5 text-xs text-slate-500">
                                                    {s.delivery_staff_position}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-2.5 hidden md:table-cell">
                                            <div className="font-mono text-xs text-slate-400">{s.delivery_staff_id}</div>
                                            {s.delivery_staff_phone ? (
                                                <div className="mt-0.5 text-xs text-slate-500">{s.delivery_staff_phone}</div>
                                            ) : null}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-white">
                                            {formatNumber(s.parcel_count)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-300">
                                            {formatNumber(s.delivered_count)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-amber-300">
                                            {formatNumber(s.pending_count)}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-300 hidden sm:table-cell">
                                            {s.stuck_count > 0 ? formatNumber(s.stuck_count) : '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-300 hidden lg:table-cell">
                                            {s.cod_total > 0 ? `฿${formatCurrency(s.cod_total)}` : '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </CollapsibleSection>

            {selectedStaff ? (
                <StaffDetailModal
                    open={true}
                    branchCode={selectedStaff.branchCode}
                    staffId={selectedStaff.staffId}
                    staffNameFallback={selectedStaff.staffName}
                    dateFrom={range === 'today' ? today : null}
                    dateTo={range === 'today' ? today : null}
                    onClose={() => setSelectedStaff(null)}
                />
            ) : null}

            <CodBucketDrawer
                open={selectedBucket !== null}
                branchCode={activeBranch}
                bucket={selectedBucket}
                dateFrom={range === 'today' ? today : null}
                dateTo={range === 'today' ? today : null}
                onClose={() => setSelectedBucket(null)}
            />

            <AlertDrawer
                open={selectedAlert !== null}
                branchCode={activeBranch}
                kind={selectedAlert}
                dateFrom={range === 'today' ? today : null}
                dateTo={range === 'today' ? today : null}
                onClose={() => setSelectedAlert(null)}
            />
        </div>
    );
}

function AlertTile({
    label, count, codSum, tone, priority, onClick,
}: {
    label: string;
    count: number;
    codSum: number;
    tone: 'amber' | 'orange' | 'red';
    priority?: boolean;
    onClick: () => void;
}) {
    const colorClass =
        tone === 'red' ? 'text-red-300 hover:bg-red-500/10' :
        tone === 'orange' ? 'text-orange-300 hover:bg-orange-500/10' :
        'text-amber-300 hover:bg-amber-500/10';

    const disabled = count === 0;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`group relative flex w-full flex-col items-start gap-1 bg-slate-950/40 px-4 py-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${colorClass}`}
        >
            <div className="flex w-full items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-400">{label}</p>
                {!disabled ? (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" aria-hidden />
                ) : null}
            </div>
            <p className={`font-mono text-2xl font-black tabular-nums ${priority && count > 0 ? 'animate-pulse' : ''}`}>
                {formatNumber(count)}
                <span className="ml-1 text-xs font-normal text-slate-500">ชิ้น</span>
            </p>
            {codSum > 0 ? (
                <p className="font-mono text-[11px] text-slate-500">COD ฿{formatCurrency(codSum)}</p>
            ) : (
                <p className="text-[11px] text-slate-600">— ไม่มี COD —</p>
            )}
        </button>
    );
}

function CodBucketTile({
    label, count, sum, tone, priority, onClick,
}: {
    label: string;
    count: number;
    sum: number;
    tone: 'muted' | 'amber' | 'orange' | 'red';
    priority?: boolean;
    onClick: () => void;
}) {
    const colorClass =
        tone === 'red' ? 'text-red-300 hover:bg-red-500/10' :
        tone === 'orange' ? 'text-orange-300 hover:bg-orange-500/10' :
        tone === 'amber' ? 'text-amber-300 hover:bg-amber-500/10' :
        'text-slate-400 hover:bg-slate-800/40';

    const disabled = count === 0;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`group relative flex w-full flex-col items-start gap-1 bg-slate-950/40 px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${colorClass}`}
        >
            <div className="flex w-full items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-400">{label}</p>
                {!disabled ? (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" aria-hidden />
                ) : null}
            </div>
            <p className={`font-mono text-2xl font-black tabular-nums ${priority && count > 0 ? 'animate-pulse' : ''}`}>
                {formatNumber(count)}
                <span className="ml-1 text-xs font-normal text-slate-500">ชิ้น</span>
            </p>
            {sum > 0 ? (
                <p className="font-mono text-[11px] text-slate-500">฿{formatCurrency(sum)}</p>
            ) : (
                <p className="text-[11px] text-slate-600">—</p>
            )}
        </button>
    );
}

function Stat({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    tone: 'default' | 'amber' | 'success' | 'warn';
}) {
    const valueColor =
        tone === 'amber' ? 'text-amber-200' :
        tone === 'success' ? 'text-emerald-300' :
        tone === 'warn' ? 'text-amber-300' :
        'text-slate-200';

    return (
        <div className="rounded-lg bg-slate-950/40 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                {icon}
                {label}
            </div>
            <div className={`mt-0.5 font-mono font-bold tabular-nums ${valueColor}`}>
                {value}
            </div>
        </div>
    );
}
