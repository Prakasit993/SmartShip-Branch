'use client';

import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';

interface CustomerData {
    name: string;
    phone: string;
    address: string;
}

function ProfileContent() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromCheckout = searchParams.get('from') === 'checkout';

    const [formData, setFormData] = useState<CustomerData>({
        name: '',
        phone: '',
        address: '',
    });

    // Orders state
    const [orders, setOrders] = useState<any[]>([]);

    // Fetch user and customer data
    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login?next=/profile');
                return;
            }
            setUser(user);

            // Fetch customer data
            const { data: customer } = await supabase
                .from('customers')
                .select('*')
                .eq('line_user_id', user.id)
                .single();

            if (customer) {
                setFormData({
                    name: customer.name || '',
                    phone: customer.phone || '',
                    address: customer.address || '',
                });
            }

            // Fetch orders using Server Action (bypasses RLS and supports fallback)
            // Pass user.id from client to ensuring we have context even if cookie is flaky
            const { getUserOrders } = await import('@app/actions/user');
            const { orders: fetchedOrders, error } = await getUserOrders(user.id);

            if (fetchedOrders) {
                setOrders(fetchedOrders);
            }

            setLoading(false);
        };
        fetchData();
    }, [router]);

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        // Validate required fields
        if (!formData.phone || !formData.address) {
            setMessage({ text: '❌ กรุณากรอกเบอร์โทรและที่อยู่', type: 'error' });
            setSaving(false);
            return;
        }

        try {
            const { error } = await supabase
                .from('customers')
                .upsert({
                    line_user_id: user.id,
                    name: formData.name,
                    phone: formData.phone,
                    address: formData.address,
                }, { onConflict: 'line_user_id' });

            if (error) throw error;

            // Redirect back to checkout if came from there
            if (fromCheckout) {
                setMessage({ text: '✅ บันทึกแล้ว! กำลังไปหน้าชำระเงิน...', type: 'success' });
                setTimeout(() => {
                    router.push('/checkout');
                }, 1000);
            } else {
                setMessage({ text: '✅ บันทึกข้อมูลเรียบร้อยแล้ว!', type: 'success' });
            }
        } catch (error: any) {
            console.error('Save error:', error);
            setMessage({ text: '❌ เกิดข้อผิดพลาด: ' + error.message, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-zinc-500">Loading profile...</div>;
    if (!user) return null;

    return (
        <div className="container mx-auto px-4 py-8 pb-24">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-lg">
                            {formData.name?.[0]?.toUpperCase() || user.email?.[0].toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">ข้อมูลบัญชีของฉัน</h1>
                            <p className="text-zinc-500 text-sm">{user.email}</p>
                        </div>
                    </div>
                </div>

                {/* From Checkout Notice */}
                {fromCheckout && (
                    <div className="mb-6 p-4 rounded-lg bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-sm">
                        📝 กรุณากรอกข้อมูลให้ครบก่อนดำเนินการสั่งซื้อ
                    </div>
                )}

                {/* Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-lg text-sm ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    <h2 className="text-lg font-bold border-b dark:border-zinc-800 pb-3">ข้อมูลจัดส่ง</h2>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium mb-2">ชื่อ - นามสกุล</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="กรอกชื่อ-นามสกุล"
                            className="w-full px-4 py-3 border rounded-xl dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="08X-XXX-XXXX"
                            required
                            className="w-full px-4 py-3 border rounded-xl dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            ที่อยู่จัดส่ง <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            rows={3}
                            required
                            placeholder="บ้านเลขที่, ซอย, ถนน, แขวง/ตำบล, เขต/อำเภอ, จังหวัด, รหัสไปรษณีย์"
                            className="w-full px-4 py-3 border rounded-xl dark:bg-zinc-800 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {saving ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูล'}
                    </button>
                </form>

                {/* Orders Section */}
                <div className="mt-6 bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <h2 className="text-lg font-bold border-b dark:border-zinc-800 pb-3 mb-4 flex items-center gap-2">
                        📦 ประวัติคำสั่งซื้อ
                        {orders.length > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                {orders.length} รายการ
                            </span>
                        )}
                    </h2>

                    {orders.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            <div className="text-4xl mb-2">📭</div>
                            <p>ยังไม่มีคำสั่งซื้อ</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {orders.map((order) => {
                                const statusMap: Record<string, { label: string; emoji: string; color: string }> = {
                                    pending: { label: 'รอดำเนินการ', emoji: '⏳', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
                                    confirmed: { label: 'ยืนยันแล้ว', emoji: '✅', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
                                    shipped: { label: 'จัดส่งแล้ว', emoji: '🚚', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
                                    completed: { label: 'สำเร็จ', emoji: '🎉', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
                                    cancelled: { label: 'ยกเลิก', emoji: '❌', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
                                };
                                const statusData = statusMap[order.status] || statusMap.pending;
                                const orderDate = new Date(order.created_at);
                                const formattedDate = orderDate.toLocaleDateString('th-TH', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });

                                return (
                                    <div
                                        key={order.id}
                                        className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">

                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusData.color}`}>
                                                {statusData.emoji} {statusData.label}
                                            </span>
                                        </div>

                                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                            {order.order_items?.map((item: any, idx: number) => (
                                                <span key={item.id}>
                                                    {item.bundle_name} x{item.quantity}
                                                    {idx < order.order_items.length - 1 && ', '}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-zinc-500">{formattedDate}</span>
                                            <span className="font-bold text-zinc-900 dark:text-white">
                                                ฿{(order.total_amount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-6 bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            router.push('/');
                        }}
                        className="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-xl font-bold transition-colors"
                    >
                        ออกจากระบบ
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div className="container mx-auto px-4 py-8 max-w-lg">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mx-auto"></div>
                    <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
                </div>
            </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}
