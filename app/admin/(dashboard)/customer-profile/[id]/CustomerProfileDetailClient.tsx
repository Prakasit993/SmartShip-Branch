'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Check,
    CheckCircle2,
    Clock3,
    ClipboardEdit,
    Copy,
    Crown,
    Eye,
    EyeOff,
    History,
    Info,
    Loader2,
    Package,
    Pencil,
    RefreshCw,
    Scale,
    StickyNote,
    Wallet,
    X,
} from 'lucide-react';

type Customer = {
    id: string;
    name: string | null;
    phone: string | null;
    vip_code: string | null;
    address: string | null;
    created_at: string | null;
    sender_key: string | null;
    override_phone: string | null;
    override_name: string | null;
    admin_notes: string | null;
    updated_by: string | null;
    updated_at: string | null;
};

type HistoryEntry = {
    id: number;
    changed_field: 'override_phone' | 'override_name' | 'admin_notes';
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
    changed_at: string;
};

type Kpi = {
    total: number;
    closed: number;
    overdueOver3Days: number;
    overdueOver7Days: number;
    withIssue: number;
};

type WeightAnomalyRow = {
    awb_number: string | null;
    booking_date: string | null;
    admin_billable: number;
    gateway_billable: number;
    ratio: number;
    diff_kg: number;
};

type WeightSummary = {
    samples: { billed: number; order: number; gateway: number };
    sum: { billed: number; order: number; gateway: number };
    avg: { billed: number; order: number; gateway: number };
    adjustedCount: number;
    anomalyCount: number;
    anomalyShipments: WeightAnomalyRow[];
};

type CodSummary = {
    totalAmount: number;
    paidCount: number;
    paidAmount: number;
    pendingCount: number;
    pendingAmount: number;
    noCollectionCount: number;
};

type Financial = {
    customer_name: string;
    shipment_count: number;
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    avg_profit_per_shipment: number;
} | null;

type ApiResponse = {
    customer: Customer;
    history: HistoryEntry[];
    kpi: Kpi;
    weight: WeightSummary;
    cod: CodSummary;
    financial: Financial;
    financial_refreshed_at: string | null;
    date_range: { from: string; to: string } | null;
};

const AVATAR_GRADIENTS = [
    'from-sky-500/85 to-indigo-500/85',
    'from-emerald-500/85 to-teal-500/85',
    'from-fuchsia-500/85 to-pink-500/85',
    'from-amber-500/85 to-orange-500/85',
    'from-violet-500/85 to-purple-500/85',
    'from-rose-500/85 to-red-500/85',
    'from-cyan-500/85 to-blue-500/85',
    'from-lime-500/85 to-green-500/85',
];

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

function fmtCount(n: number): string {
    return n.toLocaleString('th-TH');
}

function fmtThb(n: number): string {
    return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKg(n: number): string {
    return `${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} กก.`;
}

function fmtPct(part: number, total: number): string {
    if (total <= 0) return '0%';
    return `${Math.round((part / total) * 1000) / 10}%`;
}

function maskPhone(phone: string | null): string {
    if (!phone) return '—';
    const t = phone.trim();
    if (!t) return '—';
    if (t.length <= 4) return t;
    return `${'*'.repeat(Math.max(0, t.length - 4))}${t.slice(-4)}`;
}

function shortDate(s: string | null): string {
    if (!s) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
    if (!m) return s;
    return `${m[1]}-${m[2]}-${m[3]}`;
}

function formatSnapshotAge(iso: string | null): string | null {
    if (!iso) return null;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    const diffMs = Date.now() - t;
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 60) return `cache ${Math.max(diffMin, 0)} นาทีที่แล้ว`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 48) return `cache ${diffH} ชม.ที่แล้ว`;
    const diffD = Math.round(diffH / 24);
    return `cache ${diffD} วันที่แล้ว`;
}

function formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return iso;
    const d = new Date(t);
    return d.toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function fieldLabel(f: HistoryEntry['changed_field']): string {
    if (f === 'override_phone') return 'เบอร์โทร';
    if (f === 'override_name') return 'ชื่อ';
    return 'หมายเหตุ';
}

export function CustomerProfileDetailClient({ id, isAdmin = false }: { id: string; isAdmin?: boolean }) {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [weightOpen, setWeightOpen] = useState(false);
    const [codOpen, setCodOpen] = useState(false);
    const [activeKpiPanel, setActiveKpiPanel] = useState<'overdue3' | 'overdue7' | 'issue' | null>(null);
    const [showContactFull, setShowContactFull] = useState(true);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const copyToClipboard = useCallback(async (text: string, token: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedToken(token);
            window.setTimeout(() => {
                setCopiedToken((cur) => (cur === token ? null : cur));
            }, 1500);
        } catch (err) {
            console.error('[customer-profile] clipboard write failed:', err);
        }
    }, []);

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/customer-profile/${id}`, {
                credentials: 'include',
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `HTTP ${res.status}`);
            }
            setData((await res.json()) as ApiResponse);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const handleSaveOverride = useCallback(
        async (patch: {
            override_phone?: string | null;
            override_name?: string | null;
            admin_notes?: string | null;
            clear_phone?: boolean;
            clear_name?: boolean;
            clear_notes?: boolean;
        }) => {
            const res = await fetch(`/api/admin/customer-profile/${id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || `HTTP ${res.status}`);
            }
            const updated = (await res.json()) as { customer: Customer; history: HistoryEntry[] };
            setData((prev) =>
                prev
                    ? {
                          ...prev,
                          customer: updated.customer ?? prev.customer,
                          history: updated.history ?? prev.history,
                      }
                    : prev
            );
        },
        [id]
    );

    if (loading && !data) {
        return <DetailSkeleton />;
    }

    if (error) {
        return (
            <div className="space-y-3">
                <Link
                    href="/admin/customer-profile"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-sky-300"
                >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                    กลับไปรายชื่อลูกค้า
                </Link>
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200 shadow-lg shadow-rose-950/20">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                </div>
                <button
                    type="button"
                    onClick={fetchDetail}
                    className="group inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200 transition-all hover:-translate-y-0.5 hover:border-sky-500/40 hover:bg-slate-900 hover:text-white hover:shadow-lg hover:shadow-sky-950/30"
                >
                    <RefreshCw className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" aria-hidden />
                    ลองอีกครั้ง
                </button>
            </div>
        );
    }

    if (!data) return null;

    const { customer, history, kpi, weight, cod, financial, date_range } = data;
    const isVip = !!(customer.vip_code && customer.vip_code.trim());
    const effectiveName = customer.override_name?.trim() || customer.name?.trim() || 'ลูกค้าไม่ระบุชื่อ';
    const effectivePhone = customer.override_phone?.trim() || customer.phone || null;
    const hasOverride = !!(customer.override_phone?.trim() || customer.override_name?.trim() || customer.admin_notes?.trim());
    const openShipments = kpi.total - kpi.closed;
    const avatarGradient = pickGradient(customer.sender_key || customer.name);
    const avatarInitial = initialOf(effectiveName);

    return (
        <div className="space-y-4 pb-12 sm:space-y-5">
            <Link
                href="/admin/customer-profile"
                className="group inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition hover:text-sky-300"
            >
                <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" aria-hidden />
                กลับไปรายชื่อลูกค้า
            </Link>

            <section className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900/60 via-slate-950/70 to-slate-950/90 p-3 shadow-xl shadow-black/30 ring-1 ring-white/[0.04] animate-home-fade-up sm:p-4">
                {/* decorative orbs */}
                <div
                    className={`pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br ${
                        isVip ? 'from-amber-500/25 to-orange-500/5' : 'from-sky-500/20 to-indigo-500/5'
                    } blur-3xl animate-hero-blob`}
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-gradient-to-br from-violet-500/15 to-pink-500/5 blur-3xl animate-hero-blob-alt"
                    aria-hidden
                />

                <div className="relative flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGradient} text-xl font-black text-white shadow-md shadow-black/40 ring-2 ring-white/15 sm:h-14 sm:w-14 sm:text-2xl`}
                            aria-hidden
                        >
                            {avatarInitial}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                                    {effectiveName}
                                </h1>
                                {isVip ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/25 to-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/40 shadow-sm shadow-amber-950/20">
                                        <Crown className="h-2.5 w-2.5" aria-hidden />
                                        {customer.vip_code}
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-slate-700/40 px-2 py-0.5 text-[11px] font-semibold text-slate-300 ring-1 ring-slate-600/40">
                                        ลูกค้าทั่วไป
                                    </span>
                                )}
                                {hasOverride ? (
                                    <span
                                        className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300 ring-1 ring-sky-500/30"
                                        title={customer.updated_by ? `แก้โดย ${customer.updated_by} · ${formatDateTime(customer.updated_at)}` : 'มี override'}
                                    >
                                        <ClipboardEdit className="h-2.5 w-2.5" aria-hidden />
                                        แอดมินแก้
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] leading-relaxed text-slate-300">
                                <span className="inline-flex items-center gap-1">
                                    <Package className="h-3 w-3 text-slate-500" aria-hidden />
                                    <span className="font-mono text-slate-200">
                                        {showContactFull ? (effectivePhone ?? '—') : maskPhone(effectivePhone)}
                                    </span>
                                    {history.length > 0 && effectivePhone ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowContactFull((v) => !v)}
                                            className="rounded p-0.5 text-slate-500 transition-colors hover:text-slate-200"
                                            aria-label={showContactFull ? 'ซ่อนเบอร์โทร' : 'แสดงเบอร์โทรเต็ม'}
                                        >
                                            {showContactFull
                                                ? <EyeOff className="h-3 w-3" aria-hidden />
                                                : <Eye className="h-3 w-3" aria-hidden />}
                                        </button>
                                    ) : null}
                                </span>
                                <span className="text-slate-400">
                                    {date_range ? (
                                        <>
                                            <span className="tabular-nums text-slate-200">{date_range.from}</span>
                                            <span className="mx-1 text-slate-600">→</span>
                                            <span className="tabular-nums text-slate-200">{date_range.to}</span>
                                        </>
                                    ) : (
                                        'ยังไม่มีพัสดุในระบบ'
                                    )}
                                </span>
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                <span className="inline-flex items-center gap-1">
                                    <Package className="h-3 w-3 text-slate-500" aria-hidden />
                                    <span className="tabular-nums font-bold text-white">{fmtCount(kpi.total)}</span>
                                    <span className="text-slate-500">พัสดุ</span>
                                </span>
                                <span className="text-slate-700" aria-hidden>·</span>
                                <span className="inline-flex items-center gap-1 text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                                    <span className="tabular-nums font-bold">{fmtPct(kpi.closed, kpi.total)}</span>
                                    <span className="text-slate-500">สำเร็จ</span>
                                </span>
                                {kpi.withIssue > 0 ? (
                                    <>
                                        <span className="text-slate-700" aria-hidden>·</span>
                                        <span className="inline-flex items-center gap-1 text-rose-300">
                                            <AlertCircle className="h-3 w-3" aria-hidden />
                                            <span className="tabular-nums font-bold">{fmtCount(kpi.withIssue)}</span>
                                            <span className="text-slate-500">มีปัญหา</span>
                                        </span>
                                    </>
                                ) : null}
                                {kpi.overdueOver7Days > 0 ? (
                                    <>
                                        <span className="text-slate-700" aria-hidden>·</span>
                                        <span className="inline-flex items-center gap-1 text-red-300">
                                            <AlertTriangle className="h-3 w-3" aria-hidden />
                                            <span className="tabular-nums font-bold">{fmtCount(kpi.overdueOver7Days)}</span>
                                            <span className="text-slate-500">ค้าง&gt;7วัน</span>
                                        </span>
                                    </>
                                ) : null}
                            </div>
                            {financial ? (
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                    <span className="inline-flex items-center gap-1 text-slate-300">
                                        <Wallet className="h-3 w-3 text-slate-500" aria-hidden />
                                        <span className="text-slate-500">รายได้</span>
                                        <span className="tabular-nums font-bold text-sky-300">{fmtThb(financial.total_revenue)}</span>
                                    </span>
                                    <span className="text-slate-700" aria-hidden>·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <span className="text-slate-500">ต้นทุน</span>
                                        <span className="tabular-nums font-bold text-slate-300">{fmtThb(financial.total_cost)}</span>
                                    </span>
                                    <span className="text-slate-700" aria-hidden>·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <span className="text-slate-500">กำไร</span>
                                        <span className={`tabular-nums font-bold ${financial.total_profit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                                            {fmtThb(financial.total_profit)}
                                        </span>
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                        {isAdmin ? (
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="group inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-sky-200 transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-500/20 hover:shadow-md hover:shadow-sky-950/40"
                            >
                                <Pencil className="h-3 w-3 transition-transform group-hover:rotate-12" aria-hidden />
                                แก้ไข
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={fetchDetail}
                            disabled={loading}
                            className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition-all hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-900 hover:text-white hover:shadow-md hover:shadow-black/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                            {loading ? (
                                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            ) : (
                                <RefreshCw className="h-3 w-3 transition-transform group-hover:rotate-180" aria-hidden />
                            )}
                            รีเฟรช
                        </button>
                    </div>
                </div>
            </section>

            {customer.admin_notes ? (
                <section className="animate-home-fade-up home-delay-1 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-amber-500/5 to-orange-500/5 p-3 shadow-lg shadow-amber-950/15 ring-1 ring-amber-500/15">
                    <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 ring-1 ring-amber-500/30">
                            <StickyNote className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">หมายเหตุภายใน</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-amber-100">
                                {customer.admin_notes}
                            </p>
                        </div>
                    </div>
                </section>
            ) : null}

            {/* KPI */}
            <section aria-label="KPI พัสดุ" className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-2.5">
                <KpiCard
                    icon={<Package className="h-4 w-4" aria-hidden />}
                    accent="from-sky-500/40 to-blue-500/10"
                    iconTone="bg-sky-500/15 text-sky-300 ring-sky-500/25"
                    label="พัสดุรวม"
                    value={fmtCount(kpi.total)}
                    hint="ทุกชิ้นที่ sender_name ตรง"
                    delay={0.05}
                />
                <KpiCard
                    icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                    accent="from-emerald-500/40 to-teal-500/10"
                    iconTone="bg-emerald-500/15 text-emerald-300 ring-emerald-500/25"
                    label="สำเร็จ"
                    value={fmtCount(kpi.closed)}
                    hint={`${fmtPct(kpi.closed, kpi.total)} ของพัสดุรวม`}
                    delay={0.1}
                    progress={kpi.total > 0 ? kpi.closed / kpi.total : 0}
                    accentFill="bg-emerald-400/60"
                />
                <KpiCard
                    icon={<Clock3 className="h-4 w-4" aria-hidden />}
                    accent="from-amber-500/40 to-orange-500/10"
                    iconTone="bg-amber-500/15 text-amber-300 ring-amber-500/25"
                    label="ค้าง > 3 วัน"
                    value={fmtCount(kpi.overdueOver3Days)}
                    hint={`${fmtPct(kpi.overdueOver3Days, openShipments)} ของพัสดุที่ยังไม่ปิดงาน`}
                    delay={0.15}
                    progress={openShipments > 0 ? kpi.overdueOver3Days / openShipments : 0}
                    accentFill="bg-amber-400/60"
                    onClick={kpi.overdueOver3Days > 0 ? () => setActiveKpiPanel((v) => (v === 'overdue3' ? null : 'overdue3')) : undefined}
                    isActive={activeKpiPanel === 'overdue3'}
                />
                <KpiCard
                    icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
                    accent="from-red-500/40 to-rose-500/10"
                    iconTone="bg-red-500/15 text-red-300 ring-red-500/25"
                    label="ค้าง > 7 วัน"
                    value={fmtCount(kpi.overdueOver7Days)}
                    hint={`${fmtPct(kpi.overdueOver7Days, openShipments)} ของพัสดุที่ยังไม่ปิดงาน`}
                    delay={0.2}
                    progress={openShipments > 0 ? kpi.overdueOver7Days / openShipments : 0}
                    accentFill="bg-red-400/60"
                    onClick={kpi.overdueOver7Days > 0 ? () => setActiveKpiPanel((v) => (v === 'overdue7' ? null : 'overdue7')) : undefined}
                    isActive={activeKpiPanel === 'overdue7'}
                />
                <KpiCard
                    icon={<AlertCircle className="h-4 w-4" aria-hidden />}
                    accent="from-rose-500/40 to-amber-500/10"
                    iconTone="bg-rose-500/15 text-rose-300 ring-rose-500/25"
                    label="มีปัญหา"
                    value={fmtCount(kpi.withIssue)}
                    hint={`${fmtPct(kpi.withIssue, kpi.total)} ของพัสดุรวม`}
                    delay={0.26}
                    progress={kpi.total > 0 ? kpi.withIssue / kpi.total : 0}
                    accentFill="bg-rose-400/60"
                    onClick={kpi.withIssue > 0 ? () => setActiveKpiPanel((v) => (v === 'issue' ? null : 'issue')) : undefined}
                    isActive={activeKpiPanel === 'issue'}
                />
            </section>

            {/* KPI Drill-down Panel */}
            {activeKpiPanel !== null ? (
                <OverduePanel
                    id={id}
                    type={activeKpiPanel}
                    onClose={() => setActiveKpiPanel(null)}
                    copiedToken={copiedToken}
                    onCopyAwb={copyToClipboard}
                />
            ) : null}

            {/* COD (collapsible — starts closed) */}
            <section className="animate-home-fade-up home-delay-3 rounded-2xl border border-slate-800/80 bg-slate-950/45 p-3 shadow-md shadow-black/20 ring-1 ring-white/[0.03] sm:p-3.5">
                <button
                    type="button"
                    onClick={() => setCodOpen((v) => !v)}
                    className="group flex w-full items-center justify-between gap-2"
                    aria-expanded={codOpen}
                >
                    <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500/25 to-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30 shadow-sm shadow-emerald-950/30">
                            <Wallet className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="text-left">
                            <h2 className="text-[13px] font-bold leading-tight text-white">COD</h2>
                            <p className="text-[10px] leading-snug text-slate-500">cod_amount · cod_status · cod_payment_time</p>
                        </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-slate-300 transition-colors group-hover:border-emerald-500/40 group-hover:text-emerald-200">
                        {codOpen ? 'ซ่อน' : 'ดู'}
                        <span className={`transition-transform ${codOpen ? 'rotate-180' : ''}`}>▾</span>
                    </span>
                </button>
                {codOpen ? (
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <CodTile label="ยอด COD รวม" value={fmtThb(cod.totalAmount)} sub="ทุกพัสดุที่มี cod_amount > 0" tone="text-emerald-300" />
                        <CodTile label="จ่ายแล้ว" value={`${fmtCount(cod.paidCount)} ชิ้น`} sub={`${fmtThb(cod.paidAmount)}${cod.totalAmount > 0 ? ` · ${fmtPct(cod.paidAmount, cod.totalAmount)}` : ''}`} tone="text-sky-300" />
                        <CodTile label="รอจ่าย" value={`${fmtCount(cod.pendingCount)} ชิ้น`} sub={`${fmtThb(cod.pendingAmount)}${cod.totalAmount > 0 ? ` · ${fmtPct(cod.pendingAmount, cod.totalAmount)}` : ''}`} tone="text-amber-300" />
                        <CodTile label="ไม่ได้เก็บ" value={`${fmtCount(cod.noCollectionCount)} ชิ้น`} sub="No Collection" tone="text-rose-300" />
                    </div>
                ) : null}
            </section>

            {/* Weight Anomaly */}
            {weight.anomalyCount > 0 ? (
                <WeightAnomalySection
                    count={weight.anomalyCount}
                    shipments={weight.anomalyShipments}
                    onCopyAwb={(awb) => copyToClipboard(awb, `awb-${awb}`)}
                    onCopyAll={() =>
                        copyToClipboard(
                            weight.anomalyShipments.map((s) => s.awb_number ?? '').filter(Boolean).join('\n'),
                            'anomaly-awbs'
                        )
                    }
                    copiedToken={copiedToken}
                />
            ) : null}

            {/* Weight (collapsible — starts closed) */}
            <section className="animate-home-fade-up home-delay-4 rounded-2xl border border-slate-800/80 bg-slate-950/45 p-3 shadow-md shadow-black/20 ring-1 ring-white/[0.03] sm:p-3.5">
                <button
                    type="button"
                    onClick={() => setWeightOpen((v) => !v)}
                    className="group flex w-full items-center justify-between gap-2"
                    aria-expanded={weightOpen}
                >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500/25 to-violet-500/10 text-violet-300 ring-1 ring-violet-500/30 shadow-sm shadow-violet-950/30">
                            <Scale className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 text-left">
                            <h2 className="text-[13px] font-bold leading-tight text-white">น้ำหนักถูกปรับ</h2>
                            <p className="text-[10px] leading-snug text-slate-500">เทียบ billed · order · gateway</p>
                        </span>
                        {weight.adjustedCount > 0 ? (
                            <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/30">
                                <AlertTriangle className="h-3 w-3" aria-hidden />
                                ถูกปรับ {fmtCount(weight.adjustedCount)} ชิ้น
                            </span>
                        ) : (
                            <span className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3" aria-hidden />
                                ไม่มีการปรับ
                            </span>
                        )}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-slate-300 transition-colors group-hover:border-violet-500/40 group-hover:text-violet-200">
                        {weightOpen ? 'ซ่อน' : 'ดู'}
                        <span className={`transition-transform ${weightOpen ? 'rotate-180' : ''}`}>▾</span>
                    </span>
                </button>
                {weightOpen ? (
                    <div className="mt-2.5 overflow-x-auto rounded-xl border border-slate-800/70">
                        <table className="w-full min-w-[360px] text-left text-xs">
                            <thead className="bg-slate-900/70 text-[10px] uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-2 py-1.5 font-semibold">ฟิลด์</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">รวม</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">เฉลี่ย</th>
                                    <th className="px-2 py-1.5 text-right font-semibold">จำนวน</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/70">
                                <WeightRow name="billed" subtitle="ใช้เก็บเงิน" sum={weight.sum.billed} avg={weight.avg.billed} samples={weight.samples.billed} tone="text-violet-300" />
                                <WeightRow name="order" subtitle="ลูกค้าแจ้ง" sum={weight.sum.order} avg={weight.avg.order} samples={weight.samples.order} tone="text-sky-300" />
                                <WeightRow name="gateway" subtitle="ชั่งจริง" sum={weight.sum.gateway} avg={weight.avg.gateway} samples={weight.samples.gateway} tone="text-emerald-300" />
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </section>

            {history.length > 0 ? (
                <section className="animate-home-fade-up home-delay-5 rounded-2xl border border-slate-800/80 bg-slate-950/45 p-3 shadow-md shadow-black/20 ring-1 ring-white/[0.03] sm:p-3.5">
                    <button
                        type="button"
                        onClick={() => setHistoryOpen((v) => !v)}
                        className="group flex w-full items-center justify-between gap-2"
                        aria-expanded={historyOpen}
                    >
                        <span className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500/25 to-violet-500/10 text-violet-300 ring-1 ring-violet-500/30 shadow-sm shadow-violet-950/30">
                                <History className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="text-left">
                                <h2 className="text-[13px] font-bold leading-tight text-white">ประวัติแก้ไขข้อมูล</h2>
                                <p className="text-[10px] leading-snug text-slate-500">{history.length} รายการล่าสุด</p>
                            </span>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-slate-300 transition-colors group-hover:border-violet-500/40 group-hover:text-violet-200">
                            {historyOpen ? 'ซ่อน' : 'ดู'}
                            <span className={`transition-transform ${historyOpen ? 'rotate-180' : ''}`}>▾</span>
                        </span>
                    </button>
                    {historyOpen ? (
                        <ol className="relative mt-4 space-y-3 border-l border-violet-500/20 pl-5">
                            {history.map((h, idx) => (
                                <li
                                    key={h.id}
                                    className="relative animate-home-fade-up"
                                    style={{ animationDelay: `${Math.min(idx, 5) * 0.04}s` }}
                                >
                                    <span
                                        className="absolute -left-[1.4rem] top-3 flex h-3 w-3 items-center justify-center rounded-full bg-violet-500/30 ring-2 ring-slate-950"
                                        aria-hidden
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                                    </span>
                                    <div className="rounded-xl border border-slate-800/70 bg-slate-900/45 p-3 text-xs text-slate-200 transition-colors hover:border-violet-500/30 hover:bg-slate-900/70">
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                            <span className="rounded-full bg-gradient-to-r from-violet-500/20 to-violet-500/10 px-2 py-0.5 font-semibold text-violet-200 ring-1 ring-violet-500/30">
                                                {fieldLabel(h.changed_field)}
                                            </span>
                                            <span className="tabular-nums text-slate-300">{formatDateTime(h.changed_at)}</span>
                                            <span className="text-slate-600">·</span>
                                            <span className="text-slate-400">{h.changed_by}</span>
                                        </div>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                            <div className="rounded-lg bg-slate-950/60 p-2 ring-1 ring-slate-800/60">
                                                <span className="text-[10px] uppercase tracking-wider text-slate-500">เดิม</span>
                                                <p className="mt-0.5 break-words text-slate-400 line-through">
                                                    {h.old_value || <span className="italic">(ว่าง)</span>}
                                                </p>
                                            </div>
                                            <div className="rounded-lg bg-emerald-500/5 p-2 ring-1 ring-emerald-500/15">
                                                <span className="text-[10px] uppercase tracking-wider text-emerald-300/80">ใหม่</span>
                                                <p className="mt-0.5 break-words text-slate-100">
                                                    {h.new_value || <span className="italic">(ว่าง)</span>}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : null}
                </section>
            ) : null}

            {editOpen ? (
                <EditOverrideModal
                    customer={customer}
                    onClose={() => setEditOpen(false)}
                    onSave={handleSaveOverride}
                />
            ) : null}
        </div>
    );
}

function KpiCard({
    icon,
    accent,
    iconTone,
    label,
    value,
    hint,
    delay = 0,
    progress,
    accentFill,
    onClick,
    isActive = false,
}: {
    icon: React.ReactNode;
    accent: string;
    iconTone: string;
    label: string;
    value: string;
    hint: string;
    delay?: number;
    progress?: number;
    accentFill?: string;
    onClick?: () => void;
    isActive?: boolean;
}) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag
            {...(onClick ? { type: 'button' as const, onClick } : {})}
            className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br from-zinc-900/80 to-zinc-950/70 p-2 shadow-md shadow-black/30 ring-1 ring-white/[0.03] transition-all animate-home-fade-up sm:p-2.5 ${
                isActive
                    ? 'border-sky-500/50 ring-sky-500/20 shadow-sky-950/30 -translate-y-0.5'
                    : 'border-zinc-800/90 hover:-translate-y-0.5 hover:border-zinc-700/90 hover:shadow-lg hover:shadow-black/40'
            } ${onClick ? 'cursor-pointer' : ''}`}
            style={{ animationDelay: `${delay}s` }}
        >
            <div
                className={`pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br ${accent} opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-50`}
                aria-hidden
            />
            <div className="relative flex items-start justify-between gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-md ring-1 ${iconTone}`}>
                    {icon}
                </span>
                {progress !== undefined && (
                    <span className="text-[10px] tabular-nums font-semibold text-zinc-400">
                        {Math.round(progress * 100)}%
                    </span>
                )}
            </div>
            <p className="relative mt-2 text-[10px] font-semibold uppercase leading-tight tracking-wider text-zinc-500">
                {label}
            </p>
            <p className="relative mt-0.5 text-lg font-black tabular-nums tracking-tight text-white sm:text-xl">
                {value}
            </p>
            {progress !== undefined ? (
                <div className="relative mt-1.5 h-0.5 overflow-hidden rounded-full bg-slate-800/60">
                    <div
                        className={`absolute inset-y-0 left-0 rounded-full ${accentFill ?? 'bg-slate-400'} transition-all duration-700`}
                        style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                        aria-hidden
                    />
                </div>
            ) : null}
            <p className="relative mt-1 text-[10px] leading-snug text-zinc-500 line-clamp-2">{hint}</p>
            {onClick ? (
                <p className={`relative mt-1 text-[9px] font-semibold uppercase tracking-wider transition-colors ${isActive ? 'text-sky-400' : 'text-zinc-600 group-hover:text-zinc-400'}`}>
                    {isActive ? '▲ ซ่อน' : '▼ ดูรายชื่อ'}
                </p>
            ) : null}
        </Tag>
    );
}

function WeightRow({
    name,
    subtitle,
    sum,
    avg,
    samples,
    tone,
}: {
    name: string;
    subtitle: string;
    sum: number;
    avg: number;
    samples: number;
    tone: string;
}) {
    return (
        <tr>
            <td className="px-2 py-1.5">
                <span className={`block font-mono text-[11px] font-semibold leading-tight ${tone}`}>{name}</span>
                <span className="block text-[10px] leading-snug text-slate-500">{subtitle}</span>
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums text-slate-200">{fmtKg(sum)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-slate-200">{fmtKg(avg)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{fmtCount(samples)}</td>
        </tr>
    );
}

function WeightAnomalySection({
    count,
    shipments,
    onCopyAwb,
    onCopyAll,
    copiedToken,
}: {
    count: number;
    shipments: WeightAnomalyRow[];
    onCopyAwb: (awb: string) => void;
    onCopyAll: () => void;
    copiedToken: string | null;
}) {
    const [open, setOpen] = useState(count > 0 && count <= 5);
    return (
        <section className="animate-home-fade-up home-delay-3 relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/40 via-slate-950/60 to-slate-950/80 p-3 shadow-md shadow-rose-950/30 ring-1 ring-rose-500/15 sm:p-3.5">
            <div
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-rose-500/25 to-orange-500/5 blur-3xl animate-hero-glow"
                aria-hidden
            />
            <header className="relative flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="group flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={open}
                >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-rose-500/30 to-rose-500/15 text-rose-200 ring-1 ring-rose-500/40 shadow-sm shadow-rose-950/40">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="flex flex-wrap items-center gap-1.5 text-[13px] font-bold leading-tight text-white">
                            เคสน้ำหนักผิดปกติ
                            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500/30 to-rose-500/15 px-1.5 py-0 text-[11px] font-bold text-rose-100 ring-1 ring-rose-500/40">
                                {fmtCount(count)} ชิ้น
                            </span>
                            <span className={`text-rose-300 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                        </h2>
                        <p className="text-[10px] leading-snug text-slate-400">
                            gateway ปรับน้ำหนัก/ปริมาตร &gt; 2.5× admin คีย์ (และห่าง &gt; 1 กก.)
                        </p>
                    </div>
                </button>
                {shipments.length > 0 ? (
                    <CopyButton
                        label="AWB"
                        copiedLabel="คัดลอกแล้ว"
                        onClick={onCopyAll}
                        copied={copiedToken === 'anomaly-awbs'}
                        title="คัดลอก AWB ทั้งหมดของเคสผิดปกติ"
                    />
                ) : null}
            </header>

            {open ? (
                <>
                    {/* Mobile: card list */}
                    <div className="relative mt-2.5 space-y-1.5 sm:hidden">
                        {shipments.length === 0 ? (
                            <p className="rounded-lg border border-rose-500/15 bg-slate-950/40 px-3 py-4 text-center text-[11px] text-slate-500">
                                ไม่มีข้อมูลเคสน้ำหนักผิดปกติ
                            </p>
                        ) : (
                            shipments.map((s, idx) => (
                                <div
                                    key={s.awb_number ?? `anomaly-${idx}`}
                                    className="rounded-lg border border-rose-500/20 bg-slate-950/40 p-2 text-[11px] text-slate-200"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-[11px]">
                                            <AwbChip
                                                awb={s.awb_number}
                                                onCopy={onCopyAwb}
                                                copied={copiedToken === `awb-${s.awb_number}`}
                                            />
                                        </span>
                                        <span className="inline-flex shrink-0 items-center rounded-full bg-gradient-to-r from-rose-500/25 to-amber-500/20 px-1.5 py-0 text-[11px] font-bold tabular-nums text-rose-100 ring-1 ring-rose-500/40">
                                            {s.ratio.toLocaleString('th-TH', { maximumFractionDigits: 1 })}×
                                        </span>
                                    </div>
                                    <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] tabular-nums">
                                        <div>
                                            <span className="block text-slate-500">Admin</span>
                                            <span className="block text-slate-200">{fmtKg(s.admin_billable)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500">Gateway</span>
                                            <span className="block font-semibold text-rose-200">{fmtKg(s.gateway_billable)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500">+ส่วนต่าง</span>
                                            <span className="block text-amber-300">+{fmtKg(s.diff_kg)}</span>
                                        </div>
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-500 tabular-nums">{shortDate(s.booking_date)}</p>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop: table */}
                    <div className="relative mt-2.5 hidden overflow-x-auto rounded-xl border border-rose-500/20 bg-slate-950/40 shadow-inner shadow-black/30 sm:block">
                        <table className="w-full min-w-[640px] text-left text-xs">
                            <thead className="bg-gradient-to-b from-rose-950/40 to-slate-900/50 text-[10px] uppercase tracking-wider text-rose-300/80">
                                <tr>
                                    <th className="px-2.5 py-2 font-semibold">AWB</th>
                                    <th className="px-2.5 py-2 font-semibold">วันที่จอง</th>
                                    <th className="px-2.5 py-2 text-right font-semibold">Admin</th>
                                    <th className="px-2.5 py-2 text-right font-semibold">Gateway</th>
                                    <th className="px-2.5 py-2 text-right font-semibold">+ส่วนต่าง</th>
                                    <th className="px-2.5 py-2 text-right font-semibold">เท่า</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-rose-500/10">
                                {shipments.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-5 text-center text-slate-500">
                                            ไม่มีข้อมูลเคสน้ำหนักผิดปกติ
                                        </td>
                                    </tr>
                                ) : (
                                    shipments.map((s, idx) => (
                                        <tr
                                            key={s.awb_number ?? `anomaly-${idx}`}
                                            className="group/row transition-colors hover:bg-rose-500/[0.06]"
                                        >
                                            <td className="px-2.5 py-1.5 text-[11px]">
                                                <AwbChip
                                                    awb={s.awb_number}
                                                    onCopy={onCopyAwb}
                                                    copied={copiedToken === `awb-${s.awb_number}`}
                                                />
                                            </td>
                                            <td className="px-2.5 py-1.5 tabular-nums text-slate-300">
                                                {shortDate(s.booking_date)}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-200">
                                                {fmtKg(s.admin_billable)}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold text-rose-200">
                                                {fmtKg(s.gateway_billable)}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right tabular-nums text-amber-300">
                                                +{fmtKg(s.diff_kg)}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right">
                                                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-rose-500/25 to-amber-500/20 px-1.5 py-0 text-[11px] font-bold tabular-nums text-rose-100 ring-1 ring-rose-500/40">
                                                    {s.ratio.toLocaleString('th-TH', { maximumFractionDigits: 1 })}×
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {shipments.length >= 50 ? (
                            <p className="border-t border-rose-500/15 px-3 py-1.5 text-[10px] text-rose-300/70">
                                แสดง 50 รายการแรก (เรียงตาม ratio สูงสุด)
                            </p>
                        ) : null}
                    </div>
                </>
            ) : null}
        </section>
    );
}

function CopyButton({
    label,
    copiedLabel,
    onClick,
    copied,
    title,
}: {
    label: string;
    copiedLabel: string;
    onClick: () => void;
    copied: boolean;
    title?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition-all ${
                copied
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:border-sky-500/40 hover:text-sky-200'
            }`}
        >
            {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
            <span className="hidden sm:inline">{copied ? copiedLabel : label}</span>
        </button>
    );
}

function AwbChip({
    awb,
    onCopy,
    copied,
}: {
    awb: string | null;
    onCopy: (awb: string) => void;
    copied: boolean;
}) {
    if (!awb) return <span className="text-slate-600">—</span>;
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onCopy(awb);
            }}
            title={copied ? 'คัดลอกแล้ว' : 'คลิกเพื่อคัดลอก AWB'}
            className={`group/awb inline-flex items-center gap-1 rounded px-1.5 py-0.5 ring-1 transition-all ${
                copied
                    ? 'bg-emerald-500/15 ring-emerald-500/40 text-emerald-200'
                    : 'bg-slate-800/50 ring-slate-700/40 text-slate-100 hover:bg-slate-800 hover:ring-sky-500/40'
            }`}
        >
            <span className="font-mono">{awb}</span>
            {copied ? (
                <Check className="h-2.5 w-2.5" aria-hidden />
            ) : (
                <Copy className="h-2.5 w-2.5 text-slate-500 opacity-0 transition-opacity group-hover/awb:opacity-100" aria-hidden />
            )}
        </button>
    );
}

function CodTile({
    label,
    value,
    sub,
    tone,
    info,
    highlight,
}: {
    label: string;
    value: string;
    sub: string;
    tone: string;
    info?: string;
    highlight?: 'positive' | 'negative';
}) {
    const highlightClass =
        highlight === 'positive'
            ? 'border-emerald-500/25 bg-emerald-500/[0.06] hover:border-emerald-500/35'
            : highlight === 'negative'
            ? 'border-rose-500/25 bg-rose-500/[0.06] hover:border-rose-500/35'
            : 'border-slate-800/80 bg-gradient-to-br from-slate-900/60 to-slate-900/30 hover:border-slate-700/80 hover:from-slate-900/80 hover:to-slate-900/50';
    return (
        <div className={`group rounded-lg border p-2 transition-colors sm:p-2.5 ${highlightClass}`}>
            <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-slate-500">{label}</p>
                {info ? <InfoTip text={info} ariaLabel={`รายละเอียด ${label}`} /> : null}
            </div>
            <p className={`mt-0.5 text-[15px] font-bold tabular-nums tracking-tight ${tone} sm:text-base`}>{value}</p>
            <p className="mt-0 text-[10px] leading-snug text-slate-500">{sub}</p>
        </div>
    );
}

function InfoTip({ text, ariaLabel }: { text: string; ariaLabel?: string }) {
    return (
        <span className="group/tip relative inline-flex">
            <button
                type="button"
                aria-label={ariaLabel ?? 'ข้อมูลเพิ่มเติม'}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-sky-300 focus:text-sky-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
                <Info className="h-3 w-3" aria-hidden />
            </button>
            <span
                role="tooltip"
                className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-2 w-60 max-w-[min(16rem,80vw)] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-[11px] font-normal leading-relaxed text-slate-200 opacity-0 shadow-2xl shadow-black/60 ring-1 ring-white/5 backdrop-blur-sm transition-all duration-150 group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100"
            >
                {text}
                <span
                    aria-hidden
                    className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-slate-700 bg-slate-950/95"
                />
            </span>
        </span>
    );
}

type OverduePanelType = 'overdue3' | 'overdue7' | 'issue';

type OverdueShipment = {
    awb_number: string | null;
    booking_date: string | null;
    days_overdue?: number | null;
    return_type?: string | null;
};

const OVERDUE_META: Record<OverduePanelType, { title: string; borderCls: string; bgCls: string; iconCls: string; badgeCls: string }> = {
    overdue3: {
        title: 'ค้างเกิน 3 วัน',
        borderCls: 'border-amber-500/30',
        bgCls: 'from-amber-950/30',
        iconCls: 'bg-amber-500/20 text-amber-300 ring-amber-500/30',
        badgeCls: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30',
    },
    overdue7: {
        title: 'ค้างเกิน 7 วัน',
        borderCls: 'border-red-500/30',
        bgCls: 'from-red-950/30',
        iconCls: 'bg-red-500/20 text-red-300 ring-red-500/30',
        badgeCls: 'bg-red-500/15 text-red-200 ring-1 ring-red-500/30',
    },
    issue: {
        title: 'พัสดุมีปัญหา',
        borderCls: 'border-rose-500/30',
        bgCls: 'from-rose-950/30',
        iconCls: 'bg-rose-500/20 text-rose-300 ring-rose-500/30',
        badgeCls: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30',
    },
};

function OverduePanel({
    id,
    type,
    onClose,
    copiedToken,
    onCopyAwb,
}: {
    id: string;
    type: OverduePanelType;
    onClose: () => void;
    copiedToken: string | null;
    onCopyAwb: (awb: string, token: string) => void;
}) {
    const [shipments, setShipments] = useState<OverdueShipment[]>([]);
    const [panelLoading, setPanelLoading] = useState(true);
    const [panelError, setPanelError] = useState<string | null>(null);
    const meta = OVERDUE_META[type];

    useEffect(() => {
        const controller = new AbortController();
        setPanelLoading(true);
        setPanelError(null);
        fetch(`/api/admin/customer-profile/${id}/overdue?type=${type}`, {
            credentials: 'include',
            signal: controller.signal,
        })
            .then(async (r) => {
                if (!r.ok) {
                    const b = await r.json().catch(() => ({}));
                    throw new Error((b as { error?: string })?.error || `HTTP ${r.status}`);
                }
                return r.json() as Promise<{ shipments: OverdueShipment[] }>;
            })
            .then((d) => setShipments(d.shipments ?? []))
            .catch((e) => {
                if (e instanceof Error && e.name === 'AbortError') return;
                setPanelError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ');
            })
            .finally(() => setPanelLoading(false));
        return () => controller.abort();
    }, [id, type]);

    return (
        <section className={`animate-home-fade-up rounded-2xl border ${meta.borderCls} bg-gradient-to-br ${meta.bgCls} via-slate-950/60 to-slate-950/80 p-3 shadow-md ring-1 ring-white/[0.03] sm:p-3.5`}>
            <header className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md ring-1 ${meta.iconCls}`}>
                        {type === 'issue' ? <AlertCircle className="h-3.5 w-3.5" aria-hidden /> : <Clock3 className="h-3.5 w-3.5" aria-hidden />}
                    </span>
                    <div>
                        <h2 className="text-[13px] font-bold text-white">{meta.title}</h2>
                        <p className="text-[10px] text-slate-500">
                            {panelLoading ? 'กำลังโหลด…' : panelError ? panelError : `${shipments.length} รายการ`}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
                    aria-label="ปิด"
                >
                    ✕ ปิด
                </button>
            </header>

            <div className="mt-2.5">
                {panelLoading ? (
                    <div className="space-y-1.5">
                        {[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-800/50" />)}
                    </div>
                ) : panelError ? (
                    <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-300">{panelError}</p>
                ) : shipments.length === 0 ? (
                    <p className="rounded-lg border border-slate-800/50 bg-slate-900/30 px-3 py-3 text-center text-[11px] text-slate-500">ไม่พบรายการ</p>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800/60 bg-slate-950/40">
                        <table className="w-full min-w-[400px] text-left text-[12px]">
                            <thead className={`bg-gradient-to-b ${meta.bgCls} to-slate-900/50 text-[10px] uppercase tracking-wider text-slate-400`}>
                                <tr>
                                    <th className="px-2.5 py-2 font-semibold">AWB</th>
                                    <th className="px-2.5 py-2 font-semibold">วันที่จอง</th>
                                    {type !== 'issue' ? (
                                        <th className="px-2.5 py-2 text-right font-semibold">ค้างมา</th>
                                    ) : (
                                        <th className="px-2.5 py-2 font-semibold">ประเภทปัญหา</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {shipments.map((s, idx) => (
                                    <tr key={s.awb_number ?? `r-${idx}`} className="transition-colors hover:bg-slate-800/20">
                                        <td className="px-2.5 py-1.5">
                                            <AwbChip
                                                awb={s.awb_number}
                                                onCopy={(awb) => onCopyAwb(awb, `odawb-${awb}`)}
                                                copied={copiedToken === `odawb-${s.awb_number}`}
                                            />
                                        </td>
                                        <td className="px-2.5 py-1.5 tabular-nums text-slate-300">{shortDate(s.booking_date)}</td>
                                        {type !== 'issue' ? (
                                            <td className="px-2.5 py-1.5 text-right">
                                                <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[11px] font-bold tabular-nums ${meta.badgeCls}`}>
                                                    {s.days_overdue != null ? `${s.days_overdue} วัน` : '—'}
                                                </span>
                                            </td>
                                        ) : (
                                            <td className="px-2.5 py-1.5 text-[11px] text-slate-300">{s.return_type ?? '—'}</td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {shipments.length >= 100 ? (
                            <p className="border-t border-slate-800/50 px-3 py-1.5 text-[10px] text-slate-500">แสดง 100 รายการแรก</p>
                        ) : null}
                    </div>
                )}
            </div>
        </section>
    );
}

function DetailSkeleton() {
    return (
        <div className="space-y-6 pb-20">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-800/60" />
            <div className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/60 p-5 ring-1 ring-white/[0.04]">
                <div
                    className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-sky-500/10 blur-3xl animate-hero-blob"
                    aria-hidden
                />
                <div className="relative flex items-center gap-4">
                    <div className="h-14 w-14 animate-pulse rounded-2xl bg-slate-800/70 sm:h-16 sm:w-16" />
                    <div className="flex-1 space-y-2">
                        <div className="h-7 w-48 animate-pulse rounded bg-slate-800/70" />
                        <div className="h-3 w-72 animate-pulse rounded bg-slate-800/60" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-28 animate-pulse rounded-2xl border border-zinc-800/70 bg-zinc-950/50"
                    />
                ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
                <div className="h-44 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-950/45" />
                <div className="h-44 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-950/45" />
            </div>
            <div className="h-64 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-950/45" />
        </div>
    );
}

function EditOverrideModal({
    customer,
    onClose,
    onSave,
}: {
    customer: Customer;
    onClose: () => void;
    onSave: (patch: {
        override_phone?: string | null;
        override_name?: string | null;
        admin_notes?: string | null;
        clear_phone?: boolean;
        clear_name?: boolean;
        clear_notes?: boolean;
    }) => Promise<void>;
}) {
    const [phone, setPhone] = useState(customer.override_phone ?? '');
    const [name, setName] = useState(customer.override_name ?? '');
    const [notes, setNotes] = useState(customer.admin_notes ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const original = useMemo(
        () => ({
            phone: customer.override_phone ?? '',
            name: customer.override_name ?? '',
            notes: customer.admin_notes ?? '',
        }),
        [customer.override_phone, customer.override_name, customer.admin_notes]
    );

    const handleSubmit = async () => {
        setSaving(true);
        setErr(null);
        try {
            const patch: Parameters<typeof onSave>[0] = {};
            if (phone.trim() !== original.phone.trim()) {
                if (phone.trim() === '') patch.clear_phone = true;
                else patch.override_phone = phone.trim();
            }
            if (name.trim() !== original.name.trim()) {
                if (name.trim() === '') patch.clear_name = true;
                else patch.override_name = name.trim();
            }
            if (notes.trim() !== original.notes.trim()) {
                if (notes.trim() === '') patch.clear_notes = true;
                else patch.admin_notes = notes.trim();
            }
            if (Object.keys(patch).length === 0) {
                onClose();
                return;
            }
            await onSave(patch);
            onClose();
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-home-fade-up"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget && !saving) onClose();
            }}
        >
            <div
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-5 shadow-2xl ring-1 ring-white/10 animate-home-fade-up"
                style={{ animationDelay: '0.05s' }}
            >
                <div
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-sky-500/20 to-indigo-500/5 blur-3xl"
                    aria-hidden
                />
                <header className="relative flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/25 to-sky-500/10 text-sky-300 ring-1 ring-sky-500/30">
                            <Pencil className="h-4 w-4" aria-hidden />
                        </span>
                        <h3 className="text-base font-bold text-white">แก้ไขข้อมูลติดต่อ</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                        aria-label="ปิด"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </header>
                <p className="relative mt-1 text-[11px] leading-relaxed text-slate-500">
                    ค่า override จะแสดงแทนข้อมูลจาก J&amp;T — ปล่อยว่างเพื่อกลับไปใช้ข้อมูลต้นทาง
                </p>

                <div className="relative mt-4 space-y-3">
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">เบอร์โทรศัพท์</span>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder={customer.phone ?? 'ไม่มีในระบบ'}
                            maxLength={50}
                            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30 transition placeholder:text-slate-600 focus:border-sky-500/60 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
                        />
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">ชื่อ / Nickname</span>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={customer.name ?? ''}
                            maxLength={200}
                            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30 transition placeholder:text-slate-600 focus:border-sky-500/60 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
                        />
                    </label>
                    <label className="block">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">หมายเหตุภายใน</span>
                            <span className="text-[10px] tabular-nums text-slate-500">
                                {notes.length}/2000
                            </span>
                        </div>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            maxLength={2000}
                            placeholder="เช่น ขอให้ติดต่อตอน 9-17 น."
                            className="mt-1 w-full resize-y rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 shadow-inner shadow-black/30 transition placeholder:text-slate-600 focus:border-sky-500/60 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
                        />
                    </label>
                </div>

                {err ? (
                    <div className="relative mt-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 shadow-lg shadow-rose-950/20">
                        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{err}</span>
                    </div>
                ) : null}

                <div className="relative mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-950/40 transition-all hover:-translate-y-0.5 hover:from-sky-400 hover:to-indigo-400 hover:shadow-xl hover:shadow-sky-950/60 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                            <Pencil className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" aria-hidden />
                        )}
                        บันทึก
                    </button>
                </div>
            </div>
        </div>
    );
}
