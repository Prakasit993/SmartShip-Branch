'use client';

import { PackagePlus } from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import ProductForm from '../_components/ProductForm';

export default function NewProductPage() {
    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-20">
            <AdminPageHeader
                title="เพิ่มสินค้า"
                description="สร้างรายการสินค้าใหม่ในร้าน — ตั้งค่า SEO ได้ในแท็บถัดไป"
                tone="dark"
                titleLeft={
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30">
                        <PackagePlus className="h-5 w-5" aria-hidden />
                    </span>
                }
            />
            <ProductForm />
        </div>
    );
}
