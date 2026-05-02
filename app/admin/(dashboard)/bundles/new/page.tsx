import { supabase } from '@/lib/supabaseClient';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import BundleForm from '../BundleForm';

export const dynamic = 'force-dynamic';

export default async function NewBundlePage() {
    // Fetch dependencies
    const { data: categories } = await supabase.from('categories').select('id, name');
    const { data: products } = await supabase.from('products').select('id, name, price, width, length, height, dimension_unit');

    return (
        <div className="space-y-6 pb-20">
            <AdminPageHeader
                title="เพิ่มชุดสินค้า"
                description="สร้างชุดสินค้า (Bundle) ใหม่"
                titleLeft={<span aria-hidden>🛒️</span>}
            />
            <BundleForm
                categories={categories || []}
                products={products || []}
            />
        </div>
    );
}
