'use client';

import { createProduct, updateProduct } from '../actions';
import { useFormStatus } from 'react-dom';

interface ProductFormProps {
    product?: any; // If provided, it's an Edit form
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
            {pending ? 'Saving...' : label}
        </button>
    );
}

export default function ProductForm({ product }: ProductFormProps) {
    // If product exists, we bind the update action with ID. Otherwise, create action.
    const action = product ? updateProduct.bind(null, product.id) : createProduct;

    return (
        <form action={action} className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-lg shadow border border-zinc-200 dark:border-zinc-800">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Product Name</label>
                    <input
                        name="name"
                        defaultValue={product?.name}
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                        placeholder="e.g. Red Tape"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">SKU</label>
                    <input
                        name="sku"
                        defaultValue={product?.sku || ''}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                        placeholder="PROD-001"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Price (฿)</label>
                    <input
                        name="price"
                        type="number"
                        step="0.01"
                        required
                        defaultValue={product?.price}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                        placeholder="0.00"
                    />
                </div>
            </div>

            {/* Inventory */}
            <div>
                <label className="block text-sm font-medium mb-1">Stock Quantity</label>
                <input
                    name="stock_quantity"
                    type="number"
                    defaultValue={product?.stock_quantity || 0}
                    className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                />
            </div>

            {/* Dimensions & Specs (NEW) */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-zinc-100">Physical Specification</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">Width (cm)</label>
                        <input
                            name="width"
                            type="number"
                            step="0.01"
                            defaultValue={product?.width || 0}
                            className="w-full px-3 py-2 border rounded-md dark:bg-black dark:border-zinc-700 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">Length (cm)</label>
                        <input
                            name="length"
                            type="number"
                            step="0.01"
                            defaultValue={product?.length || 0}
                            className="w-full px-3 py-2 border rounded-md dark:bg-black dark:border-zinc-700 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">Height (cm)</label>
                        <input
                            name="height"
                            type="number"
                            step="0.01"
                            defaultValue={product?.height || 0}
                            className="w-full px-3 py-2 border rounded-md dark:bg-black dark:border-zinc-700 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">Weight (kg)</label>
                        <input
                            name="weight"
                            type="number"
                            step="0.01"
                            defaultValue={product?.weight || 0}
                            className="w-full px-3 py-2 border rounded-md dark:bg-black dark:border-zinc-700 text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Color</label>
                        <input
                            name="color"
                            defaultValue={product?.color || ''}
                            className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                            placeholder="e.g. Brown, White"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Size Label</label>
                        <input
                            name="size_label"
                            defaultValue={product?.size_label || ''}
                            className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                            placeholder="e.g. Box 2A"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Thickness</label>
                        <input
                            name="thickness"
                            defaultValue={product?.thickness || ''}
                            className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                            placeholder="e.g. 3-ply, 5mm"
                        />
                    </div>
                </div>
            </div>

            {/* Marketing & Promotion */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-zinc-100">Marketing & Promotion</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Promotional Price</label>
                        <input
                            name="promotional_price"
                            type="number"
                            step="0.01"
                            defaultValue={product?.promotional_price || ''}
                            className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                            placeholder="Optional"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Min Qty for Promo</label>
                        <input
                            name="promo_min_quantity"
                            type="number"
                            defaultValue={product?.promo_min_quantity || 1}
                            className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                        />
                    </div>
                    <div className="flex items-end pb-3">
                        <div className="flex items-center gap-2">
                            <input
                                name="is_featured"
                                type="checkbox"
                                defaultChecked={product?.is_featured || false}
                                id="is_featured"
                                className="w-5 h-5 accent-blue-600"
                            />
                            <label htmlFor="is_featured" className="text-sm font-medium cursor-pointer">Featured Product (Hot)</label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Media & Details */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Product Images (Max 5)</label>
                    <div className="space-y-3">
                        {[0, 1, 2, 3, 4].map((index) => (
                            <div key={index} className="flex gap-3">
                                <span className="text-zinc-400 py-2 text-sm w-6 text-center">{index + 1}.</span>
                                <input
                                    name="image_urls"
                                    defaultValue={product?.image_urls?.[index] || product?.image_url || ''}
                                    className="flex-1 px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700 text-sm"
                                    placeholder={index === 0 ? "Main Image URL" : "Additional Image URL"}
                                />
                            </div>
                        ))}
                        <p className="text-xs text-zinc-500 pl-9">Leave empty if not used.</p>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                        name="description"
                        rows={3}
                        defaultValue={product?.description || ''}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        name="is_active"
                        type="checkbox"
                        defaultChecked={product?.is_active ?? true}
                        id="is_active"
                        className="w-4 h-4"
                    />
                    <label htmlFor="is_active">Active</label>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded"
                >
                    Cancel
                </button>
                <SubmitButton label={product ? 'Update Product' : 'Create Product'} />
            </div>
        </form>
    );
}
