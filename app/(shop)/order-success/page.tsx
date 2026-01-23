import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type OrderItem = {
    id: number;
    bundle_name: string;
    quantity: number;
    price: number;
};

type Order = {
    id: number;
    order_no: string;
    friendly_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address?: string;
    total_amount: number;
    status: string;
    payment_method: string;
    created_at: string;
    order_items: OrderItem[];
};

export default async function OrderSuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ order_no?: string }>;
}) {
    const params = await searchParams;
    const orderNo = params.order_no;

    if (!orderNo) {
        notFound();
    }

    // Try to fetch order by order_no first
    let order: Order | null = null;
    let error: any = null;

    // Try order_no first
    const result1 = await supabaseAdmin
        .from('orders')
        .select(`
            id,
            order_no,
            friendly_id,
            customer_name,
            customer_phone,
            customer_address,
            total_amount,
            status,
            payment_method,
            created_at,
            order_items(
                id,
                bundle_name,
                quantity,
                price
            )
        `)
        .eq('order_no', orderNo)
        .single();

    if (result1.data) {
        order = result1.data as Order;
    } else {
        // Try friendly_id as fallback
        const result2 = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_no,
                friendly_id,
                customer_name,
                customer_phone,
                customer_address,
                total_amount,
                status,
                payment_method,
                created_at,
                order_items(
                    id,
                    bundle_name,
                    quantity,
                    price
                )
            `)
            .eq('friendly_id', orderNo)
            .single();

        if (result2.data) {
            order = result2.data as Order;
        } else {
            error = result1.error || result2.error;
            console.error('Order not found:', orderNo, error);
        }
    }

    // If order not found, show friendly message instead of 404
    if (!order) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/30 dark:to-zinc-950">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-12 px-4">
                    <div className="container mx-auto max-w-2xl text-center">
                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-5xl">🔍</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold mb-2">ไม่พบคำสั่งซื้อ</h1>
                        <p className="text-amber-100">หมายเลขคำสั่งซื้อ: {orderNo}</p>
                    </div>
                </div>
                <div className="container mx-auto max-w-2xl px-4 py-8">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 text-center mb-6">
                        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                            คำสั่งซื้อนี้อาจยังไม่ได้บันทึก หรือหมายเลขไม่ถูกต้อง
                        </p>
                        <div className="space-y-3">
                            <Link
                                href="/profile"
                                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 rounded-xl font-bold shadow-lg transition-all"
                            >
                                📦 ดูคำสั่งซื้อของฉัน
                            </Link>
                            <Link
                                href="/shop"
                                className="w-full flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white py-4 rounded-xl font-bold transition-all"
                            >
                                🛒 กลับไปช้อปปิ้ง
                            </Link>
                            <Link
                                href="/"
                                className="w-full flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 py-2 font-medium transition"
                            >
                                ← กลับหน้าหลัก
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const orderDate = new Date(order.created_at).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-green-950/30 dark:to-zinc-950">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white py-12 px-4">
                <div className="container mx-auto max-w-2xl text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <span className="text-5xl">🎉</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">สั่งซื้อสำเร็จแล้ว!</h1>
                    <p className="text-green-100">ขอบคุณสำหรับการสั่งซื้อ</p>
                </div>
            </div>

            <div className="container mx-auto max-w-2xl px-4 py-8 -mt-6">
                {/* Order Info Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden mb-6">
                    {/* Order Number */}
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 text-center">
                        <p className="text-sm text-zinc-500 mb-1">หมายเลขคำสั่งซื้อ</p>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {order.friendly_id || order.order_no}
                        </p>
                        <p className="text-sm text-zinc-500 mt-2">{orderDate}</p>
                    </div>

                    {/* Order Items */}
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            📦 รายการสินค้า
                        </h3>
                        <div className="space-y-3">
                            {order.order_items?.map((item) => (
                                <div key={item.id} className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-zinc-900 dark:text-white">
                                            {item.bundle_name}
                                        </p>
                                        <p className="text-sm text-zinc-500">จำนวน: {item.quantity}</p>
                                    </div>
                                    <p className="font-bold text-zinc-900 dark:text-white">
                                        ฿{(item.price * item.quantity).toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Shipping Info */}
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            🚚 ข้อมูลจัดส่ง
                        </h3>
                        <div className="space-y-2 text-sm">
                            <p><span className="text-zinc-500">ชื่อ:</span> <span className="font-medium text-zinc-900 dark:text-white">{order.customer_name}</span></p>
                            <p><span className="text-zinc-500">โทร:</span> <span className="font-medium text-zinc-900 dark:text-white">{order.customer_phone}</span></p>
                            <p><span className="text-zinc-500">ที่อยู่:</span> <span className="font-medium text-zinc-900 dark:text-white">{order.customer_address || '-'}</span></p>
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                            💳 การชำระเงิน
                        </h3>
                        <p className="text-sm">
                            <span className="text-zinc-500">วิธีชำระ:</span>{' '}
                            <span className="font-medium text-zinc-900 dark:text-white">
                                {order.payment_method === 'promptpay' ? 'พร้อมเพย์ / QR Code' :
                                    order.payment_method === 'shop' ? 'ชำระที่หน้าร้าน' :
                                        order.payment_method}
                            </span>
                        </p>
                    </div>

                    {/* Total */}
                    <div className="p-6 bg-green-50 dark:bg-green-900/20">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-zinc-900 dark:text-white">ยอดรวมทั้งสิ้น</span>
                            <span className="text-2xl font-bold text-green-600">
                                ฿{(order.total_amount || 0).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                    <Link
                        href="/profile"
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 rounded-xl font-bold shadow-lg transition-all"
                    >
                        📦 ดูประวัติคำสั่งซื้อทั้งหมด
                    </Link>
                    <Link
                        href="/shop"
                        className="w-full flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white py-4 rounded-xl font-bold transition-all"
                    >
                        🛒 ช้อปต่อ
                    </Link>
                    <Link
                        href="/"
                        className="w-full flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 py-2 font-medium transition"
                    >
                        ← กลับหน้าหลัก
                    </Link>
                </div>

                {/* Contact Info */}
                <div className="mt-8 text-center text-sm text-zinc-500">
                    <p>มีคำถาม? ติดต่อเราได้ที่</p>
                    <Link href="/contact" className="text-blue-600 hover:underline">
                        หน้าติดต่อเรา
                    </Link>
                </div>
            </div>
        </div>
    );
}
