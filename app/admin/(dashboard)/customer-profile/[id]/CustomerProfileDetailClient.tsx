'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Clock3,
    ClipboardEdit,
    Crown,
    History,
    Loader2,
    Package,
    Pencil,
    RefreshCw,
    Scale,
    StickyNote,
    Wallet,
    X,
} from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';

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
    pendingWithin3Days: number;
    pendingWithin7Days: number;
    withIssue: number;
};

type WeightSummary = {
    samples: { billed: number; order: number; gateway: number };
    sum: { billed: number; order: number; gateway: number };
    avg: { billed: number; order: number; gateway: number };
    adjustedCount: number;
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

type ShipmentLine = {
    awb_number: string | null;
    booking_date: string | null;
    issue_status: string | null;
    latest_scan_type: string | null;
    latest_scan_time: string | null;
    signer_name: string | null;
    billed_weight: string | null;
    order_weight: string | null;
    gateway_weight: string | null;
    cod_amount: string | null;
    cod_status: string | null;
    cod_payment_time: string | null;
};

type ApiResponse = {
    customer: Customer;
    history: HistoryEntry[];
    kpi: Kpi;
    weight: WeightSummary;
    cod: CodSummary;
    financial: Financial;
    financial_refreshed_at: string | null;
    date_range: { from: string; to: string } | null;
    shipments: ShipmentLine[];
    shipments_total: number;
    shipments_truncated: boolean;
};

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
        return (
            <div className="flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-12">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-400" aria-hidden />
                <span className="text-sm text-slate-400">กำลังโหลดข้อมูลลูกค้า…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-3">
                <Link
                    href="/admin/customer-profile"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                    กลับไปรายชื่อลูกค้า
                </Link>
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                </div>
                <button
                    type="button"
                    onClick={fetchDetail}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white"
                >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    ลองอีกครั้ง
                </button>
            </div>
        );
    }

    if (!data) return null;

    const { customer, history, kpi, weight, cod, financial, financial_refreshed_at, date_range, shipments } = data;
    const isVip = !!(customer.vip_code && customer.vip_code.trim());
    const financialSnapshotAge = formatSnapshotAge(financial_refreshed_at);
    const effectiveName = customer.override_name?.trim() || customer.name?.trim() || 'ลูกค้าไม่ระบุชื่อ';
    const effectivePhone = customer.override_phone?.trim() || customer.phone || null;
    const hasOverride = !!(customer.override_phone?.trim() || customer.override_name?.trim() || customer.admin_notes?.trim());

    return (
        <div className="space-y-6 pb-20">
            <Link
                href="/admin/customer-profile"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                กลับไปรายชื่อลูกค้า
            </Link>

            <AdminPageHeader
                title={effectiveName}
                description={`เบอร์โทร ${maskPhone(effectivePhone)} · ${
                    date_range ? `ช่วงข้อมูล ${date_range.from} → ${date_range.to}` : 'ยังไม่มีพัสดุในระบบ'
                }`}
                tone="dark"
                meta={
                    <div className="flex flex-wrap items-center gap-1.5">
                        {isVip ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
                                <Crown className="h-3 w-3" aria-hidden />
                                {customer.vip_code}
                            </span>
                        ) : (
                            <span className="rounded-full bg-slate-700/40 px-2.5 py-0.5 text-xs font-semibold text-slate-300 ring-1 ring-slate-600/40">
                                ลูกค้าทั่วไป
                            </span>
                        )}
                        {hasOverride ? (
                            <span
                                className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300 ring-1 ring-sky-500/30"
                                title={customer.updated_by ? `แก้โดย ${customer.updated_by} · ${formatDateTime(customer.updated_at)}` : 'มี override'}
                            >
                                <ClipboardEdit className="h-3 w-3" aria-hidden />
                                แอดมินแก้ข้อมูล
                            </span>
                        ) : null}
                    </div>
                }
                actions={
                    <div className="flex items-center gap-2">
                        {isAdmin ? (
                            <button
                                type="button"
                                onClick={() => setEditOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:border-sky-400 hover:bg-sky-500/20"
                            >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                แก้ไขข้อมูลติดต่อ
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={fetchDetail}
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
                    </div>
                }
            />

            {customer.admin_notes ? (
                <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 ring-1 ring-amber-500/15">
                    <div className="flex items-start gap-2">
                        <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">หมายเหตุภายใน</p>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-amber-100">
                                {customer.admin_notes}
                            </p>
                        </div>
                    </div>
                </section>
            ) : null}

            {/* KPI */}
            <section aria-label="KPI พัสดุ" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <KpiCard
                    icon={<Package className="h-4 w-4" aria-hidden />}
                    accent="from-sky-500/40 to-blue-500/10"
                    label="พัสดุรวม"
                    value={fmtCount(kpi.total)}
                    hint="ทุกชิ้นที่ sender_name ตรง"
                />
                <KpiCard
                    icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
                    accent="from-emerald-500/40 to-teal-500/10"
                    label="สำเร็จ"
                    value={fmtCount(kpi.closed)}
                    hint={`${fmtPct(kpi.closed, kpi.total)} ของพัสดุรวม`}
                />
                <KpiCard
                    icon={<Clock3 className="h-4 w-4" aria-hidden />}
                    accent="from-cyan-500/40 to-sky-500/10"
                    label="ค้าง ≤ 3 วัน"
                    value={fmtCount(kpi.pendingWithin3Days)}
                    hint={`${fmtPct(kpi.pendingWithin3Days, kpi.total - kpi.closed)} ของพัสดุที่ยังไม่สำเร็จ`}
                />
                <KpiCard
                    icon={<Clock3 className="h-4 w-4" aria-hidden />}
                    accent="from-indigo-500/40 to-purple-500/10"
                    label="ค้าง ≤ 7 วัน"
                    value={fmtCount(kpi.pendingWithin7Days)}
                    hint={`${fmtPct(kpi.pendingWithin7Days, kpi.total - kpi.closed)} ของพัสดุที่ยังไม่สำเร็จ`}
                />
                <KpiCard
                    icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
                    accent="from-rose-500/40 to-amber-500/10"
                    label="มีปัญหา"
                    value={fmtCount(kpi.withIssue)}
                    hint={`${fmtPct(kpi.withIssue, kpi.total)} ของพัสดุรวม`}
                />
            </section>

            {/* Weight + COD */}
            <div className="grid gap-3 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 ring-1 ring-white/[0.03]">
                    <header className="mb-3 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25">
                            <Scale className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-white">น้ำหนักถูกปรับ</h2>
                            <p className="text-[11px] text-slate-500">
                                เทียบ billed_weight · order_weight · gateway_weight
                            </p>
                        </div>
                        {weight.adjustedCount > 0 ? (
                            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
                                <AlertTriangle className="h-3 w-3" aria-hidden />
                                ถูกปรับ {fmtCount(weight.adjustedCount)} ชิ้น
                            </span>
                        ) : (
                            <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                                ไม่มีการปรับ
                            </span>
                        )}
                    </header>

                    <div className="overflow-x-auto rounded-xl border border-slate-800/70">
                        <table className="w-full min-w-[420px] text-left text-xs">
                            <thead className="bg-slate-900/70 text-[10px] uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-3 py-2 font-semibold">ฟิลด์</th>
                                    <th className="px-3 py-2 text-right font-semibold">รวม</th>
                                    <th className="px-3 py-2 text-right font-semibold">เฉลี่ย/ชิ้น</th>
                                    <th className="px-3 py-2 text-right font-semibold">กลุ่มที่มีข้อมูล</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/70">
                                <WeightRow
                                    name="billed_weight"
                                    subtitle="ใช้เก็บเงินจริง"
                                    sum={weight.sum.billed}
                                    avg={weight.avg.billed}
                                    samples={weight.samples.billed}
                                    tone="text-violet-300"
                                />
                                <WeightRow
                                    name="order_weight"
                                    subtitle="ลูกค้าแจ้งตอนคีย์"
                                    sum={weight.sum.order}
                                    avg={weight.avg.order}
                                    samples={weight.samples.order}
                                    tone="text-sky-300"
                                />
                                <WeightRow
                                    name="gateway_weight"
                                    subtitle="ชั่งจริงที่ gateway"
                                    sum={weight.sum.gateway}
                                    avg={weight.avg.gateway}
                                    samples={weight.samples.gateway}
                                    tone="text-emerald-300"
                                />
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 ring-1 ring-white/[0.03]">
                    <header className="mb-3 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
                            <Wallet className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-white">COD</h2>
                            <p className="text-[11px] text-slate-500">
                                cod_amount · cod_status · cod_payment_time
                            </p>
                        </div>
                    </header>

                    <div className="grid grid-cols-2 gap-2">
                        <CodTile
                            label="ยอด COD รวม"
                            value={fmtThb(cod.totalAmount)}
                            sub="ทุกพัสดุที่มี cod_amount > 0"
                            tone="text-emerald-300"
                        />
                        <CodTile
                            label="จ่ายแล้ว"
                            value={`${fmtCount(cod.paidCount)} ชิ้น`}
                            sub={fmtThb(cod.paidAmount)}
                            tone="text-sky-300"
                        />
                        <CodTile
                            label="รอจ่าย"
                            value={`${fmtCount(cod.pendingCount)} ชิ้น`}
                            sub={fmtThb(cod.pendingAmount)}
                            tone="text-amber-300"
                        />
                        <CodTile
                            label="ไม่ได้เก็บ"
                            value={`${fmtCount(cod.noCollectionCount)} ชิ้น`}
                            sub="No Collection"
                            tone="text-rose-300"
                        />
                    </div>
                </section>
            </div>

            {/* Financial RPC */}
            {financial ? (
                <section className="rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/70 to-slate-950/80 p-4 ring-1 ring-white/[0.03]">
                    <header className="mb-3 flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25">
                            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-white">สรุปกำไร (จาก snapshot)</h2>
                            <p className="text-[11px] text-slate-500">
                                {date_range?.from} → {date_range?.to}
                                {financialSnapshotAge ? ` · ${financialSnapshotAge}` : ''}
                            </p>
                        </div>
                    </header>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <CodTile
                            label="พัสดุที่คำนวณ"
                            value={fmtCount(financial.shipment_count)}
                            sub="ที่มี booking_date"
                            tone="text-slate-200"
                        />
                        <CodTile
                            label="รายได้"
                            value={fmtThb(financial.total_revenue)}
                            sub="total_shipping_fee"
                            tone="text-emerald-300"
                        />
                        <CodTile
                            label="ต้นทุน"
                            value={fmtThb(financial.total_cost)}
                            sub="zone × billable_weight"
                            tone="text-amber-300"
                        />
                        <CodTile
                            label="กำไร"
                            value={fmtThb(financial.total_profit)}
                            sub={`เฉลี่ย ${fmtThb(financial.avg_profit_per_shipment)}/ชิ้น`}
                            tone={financial.total_profit >= 0 ? 'text-sky-300' : 'text-rose-300'}
                        />
                    </div>
                </section>
            ) : null}

            {/* Shipments table */}
            <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 ring-1 ring-white/[0.03]">
                <header className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25">
                        <Package className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div>
                        <h2 className="text-sm font-bold text-white">รายการพัสดุ</h2>
                        <p className="text-[11px] text-slate-500">
                            แสดง {fmtCount(shipments.length)} จาก {fmtCount(data.shipments_total)} ชิ้น
                            {data.shipments_truncated ? ' (แสดง 200 ชิ้นล่าสุด)' : ''}
                        </p>
                    </div>
                </header>

                <div className="overflow-x-auto rounded-xl border border-slate-800/70">
                    <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="bg-slate-900/70 text-[10px] uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="px-3 py-2 font-semibold">AWB</th>
                                <th className="px-3 py-2 font-semibold">วันที่จอง</th>
                                <th className="px-3 py-2 font-semibold">สถานะปัญหา</th>
                                <th className="px-3 py-2 font-semibold">Scan ล่าสุด</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                            {shipments.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                                        ลูกค้านี้ยังไม่มีพัสดุในระบบ
                                    </td>
                                </tr>
                            ) : (
                                shipments.map((s) => (
                                    <tr
                                        key={s.awb_number ?? Math.random()}
                                        className="transition hover:bg-slate-900/60"
                                    >
                                        <td className="px-3 py-2 font-mono text-[11px] text-slate-100">
                                            {s.awb_number || '—'}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums text-slate-300">
                                            {shortDate(s.booking_date)}
                                        </td>
                                        <td className="px-3 py-2">
                                            {s.issue_status ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
                                                    {s.issue_status}
                                                </span>
                                            ) : s.signer_name ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                                                    ปิดงาน
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-slate-300">
                                            {s.latest_scan_type || '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {history.length > 0 ? (
                <section className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 ring-1 ring-white/[0.03]">
                    <button
                        type="button"
                        onClick={() => setHistoryOpen((v) => !v)}
                        className="flex w-full items-center justify-between gap-2"
                    >
                        <span className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25">
                                <History className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="text-left">
                                <h2 className="text-sm font-bold text-white">ประวัติการแก้ไขข้อมูลติดต่อ</h2>
                                <p className="text-[11px] text-slate-500">{history.length} รายการล่าสุด</p>
                            </span>
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                            {historyOpen ? 'ซ่อน' : 'ดู'}
                        </span>
                    </button>
                    {historyOpen ? (
                        <ul className="mt-3 space-y-2">
                            {history.map((h) => (
                                <li
                                    key={h.id}
                                    className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-200"
                                >
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-semibold text-violet-300 ring-1 ring-violet-500/25">
                                            {fieldLabel(h.changed_field)}
                                        </span>
                                        <span className="tabular-nums">{formatDateTime(h.changed_at)}</span>
                                        <span>· {h.changed_by}</span>
                                    </div>
                                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                                        <div>
                                            <span className="text-[10px] uppercase tracking-wider text-slate-500">เดิม</span>
                                            <p className="break-words text-slate-400 line-through">
                                                {h.old_value || <span className="italic">(ว่าง)</span>}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase tracking-wider text-slate-500">ใหม่</span>
                                            <p className="break-words text-slate-100">
                                                {h.new_value || <span className="italic">(ว่าง)</span>}
                                            </p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
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
    label,
    value,
    hint,
}: {
    icon: React.ReactNode;
    accent: string;
    label: string;
    value: string;
    hint: string;
}) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/50 p-4 shadow-inner">
            <div
                className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-25 blur-2xl`}
                aria-hidden
            />
            <div className="flex items-start justify-between gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800/80 text-slate-200">
                    {icon}
                </span>
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {label}
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums tracking-tight text-white">
                {value}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-zinc-600">{hint}</p>
        </div>
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
            <td className="px-3 py-2">
                <span className={`block font-mono text-[11px] font-semibold ${tone}`}>{name}</span>
                <span className="block text-[10px] text-slate-500">{subtitle}</span>
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-200">{fmtKg(sum)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-200">{fmtKg(avg)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-400">{fmtCount(samples)}</td>
        </tr>
    );
}

function CodTile({
    label,
    value,
    sub,
    tone,
}: {
    label: string;
    value: string;
    sub: string;
    tone: string;
}) {
    return (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/45 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-1 text-base font-bold tabular-nums ${tone}`}>{value}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget && !saving) onClose();
            }}
        >
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl ring-1 ring-white/5">
                <header className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-white">แก้ไขข้อมูลติดต่อ</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                        aria-label="ปิด"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </header>
                <p className="mt-1 text-[11px] text-slate-500">
                    ค่า override จะแสดงแทนข้อมูลจาก J&amp;T — ปล่อยว่างเพื่อกลับไปใช้ข้อมูลต้นทาง
                </p>

                <div className="mt-4 space-y-3">
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">เบอร์โทรศัพท์</span>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder={customer.phone ?? 'ไม่มีในระบบ'}
                            maxLength={50}
                            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
                            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">หมายเหตุภายใน</span>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            maxLength={2000}
                            placeholder="เช่น ขอให้ติดต่อตอน 9-17 น."
                            className="mt-1 w-full resize-y rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500/60 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                    </label>
                </div>

                {err ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{err}</span>
                    </div>
                ) : null}

                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                        )}
                        บันทึก
                    </button>
                </div>
            </div>
        </div>
    );
}
