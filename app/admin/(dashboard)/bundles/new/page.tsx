import { supabase } from '@/lib/supabaseClient';
import BundleForm from '../BundleForm';

export const dynamic = 'force-dynamic';

export default async function NewBundlePage() {
    // Fetch dependencies
    const { data: categories } = await supabase.from('categories').select('id, name');
    const { data: products } = await supabase.from('products').select('id, name, price');

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Create Bundle</h1>
            <BundleForm
                categories={categories || []}
                products={products || []}
            />
        </div>
    );
}
