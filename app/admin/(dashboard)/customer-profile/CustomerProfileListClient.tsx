'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    BadgeCheck,
    Crown,
    Inbox,
    Loader2,
    Phone,
    RefreshCw,
    Search,
    Sparkles,
    Users,
    X,
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
    rows: CustomerRow[];
    total: number;
    tab: TabKey;
    limit: number;
    offset: number;
};

type TabKey = 'vip' | 'general';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 250;

const AVATAR_GRADIENTS = [
    'from-sky-500/80 to-indigo-500/80',
    'from-emerald-500/80 to-teal-500/80',
    'from-fuchsia-500/80 to-pink-500/80',
    'from-amber-500/80 to-orange-500/80',
    'from-violet-500/80 to-purple-500/80',
    'from-rose-500/80 to-red-500/80',
    'from-cyan-500/80 to-blue-500/80',
    'from-lime-500/80 to-green-500/80',
];

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

function pickGradient(seed: string | null): string {
    if (!seed) return AVATAR_GRADIENTS[0];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

function initialOf(name: string | null): string {
    if (!name) return '?';
    const t = name.trim();
    if (!t) return '?';
    const code = t.codePointAt(0);
    return code ? String.fromCodePoint(code).toUpperCase() : '?';
}

export function CustomerProfileListClient() {
    const [tab, setTab] = useState<TabKey>('vip');
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');
    const [rows, setRows] = useState<CustomerRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sentinelRef = useRef<HTMLTableRowElement | null>(null);
    const requestSeqRef = useRef(0);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [q]);

    const fetchPage = useCallback(
        async (opts: { tab: TabKey; search: string; offset: number }) => {
            const seq = ++requestSeqRef.current;
            const isInitial = opts.offset === 0;
            if (isInitial) {
                setLoading(true);
                setError(null);
            } else {
                setLoadingMore(true);
            }
            try {
                const params = new URLSearchParams({
                    tab: opts.tab,
                    limit: String(PAGE_SIZE),
                    offset: String(opts.offset),
                });
                if (opts.search) params.set('search', opts.search);
                const res = await fetch(`/api/admin/customer-profile/list?${params.toString()}`, {
                    credentials: 'include',
                });
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body?.error || `HTTP ${res.status}`);
                }
                const json = (await res.json()) as ApiResponse;
                if (seq !== requestSeqRef.current) return;
                setTotal(json.total);
                setRows((prev) => (isInitial ? json.rows : [...prev, ...json.rows]));
            } catch (e) {
                if (seq !== requestSeqRef.current) return;
                setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
                if (isInitial) {
                    setRows([]);
                    setTotal(0);
                }
            } finally {
                if (seq === requestSeqRef.current) {
                    setLoading(false);
                    setLoadingMore(false);
                }
            }
        },
        []
    );

    useEffect(() => {
        fetchPage({ tab, search: debouncedQ, offset: 0 });
    }, [tab, debouncedQ, fetchPage]);

    const hasMore = rows.length < total;

    useEffect(() => {
        if (!hasMore || loading || loadingMore) return;
        const el = sentinelRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    fetchPage({ tab, search: debouncedQ, offset: rows.length });
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, loading, loadingMore, rows.length, tab, debouncedQ, fetchPage]);

    const handleRefresh = useCallback(() => {
        fetchPage({ tab, search: debouncedQ, offset: 0 });
    }, [tab, debouncedQ, fetchPage]);

    const tabCount = useMemo(
        () => (loading && rows.length === 0 ? null : total),
        [loading, rows.length, total]
    );

    const showSkeleton = loading && rows.length === 0;
    const showEmpty = !loading && rows.length === 0 && !error;

    return (
        <div className="space-y-6 pb-20">
            <AdminPageHeader
                title="โปรไฟล์ลูกค้า"
                description="รายชื่อผู้ส่งทั้งหมดจาก J&T แยกตาม VIP / ทั่วไป — กดเข้าไปดูสถิติพัสดุ น้ำหนัก และ COD ของลูกค้ารายคน"
                tone="dark"
                meta={
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500/20 to-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-sky-200 ring-1 ring-sky-400/30">
                        <Sparkles className="h-3 w-3" aria-hidden />
                        Customer · Profile
                    </span>
                }
                actions={
                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="group inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:border-sky-500/40 hover:bg-slate-900 hover:text-white hover:shadow-sky-950/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                        {loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                            <RefreshCw className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" aria-hidden />
                        )}
                        รีเฟรช
                    </button>
                }
            />

            <section className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/45 p-3 shadow-xl shadow-black/20 ring-1 ring-white/[0.04] sm:p-4">
                {/* decorative orbs */}
                <div
                    className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-gradient-to-br from-sky-500/20 to-indigo-500/5 blur-3xl animate-hero-blob"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-gradient-to-br from-amber-500/15 to-rose-500/5 blur-3xl animate-hero-blob-alt"
                    aria-hidden
                />

                <div className="relative">
                    <div role="tablist" aria-label="แท็บลูกค้า" className="grid gap-2 md:grid-cols-2">
                        <TabButton
                            active={tab === 'vip'}
                            onClick={() => setTab('vip')}
                            icon={<Crown className="h-4 w-4" aria-hidden />}
                            label="ลูกค้า VIP"
                            description="มี vip_code จาก J&T"
                            count={tab === 'vip' ? tabCount : null}
                            accent="amber"
                        />
                        <TabButton
                            active={tab === 'general'}
                            onClick={() => setTab('general')}
                            icon={<Users className="h-4 w-4" aria-hidden />}
                            label="ลูกค้าทั่วไป"
                            description="ไม่มี vip_code"
                            count={tab === 'general' ? tabCount : null}
                            accent="sky"
                        />
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:max-w-xs">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-sky-300"
                                aria-hidden
                            />
                            <input
                                type="text"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="ค้นหาด้วยชื่อ / เบอร์ / VIP code"
                                className="peer w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2 pl-9 pr-9 text-sm text-slate-100 shadow-inner shadow-black/30 transition placeholder:text-slate-500 focus:border-sky-500/60 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
                            />
                            {q ? (
                                <button
                                    type="button"
                                    onClick={() => setQ('')}
                                    aria-label="ล้างคำค้นหา"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden />
                                </button>
                            ) : null}
                        </div>
                        <p className="text-xs text-slate-500 tabular-nums">
                            แสดง <span className="font-semibold text-slate-300">{formatCount(rows.length)}</span> จาก{' '}
                            <span className="font-semibold text-slate-300">{formatCount(total)}</span> คน
                        </p>
                    </div>

                    {error ? (
                        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200 shadow-lg shadow-rose-950/20">
                            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                            <span>{error}</span>
                        </div>
                    ) : null}

                    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/40 shadow-inner shadow-black/30">
                        <table className="w-full min-w-[640px] table-fixed text-left text-xs sm:text-sm">
                            <thead className="bg-gradient-to-b from-slate-900/90 to-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="w-[36%] px-3 py-3 font-semibold">ชื่อลูกค้า</th>
                                    <th className="w-[20%] px-3 py-3 font-semibold">เบอร์โทร</th>
                                    <th className="w-[18%] px-3 py-3 font-semibold">VIP Code</th>
                                    <th className="w-[14%] px-3 py-3 text-right font-semibold">จำนวนพัสดุ</th>
                                    <th className="w-[12%] px-3 py-3 text-right font-semibold">ดูข้อมูล</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {showSkeleton ? (
                                    <SkeletonRows />
                                ) : showEmpty ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-12 text-center">
                                            <div className="mx-auto flex max-w-xs flex-col items-center gap-2 text-slate-500">
                                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/60 ring-1 ring-slate-700/50">
                                                    <Inbox className="h-5 w-5 text-slate-500" aria-hidden />
                                                </span>
                                                <p className="text-sm font-semibold text-slate-300">
                                                    {debouncedQ ? 'ไม่พบลูกค้าตามคำค้นหา' : 'ยังไม่มีลูกค้าในกลุ่มนี้'}
                                                </p>
                                                <p className="text-xs leading-relaxed text-slate-500">
                                                    {debouncedQ
                                                        ? 'ลองเปลี่ยนคำค้นหาหรือสลับแท็บอีกครั้ง'
                                                        : 'ข้อมูลจะอัพเดทอัตโนมัติเมื่อ J&T ส่ง shipment ใหม่เข้ามา'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {rows.map((row, idx) => (
                                            <CustomerListRow key={row.id} row={row} animationIndex={idx} />
                                        ))}
                                        {hasMore ? (
                                            <tr ref={sentinelRef}>
                                                <td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-500">
                                                    <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin align-[-2px]" aria-hidden />
                                                    {loadingMore
                                                        ? 'กำลังโหลดเพิ่ม…'
                                                        : `เลื่อนเพื่อโหลดเพิ่ม (${formatCount(total - rows.length)} คนที่เหลือ)`}
                                                </td>
                                            </tr>
                                        ) : null}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}

function CustomerListRow({ row, animationIndex }: { row: CustomerRow; animationIndex: number }) {
    const gradient = pickGradient(row.name);
    const initial = initialOf(row.name);
    // limit stagger to first ~8 rows; later rows fade together to avoid long delays
    const delay = Math.min(animationIndex, 8) * 0.04;

    return (
        <tr
            className="group animate-home-fade-up transition-colors hover:bg-gradient-to-r hover:from-slate-900/80 hover:via-slate-900/60 hover:to-slate-900/30"
            style={{ animationDelay: `${delay}s` }}
        >
            <td className="px-3 py-2.5 text-slate-100">
                <div className="flex items-center gap-2.5">
                    <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[13px] font-bold text-white shadow-md shadow-black/40 ring-1 ring-white/10`}
                        aria-hidden
                    >
                        {initial}
                    </span>
                    <span className="block min-w-0 flex-1 truncate font-medium" title={row.name ?? ''}>
                        {row.name || <span className="italic text-slate-500">ไม่ระบุชื่อ</span>}
                    </span>
                </div>
            </td>
            <td className="px-3 py-2.5 text-slate-300">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Phone className="h-3 w-3 text-slate-500" aria-hidden />
                    {maskPhone(row.phone)}
                </span>
            </td>
            <td className="px-3 py-2.5">
                {row.vip_code ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/40 shadow-sm shadow-amber-950/20">
                        <BadgeCheck className="h-3 w-3" aria-hidden />
                        {row.vip_code}
                    </span>
                ) : (
                    <span className="text-slate-600">—</span>
                )}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
                <span className="font-semibold text-slate-100">{formatCount(row.shipment_count)}</span>
                <span className="ml-1 text-[10px] text-slate-500">ชิ้น</span>
            </td>
            <td className="px-3 py-2.5 text-right">
                <Link
                    href={`/admin/customer-profile/${row.id}`}
                    prefetch
                    onMouseEnter={() => {
                        void fetch(`/api/admin/customer-profile/${row.id}`, {
                            credentials: 'include',
                        }).catch(() => {});
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-100 hover:shadow-md hover:shadow-sky-950/40 group-hover:border-sky-400/60"
                >
                    ดู
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </Link>
            </td>
        </tr>
    );
}

function SkeletonRows() {
    return (
        <>
            {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-home-fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                    <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                            <span className="h-8 w-8 shrink-0 rounded-full bg-slate-800/70" />
                            <span className="block h-3.5 w-32 rounded bg-slate-800/70" />
                        </div>
                    </td>
                    <td className="px-3 py-3">
                        <span className="block h-3 w-20 rounded bg-slate-800/70" />
                    </td>
                    <td className="px-3 py-3">
                        <span className="block h-4 w-16 rounded-full bg-slate-800/70" />
                    </td>
                    <td className="px-3 py-3 text-right">
                        <span className="ml-auto block h-3 w-10 rounded bg-slate-800/70" />
                    </td>
                    <td className="px-3 py-3 text-right">
                        <span className="ml-auto block h-5 w-10 rounded-lg bg-slate-800/70" />
                    </td>
                </tr>
            ))}
        </>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label,
    description,
    count,
    accent,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    description: string;
    count: number | null;
    accent: 'sky' | 'amber';
}) {
    const activeClasses =
        accent === 'amber'
            ? 'border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-amber-500/8 to-orange-500/10 text-white shadow-lg shadow-amber-950/25 ring-1 ring-amber-500/25'
            : 'border-sky-500/50 bg-gradient-to-br from-sky-500/15 via-sky-500/8 to-indigo-500/10 text-white shadow-lg shadow-sky-950/30 ring-1 ring-sky-500/25';
    const iconActiveClass = accent === 'amber' ? 'text-amber-300' : 'text-sky-300';
    const countActiveClass =
        accent === 'amber'
            ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30'
            : 'bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/30';

    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`group relative overflow-hidden rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                active
                    ? activeClasses
                    : 'border-slate-800 bg-slate-900/55 text-slate-400 hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200 hover:shadow-md hover:shadow-black/30'
            }`}
        >
            {active ? (
                <span
                    aria-hidden
                    className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl ${
                        accent === 'amber' ? 'bg-amber-500/20' : 'bg-sky-500/25'
                    }`}
                />
            ) : null}
            <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={active ? iconActiveClass : 'text-slate-500 group-hover:text-slate-400'}>
                        {icon}
                    </span>
                    {label}
                </span>
                <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums transition-colors ${
                        active ? countActiveClass : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-300'
                    }`}
                >
                    {count == null ? '…' : formatCount(count)}
                </span>
            </span>
            <span className="relative mt-1 block text-xs leading-relaxed text-slate-500">
                {description}
            </span>
        </button>
    );
}
