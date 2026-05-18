'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    BadgeCheck,
    CheckCircle2,
    Clock3,
    Crown,
    Loader2,
    Package,
    RefreshCw,
    Scale,
    Wallet,
} from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';

type Customer = {
    id: string;
    name: string | null;
    phone: string | null;
    vip_code: string | null;
    address: string | null;
    created_at: string | null;
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

export function CustomerProfileDetailClient({ id }: { id: string }) {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    const { customer, kpi, weight, cod, financial, financial_refreshed_at, date_range, shipments } = data;
    const isVip = !!(customer.vip_code && customer.vip_code.trim());
    const financialSnapshotAge = formatSnapshotAge(financial_refreshed_at);

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
                title={customer.name?.trim() || 'ลูกค้าไม่ระบุชื่อ'}
                description={`เบอร์โทร ${maskPhone(customer.phone)} · ${
                    date_range ? `ช่วงข้อมูล ${date_range.from} → ${date_range.to}` : 'ยังไม่มีพัสดุในระบบ'
                }`}
                tone="dark"
                meta={
                    isVip ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
                            <Crown className="h-3 w-3" aria-hidden />
                            {customer.vip_code}
                        </span>
                    ) : (
                        <span className="rounded-full bg-slate-700/40 px-2.5 py-0.5 text-xs font-semibold text-slate-300 ring-1 ring-slate-600/40">
                            ลูกค้าทั่วไป
                        </span>
                    )
                }
                actions={
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
                }
            />

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
