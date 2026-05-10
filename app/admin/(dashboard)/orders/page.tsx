import Link from 'next/link';
import {
    Inbox,
    Package,
    Phone,
    Search,
    ChevronRight,
} from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import ToastListener from '@app/admin/components/ToastListener';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Order = {
    id: number;
    order_no: string;
    customer_name: string;
    customer_phone: string;
    total_amount: number;
    status: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
};

export default async function OrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; search?: string }>;
}) {
    const params = await searchParams;
    const statusFilter = params.status || 'all';
    const searchQuery = params.search || '';

    let query = supabaseAdmin
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
    }

    if (searchQuery) {
        query = query.or(
            `order_no.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`,
        );
    }

    const { data: orders, error } = await query;

    if (error) {
        return (
            <div className="rounded-2xl border border-red-500/30 bg-red-950/25 px-4 py-5 text-sm text-red-200 ring-1 ring-red-500/20">
                โหลดรายการไม่สำเร็จ: {error.message}
            </div>
        );
    }

    const { data: allOrders } = await supabaseAdmin.from('orders').select('status');
    const statusCounts = {
        all: allOrders?.length || 0,
        new: allOrders?.filter((o) => o.status === 'new').length || 0,
        confirmed: allOrders?.filter((o) => o.status === 'confirmed').length || 0,
        shipped: allOrders?.filter((o) => o.status === 'shipped').length || 0,
        completed: allOrders?.filter((o) => o.status === 'completed').length || 0,
        canceled: allOrders?.filter((o) => o.status === 'canceled').length || 0,
    };

    const statusOptions = [
        { key: 'all', label: 'ทั้งหมด' },
        { key: 'new', label: 'ใหม่' },
        { key: 'confirmed', label: 'ยืนยัน' },
        { key: 'shipped', label: 'จัดส่ง' },
        { key: 'completed', label: 'สำเร็จ' },
        { key: 'canceled', label: 'ยกเลิก' },
    ] as const;

    const q = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';

    return (
        <div className="min-w-0 space-y-5 pb-16">
            <ToastListener />
            <AdminPageHeader
                title="คำสั่งซื้อ"
                description="ค้นหาและกรองตามสถานะ"
                tone="dark"
                titleLeft={
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
                        <Package className="h-5 w-5" aria-hidden />
                    </span>
                }
                meta={
                    <span className="rounded-full bg-slate-600/40 px-2.5 py-0.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                        {(orders?.length ?? 0).toLocaleString('th-TH')} รายการ
                    </span>
                }
            />

            <form
                className="flex flex-col gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/45 p-3 ring-1 ring-white/[0.04] sm:flex-row sm:items-center sm:gap-3 sm:p-3"
                action="/admin/orders"
                method="get"
            >
                <input type="hidden" name="status" value={statusFilter} />
                <label className="relative flex min-w-0 flex-1 items-center">
                    <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" aria-hidden />
                    <input
                        type="search"
                        name="search"
                        defaultValue={searchQuery}
                        placeholder="เลขออเดอร์ ชื่อ หรือเบอร์โทร"
                        autoComplete="off"
                        className="min-h-11 w-full rounded-xl border border-slate-700/80 bg-slate-900/80 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none ring-sky-500/30 placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-2"
                    />
                </label>
                <button
                    type="submit"
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-500 sm:min-w-[7rem]"
                >
                    ค้นหา
                </button>
            </form>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {statusOptions.map((opt) => {
                    const active = statusFilter === opt.key;
                    return (
                        <Link
                            key={opt.key}
                            href={`/admin/orders?status=${opt.key}${q}`}
                            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                active
                                    ? 'border-sky-500/50 bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30'
                                    : 'border-slate-700/80 bg-slate-900/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800/60 hover:text-slate-200'
                            }`}
                        >
                            {opt.label}
                            <span
                                className={`tabular-nums rounded-md px-1.5 py-0.5 text-[10px] ${
                                    active ? 'bg-white/10 text-sky-100' : 'bg-slate-800 text-slate-500'
                                }`}
                            >
                                {statusCounts[opt.key].toLocaleString('th-TH')}
                            </span>
                        </Link>
                    );
                })}
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/40 ring-1 ring-white/[0.04]">
                {orders && orders.length > 0 ? (
                    <>
                        <div className="hidden md:block">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-800/80 bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                            <th className="px-4 py-3">ออเดอร์</th>
                                            <th className="px-4 py-3">ลูกค้า</th>
                                            <th className="px-4 py-3">ติดต่อ</th>
                                            <th className="px-4 py-3 text-right">ยอดเงิน</th>
                                            <th className="px-4 py-3">สถานะ</th>
                                            <th className="px-4 py-3">การชำระ</th>
                                            <th className="px-4 py-3">สร้างเมื่อ</th>
                                            <th className="w-10 px-2 py-3" aria-hidden />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/70">
                                        {orders.map((order) => (
                                            <OrderTableRow key={order.id} order={order} />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="divide-y divide-slate-800/70 md:hidden">
                            {orders.map((order) => (
                                <OrderMobileRow key={order.id} order={order} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                        <Inbox className="h-10 w-10 text-slate-600" aria-hidden />
                        <p className="text-sm font-medium text-slate-400">ไม่พบคำสั่งซื้อ</p>
                        <p className="max-w-xs text-xs text-slate-600">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
                    </div>
                )}
            </section>
        </div>
    );
}

function OrderTableRow({ order }: { order: Order }) {
    const created = formatShortDate(order.created_at);
    const payment = paymentLabel(order.payment_status);
    const status = statusStyle(order.status);

    return (
        <tr className="transition hover:bg-slate-900/40">
            <td className="px-4 py-3 align-middle">
                <Link
                    href={`/admin/orders/${order.id}`}
                    className="font-semibold text-sky-300 hover:text-sky-200 hover:underline"
                >
                    {order.order_no}
                </Link>
            </td>
            <td className="max-w-[160px] px-4 py-3 align-middle">
                <span className="line-clamp-2 text-slate-200">{order.customer_name || '—'}</span>
            </td>
            <td className="px-4 py-3 align-middle">
                <div className="flex items-center gap-2">
                    <span className="tabular-nums text-slate-300">{order.customer_phone || '—'}</span>
                    {order.customer_phone ? (
                        <a
                            href={`tel:${order.customer_phone}`}
                            className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-emerald-400 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                            aria-label="โทรออก"
                        >
                            <Phone className="h-3.5 w-3.5" aria-hidden />
                        </a>
                    ) : null}
                </div>
            </td>
            <td className="px-4 py-3 text-right align-middle">
                <span className="font-semibold tabular-nums text-white">
                    ฿{order.total_amount?.toLocaleString('th-TH')}
                </span>
            </td>
            <td className="px-4 py-3 align-middle">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${status.className}`}>
                    {status.label}
                </span>
            </td>
            <td className="px-4 py-3 align-middle">
                <span className={`text-xs font-medium ${payment.className}`}>{payment.label}</span>
            </td>
            <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-slate-500">{created}</td>
            <td className="px-2 py-3 align-middle">
                <Link
                    href={`/admin/orders/${order.id}`}
                    className="inline-flex rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-sky-300"
                    aria-label="เปิดรายละเอียด"
                >
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </td>
        </tr>
    );
}

function OrderMobileRow({ order }: { order: Order }) {
    const payment = paymentLabel(order.payment_status);
    const status = statusStyle(order.status);
    const initial = (order.customer_name || '?').charAt(0).toUpperCase();

    return (
        <div className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-900/45">
            <Link
                href={`/admin/orders/${order.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 outline-none"
            >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-200 ring-1 ring-white/[0.06]">
                    {initial}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-semibold text-slate-100">{order.order_no}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${status.className}`}>
                            {status.label}
                        </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{order.customer_name || 'ไม่ระบุชื่อ'}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-medium ${payment.className}`}>{payment.label}</span>
                        <span className="text-base font-bold tabular-nums text-white">
                            ฿{order.total_amount?.toLocaleString('th-TH')}
                        </span>
                    </div>
                </div>
            </Link>
            {order.customer_phone ? (
                <a
                    href={`tel:${order.customer_phone}`}
                    className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-emerald-400 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                    aria-label="โทรออก"
                >
                    <Phone className="h-4 w-4" aria-hidden />
                </a>
            ) : null}
        </div>
    );
}

function statusStyle(status: string): { label: string; className: string } {
    const map: Record<string, { label: string; className: string }> = {
        new: { label: 'ใหม่', className: 'bg-sky-500/15 text-sky-200 ring-sky-500/25' },
        confirmed: { label: 'ยืนยัน', className: 'bg-amber-500/15 text-amber-200 ring-amber-500/25' },
        shipped: { label: 'จัดส่ง', className: 'bg-violet-500/15 text-violet-200 ring-violet-500/25' },
        completed: { label: 'สำเร็จ', className: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/25' },
        canceled: { label: 'ยกเลิก', className: 'bg-rose-500/15 text-rose-200 ring-rose-500/25' },
    };
    return map[status] ?? { label: status, className: 'bg-slate-700/50 text-slate-300 ring-slate-600/40' };
}

function paymentLabel(status: string): { label: string; className: string } {
    const map: Record<string, { label: string; className: string }> = {
        paid: { label: 'ชำระแล้ว', className: 'text-emerald-400' },
        pending: { label: 'รอชำระ', className: 'text-amber-400' },
        rejected: { label: 'ปฏิเสธ', className: 'text-slate-400' },
        failed: { label: 'ล้มเหลว', className: 'text-rose-400' },
        unpaid: { label: 'ยังไม่ชำระ', className: 'text-slate-400' },
    };
    return map[status] ?? { label: status, className: 'text-slate-500' };
}

function formatShortDate(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString('th-TH', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}
