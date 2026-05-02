import { supabase } from '@/lib/supabaseClient';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import BundleForm from '../BundleForm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EditBundlePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch bundle with relations
    const { data: bundle } = await supabase.from('bundles').select('*').eq('id', id).single();

    if (!bundle) notFound();

    // Fetch relations based on type
    let items = [];
    let option_groups = [];

    if (bundle.type === 'fixed') {
        const { data } = await supabase.from('bundle_items').select('*').eq('bundle_id', id);
        items = data || [];
    } else if (bundle.type === 'configurable') {
        const { data: groups } = await supabase
            .from('bundle_option_groups')
            .select(`
            *,
            options:bundle_options(*)
        `)
            .eq('bundle_id', id)
            .order('sort_order');
        option_groups = groups || [];
    }

    // Fetch dependencies
    const { data: categories } = await supabase.from('categories').select('id, name');
    const { data: products } = await supabase.from('products').select('id, name, price, width, length, height, dimension_unit');

    const initialData = {
        ...bundle,
        items,
        option_groups
    };

    return (
        <div className="space-y-6 pb-20">
            <AdminPageHeader
                title="แก้ไขชุดสินค้า"
                description={bundle.name}
                titleLeft={<span aria-hidden>✏️</span>}
            />
            <BundleForm
                categories={categories || []}
                products={products || []}
                initialData={initialData}
            />
        </div>
    );
}
