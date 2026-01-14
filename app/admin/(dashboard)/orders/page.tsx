import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
    const { data: orders, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return <div className="text-red-500">Error loading orders: {error.message}</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Orders</h1>

            <div className="bg-white dark:bg-zinc-900 shadow rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Order No</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Payment</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-zinc-200 dark:divide-zinc-800">
                        {orders?.map((order) => (
                            <tr key={order.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{order.order_no}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {order.customer_name}<br />
                                    <span className="text-zinc-500 text-xs">{order.customer_phone}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                    {new Date(order.created_at).toLocaleDateString('th-TH')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">฿{order.total_amount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${order.status === 'new' ? 'bg-blue-100 text-blue-800' : ''}
                        ${order.status === 'confirmed' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${order.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                        ${order.status === 'canceled' ? 'bg-gray-100 text-gray-800' : ''}
                    `}>
                                        {order.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                    `}>
                                        {order.payment_status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link href={`/admin/orders/${order.id}`} className="text-blue-600 hover:text-blue-900">
                                        View
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {orders?.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-4 text-center text-zinc-500">No orders found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
