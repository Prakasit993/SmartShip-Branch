import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
    // Fetch Quick Stats
    const { count: orderCount } = await supabaseAdmin.from('orders').select('*', { count: 'exact', head: true });

    // Calculate Today's Sales (Approximate)
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

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Dashboard</h1>
                    <p className="text-zinc-500 mt-1">Overview of your shop's performance.</p>
                </div>
                <div className="hidden md:block text-right">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-zinc-500">Bangkok, Thailand</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Today's Sales"
                    value={`฿${todaySales.toLocaleString()}`}
                    icon="💰"
                    trend="+12% from yesterday"
                    trendColor="text-green-500"
                />
                <StatCard
                    label="Total Orders"
                    value={orderCount || 0}
                    icon="📦"
                    trend="Lifetime volume"
                    trendColor="text-zinc-400"
                />
                <StatCard
                    label="Active Products"
                    value={productCount || 0}
                    icon="🏷️"
                    trend="In catalog"
                    trendColor="text-blue-500"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Recent Orders</h2>
                        <Link href="/admin/orders" className="text-sm text-blue-600 font-medium hover:underline">View All</Link>
                    </div>

                    <div className="bg-white dark:bg-black rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 font-medium border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4">Order No</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {recentOrders?.map((order) => (
                                    <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">
                                            <Link href={`/admin/orders/${order.id}`} className="hover:text-blue-500 transition-colors">
                                                {order.order_no}
                                            </Link>
                                            <div className="text-xs text-zinc-500 font-normal">{new Date(order.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold">฿{order.total_amount}</td>
                                    </tr>
                                ))}
                                {(!recentOrders || recentOrders.length === 0) && (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">No recent orders.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold">Quick Actions</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <ActionCard
                            href="/admin/products"
                            title="Manage Products"
                            desc="Add or edit catalog items."
                            icon="✨"
                            color="bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                        />
                        <ActionCard
                            href="/admin/orders"
                            title="Process Orders"
                            desc="Update shipping status."
                            icon="🚚"
                            color="bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        />
                        <ActionCard
                            href="/admin/settings"
                            title="Shop Settings"
                            desc="Configure hero & contacts."
                            icon="⚙️"
                            color="bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        />
                    </div>

                    {/* Mini Stock Alert (Mockup) */}
                    <div className="p-6 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/20 mt-8">
                        <div className="flex items-center gap-3 text-yellow-800 dark:text-yellow-500 mb-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            <h3 className="font-bold text-sm">Low Stock Alert</h3>
                        </div>
                        <p className="text-xs text-yellow-700 dark:text-yellow-600 leading-relaxed">
                            Some packaging items are running low. Check the Stock page to replenish inventory.
                        </p>
                        <Link href="/admin/stock" className="block mt-3 text-xs font-bold text-yellow-800 hover:underline">Check Inventory →</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, trend, trendColor }: any) {
    return (
        <div className="p-6 bg-white dark:bg-black rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 transition-colors">
            <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-900 rounded-xl flex items-center justify-center text-2xl">
                    {icon}
                </div>
                <span className={`text-xs font-bold ${trendColor} bg-zinc-50 dark:bg-zinc-900 px-2 py-1 rounded-full`}>
                    {trend}
                </span>
            </div>
            <p className="text-zinc-500 text-sm font-medium">{label}</p>
            <h3 className="text-3xl font-black mt-1 tracking-tight text-zinc-900 dark:text-white">{value}</h3>
        </div>
    );
}

function ActionCard({ href, title, desc, icon, color }: any) {
    return (
        <Link href={href} className="flex items-center gap-4 p-4 bg-white dark:bg-black rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:shadow-md hover:border-blue-500/30 transition-all group">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${color}`}>
                {icon}
            </div>
            <div>
                <h3 className="font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors">{title}</h3>
                <p className="text-xs text-zinc-500">{desc}</p>
            </div>
        </Link>
    );
}

function StatusBadge({ status }: { status: string }) {
    const colors: any = {
        new: 'bg-blue-100 text-blue-800',
        confirmed: 'bg-yellow-100 text-yellow-800',
        paid: 'bg-indigo-100 text-indigo-800',
        shipped: 'bg-purple-100 text-purple-800',
        completed: 'bg-green-100 text-green-800',
        canceled: 'bg-red-100 text-red-800',
    };
    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
            {status}
        </span>
    );
}
