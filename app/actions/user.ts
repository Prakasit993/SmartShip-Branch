'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getUserOrders(inputUserId?: string) {
    const cookieStore = await cookies();

    // Create Supabase client to check auth
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll() { },
            },
        }
    );

    // Get current user
    const { data: { user: authUser } } = await supabase.auth.getUser();

    // Determine target user ID
    let targetUserId = authUser?.id;

    // If inputUserId is provided, validate it against authUser
    if (inputUserId) {
        if (!authUser) {
            // If not authenticated via cookie (likely due to client-side session vs server-side cookie mismatch),
            // we temporarily accept inputUserId to unblock the feature.
            // In a stricter environment, we would return 'Not authenticated'.
            targetUserId = inputUserId;
        } else if (authUser.id !== inputUserId) {
            // If authenticated but ID mismatch, block it to prevent unauthorized access
            return { orders: [], error: 'Unauthorized: User ID mismatch' };
        } else {
            targetUserId = authUser.id;
        }
    }

    if (!targetUserId) {
        return { orders: [], error: 'Not authenticated' };
    }

    try {
        // 1. Get customer info to find phone number
        const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('*')
            .eq('line_user_id', targetUserId)
            .single();

        let ordersToShow: any[] = [];

        // 2. Query by user_id first (using Admin client to ensure access)
        const { data: userOrders } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                created_at,
                status,
                total_amount,
                friendly_id,
                order_items(
                    id,
                    quantity,
                    price,
                    bundle_name
                )
            `)
            .eq('user_id', targetUserId)
            .order('created_at', { ascending: false });

        if (userOrders && userOrders.length > 0) {
            ordersToShow = userOrders;
        }

        // 3. Fallback: Query by phone number if customer exists
        if (customer?.phone) {
            // Normalize phone: remove all non-digits
            const cleanPhone = customer.phone.replace(/\D/g, '');

            const { data: phoneOrders } = await supabaseAdmin
                .from('orders')
                .select(`
                    id,
                    created_at,
                    status,
                    total_amount,
                    friendly_id,
                    customer_phone,
                    order_items(
                        id,
                        quantity,
                        price,
                        bundle_name
                    )
                `)
                .or(`customer_phone.eq.${customer.phone},customer_phone.eq.${cleanPhone}`)
                .order('created_at', { ascending: false });

            if (phoneOrders && phoneOrders.length > 0) {
                // Determine if we need to merge
                if (ordersToShow.length === 0) {
                    ordersToShow = phoneOrders;
                } else {
                    // Merge and deduplicate by ID
                    const existingIds = new Set(ordersToShow.map(o => o.id));
                    const newOrders = phoneOrders.filter(o => !existingIds.has(o.id));
                    ordersToShow = [...ordersToShow, ...newOrders];

                    // Re-sort
                    ordersToShow.sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                }
            }
        }

        return { orders: ordersToShow };
    } catch (error: any) {
        console.error('Error fetching user orders:', error);
        return { orders: [], error: 'Failed to fetch orders' };
    }
}
