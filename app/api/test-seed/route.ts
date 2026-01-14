import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { NextResponse } from 'next/server';

export async function GET() {
    const urls = [
        'https://placehold.co/600x400/252f3f/white?text=Main+Angle',
        'https://placehold.co/600x400/252f3f/white?text=Side+View',
        'https://placehold.co/600x400/252f3f/white?text=Top+View',
        'https://placehold.co/600x400/252f3f/white?text=Inside',
        'https://placehold.co/600x400/252f3f/white?text=Dimension'
    ];

    // 1. Update Product
    const { data: product, error: prodError } = await supabaseAdmin
        .from('products')
        .update({ image_urls: urls })
        .eq('name', 'Test Product (สินค้าทดสอบ)')
        .select();

    // 2. Update Bundle (so it shows on Shop)
    const { data: bundle, error: bundleError } = await supabaseAdmin
        .from('bundles')
        .update({ image_urls: urls })
        .eq('slug', 'test-bundle-set')
        .select();

    return NextResponse.json({
        success: true,
        product,
        bundle,
        errors: { prodError, bundleError }
    });
}
