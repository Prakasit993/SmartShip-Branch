import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { updateOrderStatus, updatePaymentStatus } from '../actions';
import { notFound } from 'next/navigation';
import Image from 'next/image';

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

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Back Button */}
            <a href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-blue-600 transition-colors">
                <span>←</span>
                <span>กลับไปหน้ารายการคำสั่งซื้อ</span>
            </a>

            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold">Order {order.order_no}</h1>
                    <p className="text-zinc-500">Placed on {new Date(order.created_at).toLocaleString('th-TH')}</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold">฿{order.total_amount}</div>
                    <div className="text-sm text-zinc-500 capitalize">{order.payment_method}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold mb-4">Customer Details</h3>
                    <div className="space-y-2 text-sm">
                        <p><span className="text-zinc-500">Name:</span> {order.customer_name}</p>
                        <p><span className="text-zinc-500">Phone:</span> {order.customer_phone}</p>
                        <p><span className="text-zinc-500">Address:</span> {order.customer_address}</p>
                        {order.customer_location_url && (
                            <a href={order.customer_location_url} target="_blank" className="text-blue-600 hover:underline">View Map Location</a>
                        )}
                        {order.notes && (
                            <p className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-100 dark:border-yellow-900"><span className="font-bold">Note:</span> {order.notes}</p>
                        )}
                    </div>
                </div>

                {/* Management */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold mb-4">Order Management</h3>

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">Status</label>
                        <form action={async (formData) => {
                            'use server';
                            await updateOrderStatus(order.id, formData.get('status') as string);
                        }}>
                            <div className="flex gap-2">
                                <select
                                    name="status"
                                    defaultValue={order.status}
                                    className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm flex-1"
                                >
                                    <option value="new">New</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="preparing">Preparing</option>
                                    <option value="ready">Ready for Pickup/Delivered</option>
                                    <option value="completed">Completed</option>
                                    <option value="canceled">Canceled</option>
                                </select>
                                <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded text-sm">Update</button>
                            </div>
                        </form>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Payment Status</label>
                        <form action={async (formData) => {
                            'use server';
                            await updatePaymentStatus(order.id, formData.get('status') as string);
                        }}>
                            <div className="flex gap-2">
                                <select
                                    name="status"
                                    defaultValue={order.payment_status}
                                    className="bg-white dark:bg-black border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-sm flex-1"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                                <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded text-sm">Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Payment Slip */}
            {order.payment_slip_url && (
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-semibold mb-4">Payment Slip</h3>
                    <a href={order.payment_slip_url} target="_blank" rel="noreferrer">
                        <img
                            src={order.payment_slip_url}
                            alt="Payment Slip"
                            className="max-h-96 rounded border border-zinc-200"
                        />
                    </a>
                </div>
            )}

            {/* Items */}
            <div className="bg-white dark:bg-zinc-900 shadow rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Item</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Options</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Qty</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Total</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-zinc-200 dark:divide-zinc-800">
                        {order.order_items.map((item: any) => (
                            <tr key={item.id}>
                                <td className="px-6 py-4 text-sm font-medium">{item.bundle_name}</td>
                                <td className="px-6 py-4 text-sm text-zinc-500">
                                    {item.chosen_options && Array.isArray(item.chosen_options) ? (
                                        <ul className="list-disc pl-4">
                                            {item.chosen_options.map((opt: any, i: number) => (
                                                <li key={i}>{opt.group_name}: {opt.name}</li>
                                            ))}
                                        </ul>
                                    ) : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm text-right">฿{item.price}</td>
                                <td className="px-6 py-4 text-sm text-right">{item.quantity}</td>
                                <td className="px-6 py-4 text-sm text-right font-medium">฿{item.price * item.quantity}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
