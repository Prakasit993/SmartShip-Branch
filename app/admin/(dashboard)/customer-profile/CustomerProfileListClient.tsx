'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    BadgeCheck,
    Crown,
    Loader2,
    Phone,
    RefreshCw,
    Search,
    Users,
} from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';

type CustomerRow = {
    id: string;
    name: string | null;
    phone: string | null;
    vip_code: string | null;
    shipment_count: number;
};

type ApiResponse = {
    vip: CustomerRow[];
    general: CustomerRow[];
    total: { vip: number; general: number; matched_senders: number };
};

type TabKey = 'vip' | 'general';

const PAGE_SIZE = 20;

function formatCount(n: number): string {
    return n.toLocaleString('th-TH');
}

function maskPhone(phone: string | null): string {
    if (!phone) return '—';
    const t = phone.trim();
    if (!t) return '—';
    if (t.length <= 4) return t;
    return `${'*'.repeat(Math.max(0, t.length - 4))}${t.slice(-4)}`;
}

export function CustomerProfileListClient() {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>('vip');
    const [q, setQ] = useState('');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinelRef = useRef<HTMLTableRowElement | null>(null);

    const fetchList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/customer-profile/list', {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `HTTP ${res.status}`);
            }
            const json = (await res.json()) as ApiResponse;
            setData(json);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const rows = useMemo(() => {
        if (!data) return [] as CustomerRow[];
        const list = tab === 'vip' ? data.vip : data.general;
        if (!q.trim()) return list;
        const needle = q.trim().toLowerCase();
        return list.filter((r) => {
            const name = (r.name ?? '').toLowerCase();
            const phone = (r.phone ?? '').toLowerCase();
            const vip = (r.vip_code ?? '').toLowerCase();
            return name.includes(needle) || phone.includes(needle) || vip.includes(needle);
        });
    }, [data, tab, q]);

    // Reset visible window when filter / tab / dataset changes
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [tab, q, data]);

    const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
    const hasMore = visibleCount < rows.length;

    // Auto-grow via IntersectionObserver on the sentinel row at the bottom
    useEffect(() => {
        if (!hasMore) return;
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setVisibleCount((n) => Math.min(n + PAGE_SIZE, rows.length));
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, rows.length, visibleCount]);

    const totalVip = data?.total.vip ?? 0;
    const totalGeneral = data?.total.general ?? 0;

    return (
        <div className="space-y-6 pb-20">
            <AdminPageHeader
                title="โปรไฟล์ลูกค้า"
                description="รายชื่อลูกค้าทั้งหมดใน SmartShip แยกตามสถานะ VIP / ทั่วไป — กดเข้าไปดูสถิติพัสดุ น้ำหนัก และ COD ของลูกค้ารายคน"
                tone="dark"
                meta={
                    <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/30">
                        Customer · Profile
                    </span>
                }
                actions={
                    <button
                        type="button"
                        onClick={fetchList}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        )}
                        รีเฟรช
                    </button>
                }
            />

            <section className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-3 shadow-xl shadow-black/10 ring-1 ring-white/[0.03] sm:p-4">
                <div role="tablist" aria-label="แท็บลูกค้า" className="grid gap-2 md:grid-cols-2">
                    <TabButton
                        active={tab === 'vip'}
                        onClick={() => setTab('vip')}
                        icon={<Crown className="h-4 w-4" aria-hidden />}
                        label="ลูกค้า VIP"
                        description="มี vip_code จาก J&T"
                        count={totalVip}
                    />
                    <TabButton
                        active={tab === 'general'}
                        onClick={() => setTab('general')}
                        icon={<Users className="h-4 w-4" aria-hidden />}
                        label="ลูกค้าทั่วไป"
                        description="ไม่มี vip_code"
                        count={totalGeneral}
                    />
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                            aria-hidden
                        />
                        <input
                            type="text"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="ค้นหาด้วยชื่อ / เบอร์ / VIP code"
                            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                    </div>
                    <p className="text-xs text-slate-500">
                        แสดง {formatCount(visibleRows.length)} จาก{' '}
                        {formatCount(rows.length)}
                        {q.trim()
                            ? ` (กรองจาก ${formatCount(tab === 'vip' ? totalVip : totalGeneral)})`
                            : ' คน'}
                    </p>
                </div>

                {error ? (
                    <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
                        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{error}</span>
                    </div>
                ) : null}

                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/40">
                    <table className="w-full min-w-[640px] table-fixed text-left text-xs sm:text-sm">
                        <thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="w-[34%] px-3 py-2.5 font-semibold">ชื่อลูกค้า</th>
                                <th className="w-[20%] px-3 py-2.5 font-semibold">เบอร์โทร</th>
                                <th className="w-[18%] px-3 py-2.5 font-semibold">VIP Code</th>
                                <th className="w-[16%] px-3 py-2.5 text-right font-semibold">
                                    จำนวนพัสดุ
                                </th>
                                <th className="w-[12%] px-3 py-2.5 text-right font-semibold">
                                    ดูข้อมูล
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                            {loading && !data ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden />
                                        กำลังโหลดรายชื่อลูกค้า…
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                                        ไม่มีลูกค้าในกลุ่มนี้
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {visibleRows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className="transition hover:bg-slate-900/60"
                                        >
                                            <td className="px-3 py-2.5 text-slate-100">
                                                <span className="block truncate font-medium" title={row.name ?? ''}>
                                                    {row.name || <span className="text-slate-500 italic">ไม่ระบุชื่อ</span>}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-slate-300">
                                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                                    <Phone className="h-3 w-3 text-slate-500" aria-hidden />
                                                    {maskPhone(row.phone)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                {row.vip_code ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
                                                        <BadgeCheck className="h-3 w-3" aria-hidden />
                                                        {row.vip_code}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                                                {formatCount(row.shipment_count)}
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <Link
                                                    href={`/admin/customer-profile/${row.id}`}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 transition hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-200"
                                                >
                                                    ดู →
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {hasMore ? (
                                        <tr ref={sentinelRef}>
                                            <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">
                                                <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin align-[-2px]" aria-hidden />
                                                กำลังโหลดเพิ่ม… ({formatCount(rows.length - visibleRows.length)} คนที่เหลือ)
                                            </td>
                                        </tr>
                                    ) : null}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label,
    description,
    count,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    description: string;
    count: number;
}) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                active
                    ? 'border-sky-500/50 bg-sky-500/12 text-white shadow-lg shadow-sky-950/25 ring-1 ring-sky-500/20'
                    : 'border-slate-800 bg-slate-900/55 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200'
            }`}
        >
            <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={active ? 'text-sky-300' : 'text-slate-500'}>{icon}</span>
                    {label}
                </span>
                <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                        active
                            ? 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30'
                            : 'bg-slate-800 text-slate-400'
                    }`}
                >
                    {formatCount(count)}
                </span>
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                {description}
            </span>
        </button>
    );
}
