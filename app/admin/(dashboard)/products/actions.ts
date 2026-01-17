'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createProduct(formData: FormData) {
    const name = formData.get('name') as string;
    const sku = formData.get('sku') as string;
    const price = parseFloat(formData.get('price') as string) || 0;
    const stock_quantity = parseInt(formData.get('stock_quantity') as string) || 0;
    const description = formData.get('description') as string;
    const image_urls = formData.getAll('image_urls').map(url => url as string).filter(url => url.trim() !== '');
    // Backwards compatibility
    const image_url = image_urls[0] || '';

    const width = parseFloat(formData.get('width') as string) || 0;
    const length = parseFloat(formData.get('length') as string) || 0;
    const height = parseFloat(formData.get('height') as string) || 0;
    const weight = parseFloat(formData.get('weight') as string) || 0;
    const color = formData.get('color') as string;
    const size_label = formData.get('size_label') as string;
    const thickness = formData.get('thickness') as string;

    // Promo & Features
    const promotional_price = parseFloat(formData.get('promotional_price') as string) || null;
    const promo_min_quantity = parseInt(formData.get('promo_min_quantity') as string) || 1;
    const is_featured = formData.get('is_featured') === 'on';

    if (!name || !price) {
        // return { error: 'Name and Price are required' };
        throw new Error('Name and Price are required');
    }

    const { error } = await supabaseAdmin
        .from('products')
        .insert({
            name,
            sku,
            price,
            stock_quantity,
            description,
            image_url, // Legacy
            image_urls, // New
            is_active: true,
            width, length, height, weight, color, size_label, thickness,
            promotional_price, promo_min_quantity, is_featured
        });


    if (error) {
        console.error(error);
        throw new Error(error.message);
    }

    revalidatePath('/admin/products');
    redirect('/admin/products?toast=success&message=' + encodeURIComponent('สร้างสินค้าใหม่สำเร็จ'));
}

export async function updateProduct(id: number, formData: FormData) {
    const name = formData.get('name') as string;
    const sku = formData.get('sku') as string;
    const price = parseFloat(formData.get('price') as string) || 0;
    const stock_quantity = parseInt(formData.get('stock_quantity') as string) || 0;
    const description = formData.get('description') as string;
    const is_active = formData.get('is_active') === 'on';

    const image_urls = formData.getAll('image_urls').map(url => url as string).filter(url => url.trim() !== '');
    const image_url = image_urls[0] || '';

    const width = parseFloat(formData.get('width') as string) || 0;
    const length = parseFloat(formData.get('length') as string) || 0;
    const height = parseFloat(formData.get('height') as string) || 0;
    const weight = parseFloat(formData.get('weight') as string) || 0;
    const color = formData.get('color') as string;
    const size_label = formData.get('size_label') as string;
    const thickness = formData.get('thickness') as string;

    // Promo & Features
    const promotional_price = parseFloat(formData.get('promotional_price') as string) || null;
    const promo_min_quantity = parseInt(formData.get('promo_min_quantity') as string) || 1;
    const is_featured = formData.get('is_featured') === 'on';

    const { error } = await supabaseAdmin
        .from('products')
        .update({
            name,
            sku,
            price,
            stock_quantity,
            description,
            image_url,
            image_urls,
            is_active,
            width, length, height, weight, color, size_label, thickness,
            promotional_price, promo_min_quantity, is_featured
        })
        .eq('id', id);

    if (error) {
        console.error(error);
        throw new Error(error.message);
    }

    // Sync price to bundles with matching name
    // Find bundles that contain this product name
    const { data: matchingBundles } = await supabaseAdmin
        .from('bundles')
        .select('id, name')
        .ilike('name', `%${name}%`);

    if (matchingBundles && matchingBundles.length > 0) {
        // Update bundles with exact name match
        const exactMatch = matchingBundles.find(b =>
            b.name.toLowerCase().trim() === name.toLowerCase().trim()
        );

        if (exactMatch) {
            await supabaseAdmin
                .from('bundles')
                .update({
                    price,
                    description: description || undefined,
                    image_urls: image_urls.length > 0 ? image_urls : undefined
                })
                .eq('id', exactMatch.id);

            console.log(`Synced price ฿${price} to bundle: ${exactMatch.name}`);
        }
    }

    revalidatePath('/admin/products');
    revalidatePath('/admin/bundles');
    revalidatePath('/');
    redirect('/admin/products?toast=success&message=' + encodeURIComponent('บันทึกการแก้ไขสินค้าสำเร็จ'));
}

export async function deleteProduct(id: number) {
    const { error } = await supabaseAdmin
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        console.error(error);
        throw new Error(error.message);
    }
    revalidatePath('/admin/products');
}
