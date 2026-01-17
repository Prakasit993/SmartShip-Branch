import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
    // Fetch Quick Stats
    const { count: orderCount } = await supabaseAdmin.from('orders').select('*', { count: 'exact', head: true });

    // Calculate Today's Sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: todayOrders } = await supabaseAdmin
        .from('orders')
        .select('total_amount')
        .gte('created_at', today.toISOString());
    const todaySales = todayOrders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

    const { count: productCount } = await supabaseAdmin.from('products').select('*', { count: 'exact', head: true });

    // Fetch Recent Orders
    const { data: recentOrders } = await supabaseAdmin
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    // Fetch Last 7 Days Sales Data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const { data: dayOrders } = await supabaseAdmin
            .from('orders')
            .select('total_amount')
            .gte('created_at', date.toISOString())
            .lt('created_at', nextDate.toISOString());

        const dayTotal = dayOrders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
        last7Days.push({
            date: date.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' }),
            total: dayTotal,
        });
    }
    const maxSale = Math.max(...last7Days.map(d => d.total), 1);

    // Fetch Order Status Breakdown
    const { data: allOrders } = await supabaseAdmin.from('orders').select('status, payment_status');
    const statusBreakdown = {
        new: allOrders?.filter(o => o.status === 'new').length || 0,
        confirmed: allOrders?.filter(o => o.status === 'confirmed').length || 0,
        shipped: allOrders?.filter(o => o.status === 'shipped').length || 0,
        completed: allOrders?.filter(o => o.status === 'completed').length || 0,
        canceled: allOrders?.filter(o => o.status === 'canceled').length || 0,
    };
    const totalOrders = Object.values(statusBreakdown).reduce((a, b) => a + b, 0) || 1;

    // Payment Status
    const paymentBreakdown = {
        paid: allOrders?.filter(o => o.payment_status === 'paid').length || 0,
        pending: allOrders?.filter(o => o.payment_status === 'pending').length || 0,
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">📊 Dashboard</h1>
                    <p className="text-zinc-500 text-sm mt-1">ภาพรวมร้านค้าของคุณ</p>
                </div>
                <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                <StatCard label="ยอดขายวันนี้" value={`฿${todaySales.toLocaleString()}`} icon="💰" color="from-green-500 to-emerald-600" />
                <StatCard label="ออเดอร์ทั้งหมด" value={orderCount || 0} icon="📦" color="from-blue-500 to-indigo-600" />
                <StatCard label="รอดำเนินการ" value={statusBreakdown.new + statusBreakdown.confirmed} icon="⏳" color="from-yellow-500 to-orange-500" />
                <StatCard label="สินค้าในร้าน" value={productCount || 0} icon="🏷️" color="from-purple-500 to-pink-600" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Chart */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>📈</span> ยอดขาย 7 วันล่าสุด
                    </h2>
                    <div className="flex items-end gap-2 h-40">
                        {last7Days.map((day, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                    {day.total > 0 ? `฿${(day.total / 1000).toFixed(0)}k` : '-'}
                                </div>
                                <div
                                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all hover:from-blue-500 hover:to-blue-300"
                                    style={{ height: `${(day.total / maxSale) * 100}%`, minHeight: day.total > 0 ? '8px' : '2px' }}
                                />
                                <div className="text-[10px] text-zinc-500 font-medium">{day.date}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order Status Breakdown */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <span>🎯</span> สถานะออเดอร์
                    </h2>
                    <div className="space-y-3">
                        <StatusBar label="ใหม่" count={statusBreakdown.new} total={totalOrders} color="bg-blue-500" icon="🆕" />
                        <StatusBar label="ยืนยันแล้ว" count={statusBreakdown.confirmed} total={totalOrders} color="bg-yellow-500" icon="✅" />
                        <StatusBar label="จัดส่งแล้ว" count={statusBreakdown.shipped} total={totalOrders} color="bg-purple-500" icon="🚚" />
                        <StatusBar label="สำเร็จ" count={statusBreakdown.completed} total={totalOrders} color="bg-green-500" icon="✨" />
                        <StatusBar label="ยกเลิก" count={statusBreakdown.canceled} total={totalOrders} color="bg-red-500" icon="❌" />
                    </div>

                    {/* Payment Summary */}
                    <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">💳 ชำระแล้ว</span>
                            <span className="font-bold text-green-600">{paymentBreakdown.paid} รายการ</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                            <span className="text-zinc-500">⏰ รอชำระ</span>
                            <span className="font-bold text-yellow-600">{paymentBreakdown.pending} รายการ</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <span>📋</span> ออเดอร์ล่าสุด
                    </h2>
                    <Link href="/admin/orders" className="text-sm text-blue-600 font-medium hover:underline">ดูทั้งหมด →</Link>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {recentOrders?.map((order) => (
                        <Link
                            key={order.id}
                            href={`/admin/orders/${order.id}`}
                            className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                    {(order.customer_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">{order.order_no}</div>
                                    <div className="text-xs text-zinc-500">{order.customer_name || 'ไม่ระบุ'}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold">฿{order.total_amount?.toLocaleString()}</div>
                                <StatusBadge status={order.status} />
                            </div>
                        </Link>
                    ))}
                    {(!recentOrders || recentOrders.length === 0) && (
                        <div className="p-8 text-center text-zinc-500">ยังไม่มีออเดอร์</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
    return (
        <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl p-4 md:p-6 border border-zinc-200 dark:border-zinc-800">
            <div className={`absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br ${color} rounded-full opacity-10`} />
            <div className="text-2xl mb-2">{icon}</div>
            <p className="text-zinc-500 text-xs md:text-sm font-medium">{label}</p>
            <h3 className="text-xl md:text-2xl font-black mt-1 tracking-tight">{value}</h3>
        </div>
    );
}

function StatusBar({ label, count, total, color, icon }: { label: string; count: number; total: number; color: string; icon: string }) {
    const percentage = Math.round((count / total) * 100);
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-1">
                    <span className="text-xs">{icon}</span>
                    <span className="font-medium">{label}</span>
                </span>
                <span className="text-zinc-500">{count} ({percentage}%)</span>
            </div>
            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percentage}%` }} />
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; bg: string }> = {
        new: { label: 'ใหม่', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
        confirmed: { label: 'ยืนยัน', bg: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
        shipped: { label: 'จัดส่ง', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
        completed: { label: 'สำเร็จ', bg: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
        canceled: { label: 'ยกเลิก', bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    };
    const s = config[status] || { label: status, bg: 'bg-zinc-100' };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.bg}`}>{s.label}</span>;
}
