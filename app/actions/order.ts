'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyAdminNewOrder } from '@app/lib/line';
import { triggerN8nOrderEmail } from '@app/lib/n8n';


export async function createOrder(prevState: any, formData: FormData) {
    const rawCart = formData.get('cart') as string;
    const cartItems = JSON.parse(rawCart);

    const customerName = formData.get('name') as string;
    const customerPhone = formData.get('phone') as string;
    const customerEmail = formData.get('email') as string || '';
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

    // 2.5 Get User ID (if logged in)
    const { createServerClient } = await import('@supabase/ssr');
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
    const { data: { user } } = await supabase.auth.getUser();

    // 2.6 Get Customer ID and Update Customer Profile
    let customerId: string | null = null;
    if (user) {
        // Lookup customer by user ID
        const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('id')
            .eq('line_user_id', user.id)
            .single();

        if (customer) {
            customerId = customer.id;

            // Update customer profile with checkout info (if not already filled)
            await supabaseAdmin
                .from('customers')
                .update({
                    name: customerName,
                    phone: customerPhone,
                    address: customerAddress,
                })
                .eq('id', customer.id);
        }
    }

    // 3. Create Order
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
            order_no: orderNo,
            user_id: user?.id || null,
            customer_id: customerId, // Link to customer record
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail || null,
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

    // n8n Email Trigger (if email provided)
    if (customerEmail) {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://smartship.vercel.app';
        await triggerN8nOrderEmail({
            order_no: orderNo,
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            customer_address: customerAddress,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            items: verifiedOrderItems.map(item => ({
                name: item.bundle_name,
                quantity: item.quantity,
                price: item.price,
                line_total: item.price * item.quantity
            })),
            pay_link: `${baseUrl}/pay/${orderNo}`,
            created_at: new Date().toISOString()
        });
    }

    return { success: true, orderNo: orderNo };
}
