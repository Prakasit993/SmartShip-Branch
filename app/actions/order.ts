'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyAdminNewOrder } from '@app/lib/line';


export async function createOrder(prevState: any, formData: FormData) {
    const rawCart = formData.get('cart') as string;
    const cartItems = JSON.parse(rawCart);

    const customerName = formData.get('name') as string;
    const customerPhone = formData.get('phone') as string;
    const customerAddress = formData.get('address') as string;
    const paymentMethod = formData.get('payment_method') as string;
    const notes = formData.get('notes') as string;

    if (!cartItems || cartItems.length === 0) {
        return { error: 'Cart is empty' };
    }

    // 1. Calculate Total and Validate Stock (Secure Server-Side Calculation)
    let totalAmount = 0;
    const verifiedOrderItems = [];

    for (const item of cartItems) {
        // Fetch authoritative bundle data
        const { data: bundle, error: bundleError } = await supabaseAdmin
            .from('bundles')
            .select('id, price, type, name')
            .eq('id', item.bundle_id)
            .single();

        if (bundleError || !bundle) {
            return { error: `Invalid bundle in cart: ${item.bundle_name}` };
        }

        let unitPrice = Number(bundle.price);
        let verifiedOptions = null;

        // Handle Configurable Options
        if (item.options && Array.isArray(item.options) && item.options.length > 0) {
            verifiedOptions = [];
            for (const opt of item.options) {
                // Verify each option's price modifier
                // We need to join to ensure this option belongs to the correct bundle
                const { data: optionData, error: optError } = await supabaseAdmin
                    .from('bundle_options')
                    .select('price_modifier, product_id, group_id, bundle_option_groups!inner(bundle_id)')
                    .eq('product_id', opt.product_id)
                    .eq('bundle_option_groups.bundle_id', bundle.id)
                    .single();

                if (optError || !optionData) {
                    // If option not found for this bundle, technically invalid. 
                    // For now, we might skip or error. Let's error to be safe.
                    // However, simplified context: maybe just ignore invalid options?
                    // Safer to error to prevent 'exploring' hidden items.
                    return { error: `Invalid option selected for ${bundle.name}` };
                }

                const modifier = Number(optionData.price_modifier);
                unitPrice += modifier;

                // Push verified option structure (trusting labels from client is ok for display, but price must be real)
                verifiedOptions.push({
                    ...opt,
                    price_modifier: modifier // Enforce real modifier
                });
            }
        }

        const lineTotal = unitPrice * item.quantity;
        totalAmount += lineTotal;

        verifiedOrderItems.push({
            bundle_id: bundle.id,
            bundle_name: bundle.name, // Use DB name or Client name? DB is safer.
            price: unitPrice,
            quantity: item.quantity,
            chosen_options: verifiedOptions
        });
    }

    // 2. Generate Order No
    const orderNo = `ORD-${Date.now()}`;

    // 2.5 Get User ID (if logged in)
    // We need to use a standard client to get the auth user, because admin client doesn't know the context user.
    // However, in Server Actions, we can just use createServerComponentClient or similar, 
    // but easier: pass user_id from client? NO, insecure.
    // Better: Use `cookies` to get session.

    // We'll trust the caller? No.
    // Let's use `supabase` (auth helper) to get the user.
    const { createServerActionClient } = await import('@supabase/auth-helpers-nextjs');
    const { cookies } = await import('next/headers');
    const supabase = createServerActionClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    // 3. Create Order
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
            order_no: orderNo,
            user_id: user?.id || null, // Link to user
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            total_amount: totalAmount,
            status: 'new',
            payment_method: paymentMethod,
            payment_status: 'pending',
            notes: notes,
            // Reservation logic: expire in 15 mins
            stock_reserved_until: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })
        .select()
        .single();

    if (orderError || !order) {
        return { error: 'Failed to create order: ' + orderError?.message };
    }

    // 4. Create Order Items
    const orderItemsToInsert = verifiedOrderItems.map((item: any) => ({
        order_id: order.id,
        bundle_id: item.bundle_id,
        bundle_name: item.bundle_name,
        price: item.price,
        quantity: item.quantity,
        chosen_options: item.chosen_options // JSONB
    }));

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItemsToInsert);

    if (itemsError) {
        console.error('Error inserting items:', itemsError);
        // Rollback order? Basic compensation:
        await supabaseAdmin.from('orders').delete().eq('id', order.id);
        return { error: 'Failed to create order items.' };
    }

    // 5. Stock Deduction (MOVED TO ADMIN CONFIRMATION)
    // We do NOT deduct stock here anymore. 
    // This allows customers to place orders without locking inventory until Admin approves.

    // LINE Notification
    await notifyAdminNewOrder(order);

    // LINE Notification
    await notifyAdminNewOrder(order);

    return { success: true, orderNo: orderNo };
}
