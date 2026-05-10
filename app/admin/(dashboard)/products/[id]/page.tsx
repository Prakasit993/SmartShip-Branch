import { Pencil } from 'lucide-react';
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
        <div className="mx-auto max-w-3xl space-y-6 pb-20">
            <AdminPageHeader
                title="แก้ไขสินค้า"
                description={product.name}
                tone="dark"
                titleLeft={
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
                        <Pencil className="h-5 w-5" aria-hidden />
                    </span>
                }
                meta={
                    <span className="rounded-full bg-slate-600/40 px-2.5 py-0.5 text-xs font-semibold text-slate-200 ring-1 ring-white/10">
                        SKU {product.sku || '—'}
                    </span>
                }
            />
            <ProductForm product={product} />
        </div>
    );
}
