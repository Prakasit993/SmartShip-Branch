import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order_no?: string }> }) {
    const { order_no } = await searchParams;

    let order = null;
    if (order_no) {
        const { data } = await supabase.from('orders').select('*').eq('order_no', order_no).single();
        order = data;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-xl text-center">
            <h1 className="text-3xl font-bold mb-8">Track Your Order</h1>

            <form className="flex gap-2 mb-8">
                <input
                    name="order_no"
                    defaultValue={order_no}
                    placeholder="Enter Order No (e.g. ORD-1234)"
                    className="flex-1 px-4 py-2 border rounded dark:bg-black dark:border-zinc-700"
                />
                <button type="submit" className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 rounded">
                    Track
                </button>
            </form>

            {order ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-lg shadow-sm text-left">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-green-600">Order Found!</h2>
                        <span className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded text-sm font-semibold capitalize">
                            {order.status}
                        </span>
                    </div>
                    <p className="mb-2"><span className="font-semibold">Order No:</span> {order.order_no}</p>
                    <p className="mb-2"><span className="font-semibold">Total:</span> ฿{order.total_amount}</p>
                    <p className="mb-2"><span className="font-semibold">Payment Status:</span> {order.payment_status}</p>

                    <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                        <h3 className="font-semibold mb-2">Instructions</h3>
                        {order.payment_method === 'transfer' && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded text-sm">
                                Please transfer to Bank XYZ (123-456-789).<br />
                                Then send the slip to our LINE Official Account.
                            </div>
                        )}
                        {order.payment_method === 'promptpay' && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded text-sm">
                                Please scan the QR Code (not implemented in MVP) to pay.
                            </div>
                        )}
                        <div className="mt-4">
                            <Link href="/shop" className="text-blue-600 hover:underline">Continue Shopping</Link>
                        </div>
                    </div>
                </div>
            ) : order_no ? (
                <div className="text-red-500">Order not found. Please check the number.</div>
            ) : null}
        </div>
    );
}
