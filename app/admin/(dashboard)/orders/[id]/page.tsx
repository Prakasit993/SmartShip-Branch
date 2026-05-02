import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { updateOrderStatus, updatePaymentStatus } from '../actions';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select(`
        *,
        order_items (*)
    `)
        .eq('id', id)
        .single();

    if (error || !order) notFound();

    // Payment method display
    const paymentMethodLabels: Record<string, { label: string; icon: string; color: string }> = {
        transfer: { label: 'โอนเงิน', icon: '🏦', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
        cash: { label: 'เงินสด', icon: '💵', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
        qr: { label: 'QR Code', icon: '📱', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
        promptpay: { label: 'พร้อมเพย์', icon: '💳', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
    };
    const payMethod = paymentMethodLabels[order.payment_method] || { label: order.payment_method || 'ไม่ระบุ', icon: '💰', color: 'bg-zinc-100 text-zinc-700' };

    // Status options
    const statusOptions = [
        { value: 'new', label: '🆕 ใหม่', color: 'blue' },
        { value: 'confirmed', label: '✅ ยืนยันแล้ว', color: 'yellow' },
        { value: 'preparing', label: '📦 กำลังเตรียม', color: 'orange' },
        { value: 'shipped', label: '🚚 จัดส่งแล้ว', color: 'purple' },
        { value: 'completed', label: '✨ สำเร็จ', color: 'green' },
        { value: 'canceled', label: '❌ ยกเลิก', color: 'red' },
    ];

    const paymentOptions = [
        { value: 'pending', label: '⏳ รอชำระ', color: 'yellow' },
        { value: 'paid', label: '✅ ชำระแล้ว', color: 'green' },
        { value: 'rejected', label: '❌ ไม่ผ่าน', color: 'red' },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Back Button */}
            <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 transition-colors">
                <span>←</span>
                <span>กลับไปหน้ารายการคำสั่งซื้อ</span>
            </Link>

            {/* Header */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                <AdminPageHeader
                    tone="light"
                    title={order.order_no}
                    description={`สั่งเมื่อ ${new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}`}
                    titleLeft={<span aria-hidden>📦</span>}
                    actions={
                        <div className="text-right w-full sm:w-auto">
                            <div className="text-3xl font-black text-blue-600">฿{order.total_amount?.toLocaleString()}</div>
                            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium mt-1 ${payMethod.color}`}>
                                <span>{payMethod.icon}</span>
                                {payMethod.label}
                            </div>
                        </div>
                    }
                />
            </div>

            {/* Quick Status Buttons */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span>⚡</span> จัดการสถานะ
                </h3>

                {/* Order Status */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-500 mb-3">สถานะออเดอร์</label>
                    <div className="flex flex-wrap gap-2">
                        {statusOptions.map((opt) => (
                            <form key={opt.value} action={async () => {
                                'use server';
                                await updateOrderStatus(order.id, opt.value);
                            }}>
                                <button
                                    type="submit"
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                                        ${order.status === opt.value
                                            ? `bg-${opt.color}-600 text-white shadow-lg`
                                            : `bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-${opt.color}-100 dark:hover:bg-${opt.color}-900/30`
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            </form>
                        ))}
                    </div>
                </div>

                {/* Payment Status */}
                <div>
                    <label className="block text-sm font-medium text-zinc-500 mb-3">สถานะชำระเงิน</label>
                    <div className="flex flex-wrap gap-2">
                        {paymentOptions.map((opt) => (
                            <form key={opt.value} action={async () => {
                                'use server';
                                await updatePaymentStatus(order.id, opt.value);
                            }}>
                                <button
                                    type="submit"
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                                        ${order.payment_status === opt.value
                                            ? `bg-${opt.color}-600 text-white shadow-lg`
                                            : `bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-${opt.color}-100`
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            </form>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>👤</span> ข้อมูลลูกค้า
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {(order.customer_name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="font-bold">{order.customer_name || 'ไม่ระบุชื่อ'}</div>
                                <div className="text-zinc-500">{order.customer_phone || 'ไม่ระบุเบอร์'}</div>
                            </div>
                            {order.customer_phone && (
                                <a
                                    href={`tel:${order.customer_phone}`}
                                    className="ml-auto p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition"
                                >
                                    📞
                                </a>
                            )}
                        </div>

                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
                            <div className="text-zinc-500 text-xs mb-1">📍 ที่อยู่จัดส่ง</div>
                            <div>{order.customer_address || 'ไม่ระบุที่อยู่'}</div>
                        </div>

                        {order.customer_location_url && (
                            <a
                                href={order.customer_location_url}
                                target="_blank"
                                className="block p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 hover:bg-blue-100 transition text-center"
                            >
                                🗺️ เปิดดูแผนที่
                            </a>
                        )}

                        {order.notes && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-100 dark:border-yellow-900">
                                <div className="text-yellow-700 dark:text-yellow-400 text-xs mb-1">📝 หมายเหตุ</div>
                                <div>{order.notes}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Slip */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>🧾</span> หลักฐานการชำระเงิน
                    </h3>

                    {order.payment_slip_url ? (
                        <div className="space-y-4">
                            <a
                                href={order.payment_slip_url}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                            >
                                <img
                                    src={order.payment_slip_url}
                                    alt="Payment Slip"
                                    className="w-full max-h-80 object-contain rounded-xl border border-zinc-200 dark:border-zinc-700 hover:opacity-90 transition cursor-zoom-in"
                                />
                            </a>
                            <div className="text-center text-xs text-zinc-500">
                                คลิกที่รูปเพื่อดูขนาดเต็ม
                            </div>

                            {/* Slip Verification Status */}
                            <div className={`p-3 rounded-xl text-center text-sm font-medium ${order.payment_status === 'paid'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : order.payment_status === 'rejected'
                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                }`}>
                                {order.payment_status === 'paid' && '✅ ตรวจสอบสลิปแล้ว - ถูกต้อง'}
                                {order.payment_status === 'rejected' && '❌ สลิปไม่ถูกต้อง'}
                                {order.payment_status === 'pending' && '⏳ รอตรวจสอบสลิป'}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-zinc-500">
                            <div className="text-4xl mb-2">📄</div>
                            <p>ยังไม่มีหลักฐานการชำระเงิน</p>
                            {order.payment_method === 'cash' && (
                                <p className="text-sm mt-1">ลูกค้าเลือกชำระเงินสด</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Order Items */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>🛒</span> รายการสินค้า ({order.order_items?.length || 0} รายการ)
                    </h3>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {order.order_items?.map((item: any) => (
                        <div key={item.id} className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center text-xl">
                                📦
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold">{item.bundle_name}</div>
                                {item.chosen_options && Array.isArray(item.chosen_options) && item.chosen_options.length > 0 && (
                                    <div className="text-xs text-zinc-500 mt-1">
                                        {item.chosen_options.map((opt: any, i: number) => (
                                            <span key={i}>
                                                {opt.group_name}: {opt.name}
                                                {i < item.chosen_options.length - 1 && ' • '}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-zinc-500">x{item.quantity}</div>
                                <div className="font-bold">฿{(item.price * item.quantity).toLocaleString()}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">รวมทั้งสิ้น</span>
                        <span className="text-2xl font-black text-blue-600">฿{order.total_amount?.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
