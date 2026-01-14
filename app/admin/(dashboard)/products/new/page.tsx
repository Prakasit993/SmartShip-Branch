'use client';

import ProductForm from '../_components/ProductForm';

export default function NewProductPage() {
    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Add New Product</h1>
            <ProductForm />
        </div>
    );
}
