'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

export async function updateOrderStatus(orderId: number, status: string) {
    // Validate status
    const validStatuses = ['new', 'confirmed', 'preparing', 'ready', 'completed', 'canceled'];
    if (!validStatuses.includes(status)) {
        return { error: 'Invalid status' };
    }

    // 1. Fetch current status to check if we are transitioning TO 'confirmed'
    const { data: currentOrder } = await supabaseAdmin
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

    // 2. Update Status
    const { error } = await supabaseAdmin
        .from('orders')
        .update({ status })
        .eq('id', orderId);

    if (error) return { error: error.message };

    // 3. MVP STOCK LOGIC: Deduct on FIRST confirmation
    if (status === 'confirmed' && currentOrder?.status !== 'confirmed') {
        // Fetch order items to deduce stock
        const { data: items } = await supabaseAdmin
            .from('order_items')
            .select('*, bundles(bundle_items(product_id, quantity))') // Nested fetch for fixed bundles
            .eq('order_id', orderId);

        if (items) {
            for (const item of items) {
                // Logic: If bundle is fixed, deduct items. If configurable, we need to parse chosen_options (omitted for MVP speed, focusing on fixed bundles first)
                const bundleItems = item.bundles?.bundle_items;
                if (bundleItems) {
                    for (const bItem of bundleItems) {
                        // Decrement Product Stock
                        // Note: RPC call is safer for atomicity, but simple update works for low traffic
                        await supabaseAdmin.rpc('decrement_stock', {
                            row_id: bItem.product_id,
                            amount: bItem.quantity * item.quantity
                        });
                    }
                }
            }
        }
    }

    // TODO: Send LINE Notification to Customer

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath('/admin/orders');
    return { success: true };
}

export async function updatePaymentStatus(orderId: number, paymentStatus: string) {
    const validStatuses = ['pending', 'paid', 'rejected'];
    if (!validStatuses.includes(paymentStatus)) {
        return { error: 'Invalid payment status' };
    }

    const { error } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: paymentStatus })
        .eq('id', orderId);

    if (error) return { error: error.message };

    revalidatePath(`/admin/orders/${orderId}`);
}
