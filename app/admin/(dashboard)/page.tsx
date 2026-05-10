import type { ReactNode } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    BarChart3,
    Coins,
    Hourglass,
    LayoutDashboard,
    Package,
    Tag,
} from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

function localYmd(d: Date): string {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default async function AdminDashboard() {
    const { count: orderCount } = await supabaseAdmin.from('orders').select('*', { count: 'exact', head: true });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todayOrders } = await supabaseAdmin
        .from('orders')
        .select('total_amount')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

    const todaySales = todayOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

    const { count: productCount } = await supabaseAdmin.from('products').select('*', { count: 'exact', head: true });

    const { data: recentOrders } = await supabaseAdmin
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    /* Last 7 days sales — single query + bucket by local date */
    const rangeEnd = new Date();
    rangeEnd.setHours(23, 59, 59, 999);
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - 6);
    rangeStart.setHours(0, 0, 0, 0);

    const { data: weekOrders } = await supabaseAdmin
        .from('orders')
        .select('created_at, total_amount')
        .gte('created_at', rangeStart.toISOString())
        .lte('created_at', rangeEnd.toISOString());

    const dayTotals = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(12, 0, 0, 0);
        dayTotals.set(localYmd(d), 0);
    }

    for (const row of weekOrders ?? []) {
        if (!row.created_at) continue;
        const d = new Date(row.created_at);
        const key = localYmd(d);
        if (dayTotals.has(key)) {
            dayTotals.set(key, (dayTotals.get(key) ?? 0) + (row.total_amount || 0));
        }
    }

    const last7Days = Array.from(dayTotals.entries()).map(([ymd, total]) => {
        const [y, m, day] = ymd.split('-').map(Number);
        const labelDate = new Date(y, m - 1, day);
        return {
            key: ymd,
            label: labelDate.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' }),
            total,
        };
    });

    const maxSale = Math.max(...last7Days.map((d) => d.total), 1);
    const hasWeekSales = last7Days.some((d) => d.total > 0);

    const { data: allOrders } = await supabaseAdmin.from('orders').select('status, payment_status');
    const statusBreakdown = {
        new: allOrders?.filter((o) => o.status === 'new').length || 0,
        confirmed: allOrders?.filter((o) => o.status === 'confirmed').length || 0,
        shipped: allOrders?.filter((o) => o.status === 'shipped').length || 0,
        completed: allOrders?.filter((o) => o.status === 'completed').length || 0,
        canceled: allOrders?.filter((o) => o.status === 'canceled').length || 0,
    };
    const totalOrders = Object.values(statusBreakdown).reduce((a, b) => a + b, 0) || 1;

    const paymentBreakdown = {
        paid: allOrders?.filter((o) => o.payment_status === 'paid').length || 0,
        pending: allOrders?.filter((o) => o.payment_status === 'pending').length || 0,
    };

    const pendingPipeline = statusBreakdown.new + statusBreakdown.confirmed;

    const statusRows = [
        { key: 'new', label: 'ใหม่', count: statusBreakdown.new, bar: 'bg-sky-500' },
        { key: 'confirmed', label: 'ยืนยันแล้ว', count: statusBreakdown.confirmed, bar: 'bg-amber-500' },
        { key: 'shipped', label: 'จัดส่งแล้ว', count: statusBreakdown.shipped, bar: 'bg-violet-500' },
        { key: 'completed', label: 'สำเร็จ', count: statusBreakdown.completed, bar: 'bg-emerald-500' },
        { key: 'canceled', label: 'ยกเลิก', count: statusBreakdown.canceled, bar: 'bg-rose-500' },
    ];

    return (
        <div className="min-w-0 space-y-6 pb-16">
            <AdminPageHeader
                title="Dashboard"
                description="ภาพรวมคำสั่งซื้อ ยอดขาย และสถานะร้าน"
                tone="dark"
                titleLeft={
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
                        <LayoutDashboard className="h-5 w-5" aria-hidden />
                    </span>
                }
                meta={
                    <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/30">
                        ภาพรวมร้าน
                    </span>
                }
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <StatTile
                    label="ยอดขายวันนี้"
                    value={`฿${todaySales.toLocaleString('th-TH')}`}
                    icon={<Coins className="h-5 w-5" aria-hidden />}
                    accent="emerald"
                />
                <StatTile
                    label="ออเดอร์ทั้งหมด"
                    value={(orderCount ?? 0).toLocaleString('th-TH')}
                    icon={<Package className="h-5 w-5" aria-hidden />}
                    accent="sky"
                />
                <StatTile
                    label="รอดำเนินการ"
                    value={pendingPipeline.toLocaleString('th-TH')}
                    icon={<Hourglass className="h-5 w-5" aria-hidden />}
                    accent="amber"
                />
                <StatTile
                    label="สินค้าในร้าน"
                    value={(productCount ?? 0).toLocaleString('th-TH')}
                    icon={<Tag className="h-5 w-5" aria-hidden />}
                    accent="violet"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                <section className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-5 ring-1 ring-white/[0.04]">
                    <div className="mb-4 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-sky-400/90" aria-hidden />
                        <h2 className="text-base font-semibold text-white">ยอดขาย 7 วันล่าสุด</h2>
                    </div>

                    {!hasWeekSales ? (
                        <p className="rounded-xl border border-dashed border-slate-700/80 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500">
                            ยังไม่มียอดขายในช่วง 7 วันนี้
                        </p>
                    ) : (
                        <div className="flex h-44 gap-1.5 sm:gap-2">
                            {last7Days.map((day) => {
                                const pct = maxSale > 0 ? (day.total / maxSale) * 100 : 0;
                                return (
                                    <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                                        <span className="text-[10px] font-medium tabular-nums text-slate-400 sm:text-xs">
                                            {day.total > 0 ? `฿${(day.total / 1000).toFixed(0)}k` : '–'}
                                        </span>
                                        <div className="flex h-28 w-full flex-col justify-end sm:h-32">
                                            <div
                                                className="mx-auto w-full max-w-[44px] rounded-t-md bg-gradient-to-t from-sky-600/90 to-sky-400/80 ring-1 ring-sky-500/20 transition-opacity hover:opacity-90"
                                                style={{
                                                    height: `${Math.max(day.total > 0 ? 10 : 4, pct)}%`,
                                                    minHeight: day.total > 0 ? 6 : 2,
                                                }}
                                            />
                                        </div>
                                        <span className="truncate text-[10px] font-medium text-slate-500">{day.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-5 ring-1 ring-white/[0.04]">
                    <h2 className="mb-4 text-base font-semibold text-white">สถานะออเดอร์</h2>

                    <div className="mb-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-center">
                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">ทั้งหมด</p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-white">
                                {(orderCount ?? 0).toLocaleString('th-TH')}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">ชำระแล้ว</p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-300">
                                {paymentBreakdown.paid.toLocaleString('th-TH')}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">รอชำระ</p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-300">
                                {paymentBreakdown.pending.toLocaleString('th-TH')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {statusRows
                            .filter((row) => row.count > 0)
                            .map((row) => {
                                const pct = Math.round((row.count / totalOrders) * 100);
                                return (
                                    <div key={row.key}>
                                        <div className="mb-1 flex justify-between text-xs">
                                            <span className="font-medium text-slate-300">{row.label}</span>
                                            <span className="tabular-nums text-slate-400">
                                                {row.count}{' '}
                                                <span className="text-slate-600">({pct}%)</span>
                                            </span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/80">
                                            <div
                                                className={`h-full rounded-full ${row.bar} transition-all`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        {statusRows.every((row) => row.count === 0) ? (
                            <p className="text-sm text-slate-500">ยังไม่มีข้อมูลสถานะ</p>
                        ) : null}
                        {statusRows.some((row) => row.count === 0) &&
                        statusRows.some((row) => row.count > 0) ? (
                            <p className="text-[11px] leading-relaxed text-slate-600">
                                สถานะที่ยังไม่มีรายการ:{' '}
                                {statusRows
                                    .filter((row) => row.count === 0)
                                    .map((row) => row.label)
                                    .join(' · ')}
                            </p>
                        ) : null}
                    </div>
                </section>
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/45 ring-1 ring-white/[0.04]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3 sm:px-5">
                    <h2 className="text-base font-semibold text-white">ออเดอร์ล่าสุด</h2>
                    <Link
                        href="/admin/orders"
                        className="inline-flex items-center gap-1 text-sm font-medium text-sky-400 transition hover:text-sky-300"
                    >
                        ดูทั้งหมด
                        <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                </div>
                <div className="divide-y divide-slate-800/80">
                    {recentOrders?.map((order) => (
                        <Link
                            key={order.id}
                            href={`/admin/orders/${order.id}`}
                            className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-900/50 sm:px-5"
                        >
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-200 ring-1 ring-white/[0.06]">
                                    {(order.customer_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-slate-100">{order.order_no}</p>
                                    <p className="truncate text-xs text-slate-500">{order.customer_name || 'ไม่ระบุชื่อ'}</p>
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <p className="font-semibold tabular-nums text-white">
                                    ฿{order.total_amount?.toLocaleString('th-TH')}
                                </p>
                                <StatusBadge status={order.status} />
                            </div>
                        </Link>
                    ))}
                    {(!recentOrders || recentOrders.length === 0) && (
                        <p className="px-4 py-10 text-center text-sm text-slate-500 sm:px-5">ยังไม่มีออเดอร์</p>
                    )}
                </div>
            </section>
        </div>
    );
}

function StatTile({
    label,
    value,
    icon,
    accent,
}: {
    label: string;
    value: string;
    icon: ReactNode;
    accent: 'sky' | 'emerald' | 'amber' | 'violet';
}) {
    const shell = {
        sky: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
        emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
        amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/25',
        violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/25',
    }[accent];

    return (
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 ring-1 ring-white/[0.04] sm:p-5">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${shell}`}>{icon}</div>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 truncate text-xl font-bold tabular-nums tracking-tight text-white sm:text-2xl">{value}</p>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; className: string }> = {
        new: { label: 'ใหม่', className: 'bg-sky-500/15 text-sky-200 ring-sky-500/25' },
        confirmed: { label: 'ยืนยัน', className: 'bg-amber-500/15 text-amber-200 ring-amber-500/25' },
        shipped: { label: 'จัดส่ง', className: 'bg-violet-500/15 text-violet-200 ring-violet-500/25' },
        completed: { label: 'สำเร็จ', className: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/25' },
        canceled: { label: 'ยกเลิก', className: 'bg-rose-500/15 text-rose-200 ring-rose-500/25' },
    };
    const s = config[status] ?? { label: status, className: 'bg-slate-700/50 text-slate-300 ring-slate-600/40' };
    return (
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${s.className}`}>
            {s.label}
        </span>
    );
}
