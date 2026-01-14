import { supabase } from '@/lib/supabaseClient';
import { notFound } from 'next/navigation';
import BundleDetail from '@app/components/shop/BundleDetail';

export const dynamic = 'force-dynamic';

export default async function BundleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // 1. Fetch Bundle
    const { data: bundle } = await supabase
        .from('bundles')
        .select('*')
        .eq('slug', slug)
        .single();

    if (!bundle) notFound();

    // 2. Fetch Dependent Data
    let items = [];
    let optionGroups = [];

    if (bundle.type === 'fixed') {
        const { data } = await supabase
            .from('bundle_items')
            .select(`*, products(name, stock_quantity, width, length, height, dimension_unit, thickness, color, size_label)`)
            .eq('bundle_id', bundle.id);
        items = data || [];
    } else if (bundle.type === 'configurable') {
        const { data } = await supabase
            .from('bundle_option_groups')
            .select(`
             *,
             options:bundle_options(*)
        `)
            .eq('bundle_id', bundle.id)
            .order('sort_order');
        optionGroups = data || [];
    }
    // 3. Check Admin Role for "Edit" button
    const { data: { user } } = await supabase.auth.getUser();
    let isAdmin = false;
    if (user && user.email) {
        const adminEmail = process.env.ADMIN_EMAIL;
        const staffEmails = (process.env.STAFF_EMAILS || '').split(',').map(e => e.trim());
        if (user.email === adminEmail || staffEmails.includes(user.email)) {
            isAdmin = true;
        }
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <BundleDetail
                bundle={bundle}
                items={items}
                optionGroups={optionGroups}
                isAdmin={isAdmin}
            />
        </div>
    );
}
