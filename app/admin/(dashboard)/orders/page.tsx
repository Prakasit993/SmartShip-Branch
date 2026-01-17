import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';

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

    // Apply status filter
    if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
        query = query.or(`order_no.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`);
    }

    const { data: orders, error } = await query;

    if (error) {
        return <div className="text-red-500 p-4">Error loading orders: {error.message}</div>;
    }

    // Count orders by status for badges
    const { data: allOrders } = await supabaseAdmin.from('orders').select('status');
    const statusCounts = {
        all: allOrders?.length || 0,
        new: allOrders?.filter(o => o.status === 'new').length || 0,
        confirmed: allOrders?.filter(o => o.status === 'confirmed').length || 0,
        shipped: allOrders?.filter(o => o.status === 'shipped').length || 0,
        completed: allOrders?.filter(o => o.status === 'completed').length || 0,
        canceled: allOrders?.filter(o => o.status === 'canceled').length || 0,
    };

    const statusOptions = [
        { key: 'all', label: 'ทั้งหมด', color: 'bg-zinc-600' },
        { key: 'new', label: 'ใหม่', color: 'bg-blue-600' },
        { key: 'confirmed', label: 'ยืนยันแล้ว', color: 'bg-yellow-600' },
        { key: 'shipped', label: 'จัดส่งแล้ว', color: 'bg-purple-600' },
        { key: 'completed', label: 'สำเร็จ', color: 'bg-green-600' },
        { key: 'canceled', label: 'ยกเลิก', color: 'bg-red-600' },
    ];

    return (
        <div className="space-y-4 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl md:text-2xl font-bold">📦 คำสั่งซื้อ</h1>
                <span className="text-sm text-zinc-500">{orders?.length || 0} รายการ</span>
            </div>

            {/* Search Box */}
            <form className="relative">
                <input
                    type="text"
                    name="search"
                    defaultValue={searchQuery}
                    placeholder="🔍 ค้นหา Order No, ชื่อ, เบอร์..."
                    className="w-full px-4 py-3 pl-10 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <input type="hidden" name="status" value={statusFilter} />
                <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                    ค้นหา
                </button>
            </form>

            {/* Status Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {statusOptions.map(opt => (
                    <Link
                        key={opt.key}
                        href={`/admin/orders?status=${opt.key}${searchQuery ? `&search=${searchQuery}` : ''}`}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all
                            ${statusFilter === opt.key
                                ? `${opt.color} text-white shadow-lg`
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                            }`}
                    >
                        {opt.label}
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${statusFilter === opt.key ? 'bg-white/20' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                            {statusCounts[opt.key as keyof typeof statusCounts]}
                        </span>
                    </Link>
                ))}
            </div>

            {/* Orders List - Card Layout for Mobile */}
            <div className="space-y-3">
                {orders?.map((order: Order) => (
                    <OrderCard key={order.id} order={order} />
                ))}

                {orders?.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                        <p className="text-4xl mb-2">📭</p>
                        <p>ไม่พบคำสั่งซื้อ</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function OrderCard({ order }: { order: Order }) {
    const statusConfig: Record<string, { label: string; bg: string; icon: string }> = {
        new: { label: 'ใหม่', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: '🆕' },
        confirmed: { label: 'ยืนยันแล้ว', bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: '✅' },
        shipped: { label: 'จัดส่งแล้ว', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: '🚚' },
        completed: { label: 'สำเร็จ', bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: '✨' },
        canceled: { label: 'ยกเลิก', bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '❌' },
    };

    const paymentConfig: Record<string, { label: string; color: string }> = {
        paid: { label: 'ชำระแล้ว', color: 'text-green-600' },
        pending: { label: 'รอชำระ', color: 'text-yellow-600' },
        failed: { label: 'ล้มเหลว', color: 'text-red-600' },
    };

    const status = statusConfig[order.status] || { label: order.status, bg: 'bg-zinc-100', icon: '📦' };
    const payment = paymentConfig[order.payment_status] || { label: order.payment_status, color: 'text-zinc-600' };

    const timeAgo = getTimeAgo(new Date(order.created_at));

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 hover:border-blue-500 hover:shadow-lg transition-all">
            {/* Top Row - Order No & Status (Clickable) */}
            <Link href={`/admin/orders/${order.id}`} className="block mb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="font-bold text-lg hover:text-blue-600">{order.order_no}</div>
                        <div className="text-xs text-zinc-500">{timeAgo}</div>
                    </div>
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${status.bg}`}>
                        <span>{status.icon}</span>
                        {status.label}
                    </span>
                </div>
            </Link>

            {/* Customer Info */}
            <div className="flex items-center gap-3 mb-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {(order.customer_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{order.customer_name || 'ไม่ระบุชื่อ'}</div>
                    <div className="text-sm text-zinc-500 flex items-center gap-1">
                        <span>📱</span>
                        {order.customer_phone || 'ไม่ระบุ'}
                    </div>
                </div>
                {/* Quick Call Button */}
                {order.customer_phone && (
                    <a
                        href={`tel:${order.customer_phone}`}
                        className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                    </a>
                )}
            </div>

            {/* Bottom Row - Amount & Payment (Clickable) */}
            <Link href={`/admin/orders/${order.id}`} className="flex items-center justify-between">
                <div>
                    <div className="text-2xl font-black">฿{order.total_amount?.toLocaleString()}</div>
                    <div className={`text-xs font-medium ${payment.color}`}>
                        {payment.label}
                    </div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                    {order.payment_method === 'transfer' ? '🏦 โอนเงิน' :
                        order.payment_method === 'cash' ? '💵 เงินสด' :
                            order.payment_method || 'ไม่ระบุ'}
                </div>
            </Link>
        </div>
    );
}

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
