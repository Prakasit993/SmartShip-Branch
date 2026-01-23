import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

// POST /api/admin/sync-bundle-dimensions
// Syncs dimensions from the first product in each bundle
export async function POST(req: NextRequest) {
    try {
        // First, get all bundles that have items but missing dimensions
        const { data: bundles, error: bundlesError } = await supabaseAdmin
            .from('bundles')
            .select('id, name, width_cm, length_cm, height_cm');

        if (bundlesError) {
            return NextResponse.json({ error: bundlesError.message }, { status: 500 });
        }

        const bundlesToUpdate: number[] = [];
        const results: { id: number; name: string; synced: boolean; dimensions?: string }[] = [];

        for (const bundle of bundles || []) {
            // Skip if already has dimensions
            if (bundle.width_cm && bundle.length_cm && bundle.height_cm) {
                results.push({ id: bundle.id, name: bundle.name, synced: false, dimensions: `${bundle.width_cm}x${bundle.length_cm}x${bundle.height_cm}` });
                continue;
            }

            // Get first product from bundle_items
            const { data: items } = await supabaseAdmin
                .from('bundle_items')
                .select('product_id, products(width, length, height)')
                .eq('bundle_id', bundle.id)
                .limit(1);

            if (items && items.length > 0 && items[0].products) {
                const product = items[0].products as any;
                if (product.width && product.length && product.height) {
                    // Update bundle with product dimensions
                    await supabaseAdmin
                        .from('bundles')
                        .update({
                            width_cm: product.width,
                            length_cm: product.length,
                            height_cm: product.height
                        })
                        .eq('id', bundle.id);

                    results.push({
                        id: bundle.id,
                        name: bundle.name,
                        synced: true,
                        dimensions: `${product.width}x${product.length}x${product.height}`
                    });
                    bundlesToUpdate.push(bundle.id);
                } else {
                    results.push({ id: bundle.id, name: bundle.name, synced: false });
                }
            } else {
                results.push({ id: bundle.id, name: bundle.name, synced: false });
            }
        }

        return NextResponse.json({
            success: true,
            updated: bundlesToUpdate.length,
            total: bundles?.length || 0,
            results
        });
    } catch (error: any) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
