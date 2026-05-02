'use client';

import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import ProductForm from '../_components/ProductForm';

export default function NewProductPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            <AdminPageHeader
                title="เพิ่มสินค้า"
                description="สร้างรายการสินค้าใหม่ในร้าน"
                titleLeft={<span aria-hidden>📦</span>}
            />
            <ProductForm />
        </div>
    );
}
