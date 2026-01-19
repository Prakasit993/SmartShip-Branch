import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type OrderType = {
    id: number;
    order_no: string;
    friendly_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    total_amount: number;
    status: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
    updated_at: string;
};

export default async function TrackPage() {
    const cookieStore = await cookies();
    let isLoggedIn = false;
    let user = null;
    let userId: string | null = null;

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll() { },
                },
            }
        );
        const { data } = await supabase.auth.getUser();
        user = data.user;
        isLoggedIn = !!user;
        userId = user?.id || null;
    } catch (e) {
        console.error('Session check error:', e);
        isLoggedIn = false;
    }

    // Fetch all orders for logged-in user (via phone number in customers table)
    let orders: OrderType[] = [];
    let customerPhone: string | null = null;

    if (isLoggedIn && userId) {
        // First get user's phone from customers table
        const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('phone')
            .eq('user_id', userId)
            .single();

        customerPhone = customer?.phone || null;

        // If no customer record with user_id, try line_user_id
        if (!customerPhone) {
            const { data: lineCustomer } = await supabaseAdmin
                .from('customers')
                .select('phone')
                .eq('line_user_id', userId)
                .single();
            customerPhone = lineCustomer?.phone || null;
        }

        // Fetch orders by phone
        if (customerPhone) {
            const { data } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('customer_phone', customerPhone)
                .order('created_at', { ascending: false });
            orders = data || [];
        }
    }

    // Group orders by status
    const activeOrders = orders.filter(o => ['new', 'processing', 'shipped'].includes(o.status));
    const completedOrders = orders.filter(o => o.status === 'completed');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12 px-4">
                <div className="container mx-auto max-w-4xl text-center">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">📦 ติดตามคำสั่งซื้อ</h1>
                    <p className="text-blue-100">ดูสถานะคำสั่งซื้อทั้งหมดของคุณ</p>
                </div>
            </div>

            <div className="container mx-auto max-w-4xl px-4 py-8 -mt-6">
                {/* Not Logged In */}
                {!isLoggedIn && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center">
                        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🔐</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2">กรุณาเข้าสู่ระบบ</h2>
                        <p className="text-zinc-500 mb-6">เข้าสู่ระบบเพื่อดูคำสั่งซื้อทั้งหมดของคุณ</p>
                        <Link
                            href="/login?next=/track"
                            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold hover:opacity-90 transition shadow-lg"
                        >
                            เข้าสู่ระบบ →
                        </Link>
                    </div>
                )}

                {/* Logged In - Show Orders */}
                {isLoggedIn && (
                    <div className="space-y-8">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
                                <div className="text-3xl font-bold text-blue-600">{activeOrders.length}</div>
                                <div className="text-sm text-zinc-500">กำลังดำเนินการ</div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
                                <div className="text-3xl font-bold text-green-600">{completedOrders.length}</div>
                                <div className="text-sm text-zinc-500">สำเร็จ</div>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
                                <div className="text-3xl font-bold text-zinc-400">{cancelledOrders.length}</div>
                                <div className="text-sm text-zinc-500">ยกเลิก</div>
                            </div>
                        </div>

                        {/* No Orders */}
                        {orders.length === 0 && (
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-12 text-center">
                                <div className="text-6xl mb-4">📭</div>
                                <h2 className="text-xl font-bold mb-2">ยังไม่มีคำสั่งซื้อ</h2>
                                <p className="text-zinc-500 mb-6">เริ่มสั่งซื้อสินค้าเพื่อติดตามที่นี่</p>
                                <Link
                                    href="/shop"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition"
                                >
                                    🛒 เลือกซื้อสินค้า
                                </Link>
                            </div>
                        )}

                        {/* Active Orders */}
                        {activeOrders.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                    กำลังดำเนินการ
                                </h2>
                                <div className="space-y-4">
                                    {activeOrders.map((order) => (
                                        <OrderCard key={order.id} order={order} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Completed Orders */}
                        {completedOrders.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <span className="text-green-500">✅</span>
                                    สำเร็จแล้ว
                                </h2>
                                <div className="space-y-4">
                                    {completedOrders.map((order) => (
                                        <OrderCard key={order.id} order={order} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cancelled Orders */}
                        {cancelledOrders.length > 0 && (
                            <div>
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-zinc-400">
                                    <span>❌</span>
                                    ยกเลิก
                                </h2>
                                <div className="space-y-4 opacity-60">
                                    {cancelledOrders.map((order) => (
                                        <OrderCard key={order.id} order={order} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function OrderCard({ order }: { order: OrderType }) {
    const steps = [
        { key: 'new', label: 'รับคำสั่งซื้อ', icon: '📝' },
        { key: 'processing', label: 'กำลังเตรียม', icon: '📦' },
        { key: 'shipped', label: 'จัดส่งแล้ว', icon: '🚚' },
        { key: 'completed', label: 'สำเร็จ', icon: '✅' },
    ];

    const currentStepIndex = steps.findIndex(s => s.key === order.status);
    const isCancelled = order.status === 'cancelled';

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                    <p className="text-xs text-zinc-500">หมายเลขคำสั่งซื้อ</p>
                    <p className="font-bold text-lg">{order.friendly_id || order.order_no}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-zinc-500">วันที่สั่งซื้อ</p>
                    <p className="font-medium text-sm">
                        {new Date(order.created_at).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </p>
                </div>
            </div>

            {/* Timeline */}
            {!isCancelled && (
                <div className="px-6 py-6">
                    <div className="flex items-center justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-4 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(0, (currentStepIndex / (steps.length - 1)) * 100)}%` }}
                            />
                        </div>

                        {steps.map((step, index) => {
                            const isCompleted = index <= currentStepIndex;
                            const isCurrent = index === currentStepIndex;
                            return (
                                <div key={step.key} className="relative z-10 flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${isCompleted
                                        ? 'bg-gradient-to-r from-blue-500 to-green-500 text-white shadow-lg'
                                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400'
                                        } ${isCurrent ? 'ring-4 ring-blue-500/20 scale-110' : ''}`}>
                                        {step.icon}
                                    </div>
                                    <p className={`text-xs mt-2 font-medium ${isCompleted ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                                        {step.label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Cancelled Status */}
            {isCancelled && (
                <div className="px-6 py-6 text-center">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full font-medium">
                        ❌ คำสั่งซื้อถูกยกเลิก
                    </span>
                </div>
            )}

            {/* Order Details */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-zinc-500 text-xs">ยอดรวม</p>
                        <p className="font-bold text-blue-600">฿{order.total_amount?.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs">ชำระเงิน</p>
                        <p className={`font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {order.payment_status === 'paid' ? '✅ ชำระแล้ว' : '⏳ รอชำระ'}
                        </p>
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs">วิธีชำระเงิน</p>
                        <p className="font-medium capitalize">
                            {order.payment_method === 'promptpay' ? 'พร้อมเพย์' :
                                order.payment_method === 'transfer' ? 'โอนเงิน' :
                                    order.payment_method === 'shop' ? 'ชำระที่ร้าน' : order.payment_method}
                        </p>
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs">ผู้รับ</p>
                        <p className="font-medium truncate">{order.customer_name || '-'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
