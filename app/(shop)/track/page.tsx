import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type OrderType = {
    id: number;
    order_no: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    total_amount: number;
    status: string;
    payment_status: string;
    payment_method: string;
    created_at: string;
};

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order_no?: string; phone?: string }> }) {
    const { order_no, phone } = await searchParams;

    // Check if user is logged in
    const cookieStore = await cookies();
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
    const { data: { user } } = await supabase.auth.getUser();
    const isLoggedIn = !!user;

    // Get customer's phone from profile if logged in
    let customerPhone: string | null = null;
    let customerName: string | null = null;
    if (isLoggedIn && user) {
        const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('phone, name')
            .eq('line_user_id', user.id)
            .single();
        customerPhone = customer?.phone || null;
        customerName = customer?.name || user.user_metadata?.name || null;
    }

    let orders: OrderType[] = [];
    let singleOrder: OrderType | null = null;
    let requiresLogin = false;
    let myOrders: OrderType[] = [];

    // Auto-fetch orders for logged-in users (using their phone from profile)
    if (isLoggedIn && customerPhone && !order_no && !phone) {
        const { data } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('customer_phone', customerPhone)
            .order('created_at', { ascending: false });
        myOrders = data || [];
    }

    if (order_no) {
        // Search by Order Number - PUBLIC (anyone can search)
        const { data } = await supabaseAdmin.from('orders').select('*').eq('order_no', order_no).single();
        singleOrder = data;
    } else if (phone) {
        // Search by Phone Number - REQUIRES LOGIN
        if (!isLoggedIn) {
            requiresLogin = true;
        } else {
            const { data } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('customer_phone', phone)
                .order('created_at', { ascending: false });
            orders = data || [];
        }
    }

    const hasSearched = order_no || phone;

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-3xl font-bold mb-8 text-center">ติดตามคำสั่งซื้อ</h1>

            {/* Search Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 mb-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <form className="space-y-4">
                    {/* Order Number Search - Public */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            🔓 ค้นหาด้วยหมายเลขคำสั่งซื้อ
                        </label>
                        <input
                            name="order_no"
                            defaultValue={order_no || ''}
                            placeholder="ORD-1234567890"
                            className="w-full px-4 py-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-400">หรือ</span>
                        </div>
                    </div>

                    {/* Phone Search - Requires Login */}
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            🔒 ค้นหาด้วยเบอร์โทรศัพท์
                            {isLoggedIn ? (
                                <span className="text-green-600 text-xs ml-2">✓ เข้าสู่ระบบแล้ว</span>
                            ) : (
                                <span className="text-yellow-600 text-xs ml-2">(ต้องเข้าสู่ระบบก่อน)</span>
                            )}
                        </label>
                        <input
                            name="phone"
                            defaultValue={phone || ''}
                            placeholder="0812345678"
                            className="w-full px-4 py-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                        {!isLoggedIn && (
                            <p className="text-xs text-yellow-600 mt-1">⚠️ การค้นหาด้วยเบอร์โทรจะต้องเข้าสู่ระบบก่อน</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition"
                    >
                        🔍 ค้นหา
                    </button>

                    {!isLoggedIn && (
                        <div className="text-center">
                            <Link href="/login?next=/track" className="text-blue-600 hover:underline text-sm">
                                เข้าสู่ระบบเพื่อค้นหาด้วยเบอร์โทรศัพท์ →
                            </Link>
                        </div>
                    )}
                </form>
            </div>

            {/* Login Required Message */}
            {requiresLogin && (
                <div className="text-center p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-8">
                    <p className="text-yellow-700 dark:text-yellow-400 font-medium">🔒 กรุณาเข้าสู่ระบบก่อน</p>
                    <p className="text-sm text-zinc-500 mt-1 mb-4">การค้นหาด้วยเบอร์โทรศัพท์ต้องเข้าสู่ระบบเพื่อรักษาความปลอดภัยข้อมูล</p>
                    <Link
                        href={`/login?next=/track?phone=${encodeURIComponent(phone || '')}`}
                        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                    >
                        เข้าสู่ระบบ
                    </Link>
                </div>
            )}

            {/* My Orders - Auto-fetched for logged-in users */}
            {myOrders.length > 0 && !hasSearched && (
                <div className="space-y-4 mb-8">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                            <span className="text-green-500">👤</span>
                            คำสั่งซื้อของ {customerName || 'ฉัน'} ({myOrders.length} รายการ)
                        </h2>
                        <span className="text-sm text-zinc-500">เบอร์: {customerPhone}</span>
                    </div>
                    {myOrders.map((order) => (
                        <OrderCard key={order.id} order={order} />
                    ))}
                </div>
            )}

            {/* Logged in but no phone in profile */}
            {isLoggedIn && !customerPhone && !hasSearched && (
                <div className="text-center p-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 mb-8">
                    <p className="text-blue-700 dark:text-blue-400 font-medium">📝 กรุณากรอกเบอร์โทรศัพท์ในโปรไฟล์</p>
                    <p className="text-sm text-zinc-500 mt-1 mb-4">เพื่อให้ระบบแสดงคำสั่งซื้อของคุณโดยอัตโนมัติ</p>
                    <Link
                        href="/profile"
                        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                    >
                        ไปหน้าโปรไฟล์
                    </Link>
                </div>
            )}

            {/* Single Order Result (by order_no) */}
            {singleOrder && (
                <OrderCard order={singleOrder} />
            )}

            {/* Multiple Orders Result (by phone) */}
            {orders.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                        พบ {orders.length} คำสั่งซื้อ สำหรับเบอร์ {phone}
                    </h2>
                    {orders.map((order) => (
                        <OrderCard key={order.id} order={order} />
                    ))}
                </div>
            )}

            {/* No Results */}
            {hasSearched && !requiresLogin && !singleOrder && orders.length === 0 && (
                <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-red-600 dark:text-red-400 font-medium">ไม่พบคำสั่งซื้อ</p>
                    <p className="text-sm text-zinc-500 mt-1">กรุณาตรวจสอบหมายเลขคำสั่งซื้อหรือเบอร์โทรศัพท์อีกครั้ง</p>
                </div>
            )}
        </div>
    );
}

function OrderCard({ order }: { order: OrderType }) {
    const statusColors: Record<string, string> = {
        new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        shipped: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm text-zinc-500">หมายเลขคำสั่งซื้อ</p>
                    <p className="font-bold text-lg">{order.order_no}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status] || 'bg-zinc-100'}`}>
                    {order.status === 'new' ? 'ใหม่' :
                        order.status === 'processing' ? 'กำลังดำเนินการ' :
                            order.status === 'shipped' ? 'จัดส่งแล้ว' :
                                order.status === 'completed' ? 'สำเร็จ' :
                                    order.status === 'cancelled' ? 'ยกเลิก' : order.status}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                    <span className="text-zinc-500">ยอดรวม</span>
                    <p className="font-semibold text-lg">฿{order.total_amount?.toLocaleString()}</p>
                </div>
                <div>
                    <span className="text-zinc-500">สถานะชำระเงิน</span>
                    <p className={`font-semibold ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {order.payment_status === 'paid' ? '✅ ชำระแล้ว' : '⏳ รอชำระเงิน'}
                    </p>
                </div>
            </div>

            {order.customer_name && (
                <div className="text-sm text-zinc-600 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-4">
                    <p><span className="font-medium">ชื่อ:</span> {order.customer_name}</p>
                    <p><span className="font-medium">ที่อยู่:</span> {order.customer_address}</p>
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                <Link href="/shop" className="text-blue-600 hover:underline text-sm">
                    ซื้อสินค้าต่อ
                </Link>
            </div>
        </div>
    );
}
