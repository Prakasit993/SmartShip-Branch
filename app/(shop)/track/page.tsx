import { supabaseAdmin } from '@app/lib/supabaseAdmin';
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

    let orders: OrderType[] = [];
    let singleOrder: OrderType | null = null;

    if (order_no) {
        // Search by Order Number
        const { data } = await supabaseAdmin.from('orders').select('*').eq('order_no', order_no).single();
        singleOrder = data;
    } else if (phone) {
        // Search by Phone Number - returns multiple orders
        const { data } = await supabaseAdmin
            .from('orders')
            .select('*')
            .eq('customer_phone', phone)
            .order('created_at', { ascending: false });
        orders = data || [];
    }

    const searchValue = order_no || phone || '';
    const searchType = order_no ? 'order_no' : 'phone';
    const hasSearched = order_no || phone;

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-3xl font-bold mb-8 text-center">ติดตามคำสั่งซื้อ</h1>

            {/* Search Form */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 mb-8 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <form className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                ค้นหาด้วยหมายเลขคำสั่งซื้อ
                            </label>
                            <input
                                name="order_no"
                                defaultValue={order_no || ''}
                                placeholder="ORD-1234567890"
                                className="w-full px-4 py-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                หรือ ค้นหาด้วยเบอร์โทรศัพท์
                            </label>
                            <input
                                name="phone"
                                defaultValue={phone || ''}
                                placeholder="0812345678"
                                className="w-full px-4 py-3 border rounded-lg bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:opacity-90 transition"
                    >
                        🔍 ค้นหา
                    </button>
                    <p className="text-xs text-zinc-500 text-center">กรอกหมายเลขคำสั่งซื้อ หรือเบอร์โทรศัพท์ที่ใช้ในการสั่งซื้อ</p>
                </form>
            </div>

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
            {hasSearched && !singleOrder && orders.length === 0 && (
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
