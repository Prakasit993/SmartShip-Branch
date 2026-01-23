import { supabase } from '@/lib/supabaseClient';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';

const statusInfo: Record<OrderStatus, { label: string; emoji: string; color: string }> = {
    pending: { label: 'รอดำเนินการ', emoji: '⏳', color: 'bg-yellow-100 text-yellow-800' },
    confirmed: { label: 'ยืนยันแล้ว', emoji: '✅', color: 'bg-blue-100 text-blue-800' },
    shipped: { label: 'จัดส่งแล้ว', emoji: '🚚', color: 'bg-purple-100 text-purple-800' },
    completed: { label: 'สำเร็จ', emoji: '🎉', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'ยกเลิก', emoji: '❌', color: 'bg-red-100 text-red-800' },
};

export default async function MyOrdersPage() {
    // Check user session
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirect('/login?redirect=/orders');
    }

    // Fetch user's orders sorted by most recent
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id,
            created_at,
            status,
            total_amount,
            shipping_name,
            shipping_address,
            shipping_phone,
            order_items(
                id,
                quantity,
                price,
                bundle_name
            )
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error);
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
            <div className="container mx-auto max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
                        📦 คำสั่งซื้อของฉัน
                    </h1>
                    <p className="text-zinc-500">
                        ดูประวัติและสถานะคำสั่งซื้อของคุณ
                    </p>
                </div>

                {/* Orders List */}
                {!orders || orders.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
                            ยังไม่มีคำสั่งซื้อ
                        </h3>
                        <p className="text-zinc-500 mb-6">
                            เริ่มสั่งซื้อสินค้ากันเลย!
                        </p>
                        <Link
                            href="/shop"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition"
                        >
                            🛍️ ไปช้อปปิ้ง
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order: any) => {
                            const status = (order.status || 'pending') as OrderStatus;
                            const statusData = statusInfo[status] || statusInfo.pending;
                            const orderDate = new Date(order.created_at);
                            const formattedDate = orderDate.toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });

                            return (
                                <div
                                    key={order.id}
                                    className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg transition-shadow"
                                >
                                    {/* Order Header */}
                                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-mono text-zinc-500">
                                                #{order.id.toString().slice(-8).toUpperCase()}
                                            </span>
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusData.color}`}>
                                                {statusData.emoji} {statusData.label}
                                            </span>
                                        </div>
                                        <span className="text-sm text-zinc-500">
                                            {formattedDate}
                                        </span>
                                    </div>

                                    {/* Order Items */}
                                    <div className="p-4">
                                        <div className="space-y-2 mb-4">
                                            {order.order_items?.map((item: any) => (
                                                <div key={item.id} className="flex justify-between items-center text-sm">
                                                    <span className="text-zinc-700 dark:text-zinc-300">
                                                        {item.bundle_name} <span className="text-zinc-400">x{item.quantity}</span>
                                                    </span>
                                                    <span className="font-medium text-zinc-900 dark:text-white">
                                                        ฿{(item.price * item.quantity).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Shipping Info */}
                                        {order.shipping_address && (
                                            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500">
                                                <div className="flex items-start gap-2">
                                                    <span>📍</span>
                                                    <div>
                                                        <p className="font-medium text-zinc-700 dark:text-zinc-300">
                                                            {order.shipping_name}
                                                        </p>
                                                        <p className="text-xs">{order.shipping_address}</p>
                                                        {order.shipping_phone && (
                                                            <p className="text-xs mt-1">📞 {order.shipping_phone}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Order Footer */}
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center">
                                        <span className="text-sm text-zinc-500">รวมทั้งสิ้น</span>
                                        <span className="text-xl font-bold text-zinc-900 dark:text-white">
                                            ฿{(order.total_amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Back Link */}
                <div className="text-center mt-8">
                    <Link href="/" className="text-blue-600 hover:underline">
                        ← กลับหน้าหลัก
                    </Link>
                </div>
            </div>
        </div>
    );
}
