import { supabase } from '@/lib/supabaseClient';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { notFound } from 'next/navigation';
import ProductForm from '../_components/ProductForm';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !product) {
        notFound();
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            <AdminPageHeader
                title="แก้ไขสินค้า"
                description={product.name}
                titleLeft={<span aria-hidden>✏️</span>}
            />
            <ProductForm product={product} />
        </div>
    );
}
