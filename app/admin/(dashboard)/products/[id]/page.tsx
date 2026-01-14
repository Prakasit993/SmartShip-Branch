import { supabase } from '@/lib/supabaseClient';
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
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Edit Product</h1>
            <ProductForm product={product} />
        </div>
    );
}
