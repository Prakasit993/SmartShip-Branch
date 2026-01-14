'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export type BundleInput = {
    id?: number;
    name: string;
    slug: string;
    description?: string;
    price: number;
    type: 'fixed' | 'configurable';
    category_id: number;
    image_urls?: string[];
    is_active: boolean;
    // Fixed items
    items?: { product_id: number; quantity: number }[];
    // Configurable groups
    option_groups?: {
        id?: number; // for update
        name: string;
        sort_order: number;
        options: {
            id?: number; // for update
            product_id: number;
            name?: string;
            price_modifier: number;
            sort_order: number;
        }[];
    }[];
};

export async function createBundle(data: BundleInput) {
    // 1. Create Bundle
    const { data: bundle, error: bundleError } = await supabaseAdmin
        .from('bundles')
        .insert({
            name: data.name,
            slug: data.slug,
            description: data.description,
            price: data.price,
            type: data.type,
            category_id: data.category_id,
            image_urls: data.image_urls,
            is_active: data.is_active
        })
        .select()
        .single();

    if (bundleError || !bundle) {
        return { error: 'Failed to create bundle: ' + bundleError?.message };
    }

    const bundleId = bundle.id;

    // 2. Handle Fixed Items
    if (data.type === 'fixed' && data.items && data.items.length > 0) {
        const itemsToInsert = data.items.map(item => ({
            bundle_id: bundleId,
            product_id: item.product_id,
            quantity: item.quantity
        }));
        const { error: itemsError } = await supabaseAdmin.from('bundle_items').insert(itemsToInsert);
        if (itemsError) console.error('Error inserting items:', itemsError);
    }

    // 3. Handle Configurable Options
    if (data.type === 'configurable' && data.option_groups) {
        for (const group of data.option_groups) {
            // Insert Group
            const { data: newGroup, error: groupError } = await supabaseAdmin
                .from('bundle_option_groups')
                .insert({
                    bundle_id: bundleId,
                    name: group.name,
                    sort_order: group.sort_order
                })
                .select()
                .single();

            if (groupError || !newGroup) {
                console.error('Error creating group:', groupError);
                continue;
            }

            // Insert Options for Group
            if (group.options && group.options.length > 0) {
                const optionsToInsert = group.options.map(opt => ({
                    group_id: newGroup.id,
                    product_id: opt.product_id,
                    name: opt.name,
                    price_modifier: opt.price_modifier,
                    sort_order: opt.sort_order
                }));
                const { error: optsError } = await supabaseAdmin.from('bundle_options').insert(optionsToInsert);
                if (optsError) {
                    console.error('Error inserting options:', optsError);
                    throw new Error(optsError.message);
                }
            }
        }
    }

    revalidatePath('/admin/bundles');
    return { success: true };
}

export async function updateBundle(data: BundleInput) {
    if (!data.id) return { error: 'Bundle ID is required' };

    // 1. Update Bundle Basics
    const { error: bundleError } = await supabaseAdmin
        .from('bundles')
        .update({
            name: data.name,
            slug: data.slug,
            description: data.description,
            price: data.price,
            type: data.type,
            category_id: data.category_id,
            image_urls: data.image_urls,
            is_active: data.is_active
        })
        .eq('id', data.id);

    if (bundleError) return { error: bundleError.message };

    // 2. Clear existing relations and re-insert (Simplest strategy for MVP update)
    // NOTE: This destroys IDs, which might be bad if we tracked history, but for now it's robust.
    await supabaseAdmin.from('bundle_items').delete().eq('bundle_id', data.id);
    // Deleting groups will cascade delete options
    await supabaseAdmin.from('bundle_option_groups').delete().eq('bundle_id', data.id);

    // 3. Re-insert Fixed Items
    if (data.type === 'fixed' && data.items && data.items.length > 0) {
        const itemsToInsert = data.items.map(item => ({
            bundle_id: data.id,
            product_id: item.product_id, // ensure no null
            quantity: item.quantity
        }));
        await supabaseAdmin.from('bundle_items').insert(itemsToInsert);
    }

    // 4. Re-insert Config groups
    if (data.type === 'configurable' && data.option_groups) {
        for (const group of data.option_groups) {
            const { data: newGroup, error: groupError } = await supabaseAdmin
                .from('bundle_option_groups')
                .insert({
                    bundle_id: data.id,
                    name: group.name,
                    sort_order: group.sort_order
                })
                .select()
                .single();

            if (newGroup && group.options) {
                const optionsToInsert = group.options.map(opt => ({
                    group_id: newGroup.id,
                    product_id: opt.product_id,
                    name: opt.name,
                    price_modifier: opt.price_modifier,
                    sort_order: opt.sort_order
                }));
                await supabaseAdmin.from('bundle_options').insert(optionsToInsert);
            }
        }
    }

    revalidatePath('/admin/bundles');
    return { success: true };
}

export async function deleteBundle(id: number) {
    const { error } = await supabaseAdmin.from('bundles').delete().eq('id', id);
    if (error) {
        console.error('Delete bundle error:', error.message);
    }
    revalidatePath('/admin/bundles');
}
