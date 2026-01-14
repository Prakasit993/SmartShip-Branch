'use client';

import { useState } from 'react';
import { BundleInput, createBundle, updateBundle } from './actions';
import { useRouter } from 'next/navigation';

type Product = { id: number; name: string; price: number };
type Category = { id: number; name: string };

interface BundleFormProps {
    initialData?: BundleInput;
    categories: Category[];
    products: Product[];
}

export default function BundleForm({ initialData, categories, products }: BundleFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<BundleInput>(initialData || {
        name: '',
        slug: '',
        price: 0,
        type: 'fixed',
        category_id: categories[0]?.id || 0,
        image_urls: [],
        is_active: true,
        items: [],
        option_groups: []
    });

    const handleChange = (field: keyof BundleInput, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleCreate = async () => {
        setLoading(true);
        const res = await createBundle(formData);
        if (res?.error) alert(res.error);
        else router.push('/admin/bundles');
        setLoading(false);
    };

    const handleUpdate = async () => {
        setLoading(true);
        const res = await updateBundle(formData);
        if (res?.error) alert(res.error);
        else router.push('/admin/bundles');
        setLoading(false);
    };

    // Fixed Items Handlers
    const addFixedItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...(prev.items || []), { product_id: products[0]?.id, quantity: 1 }]
        }));
    };

    const removeFixedItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items?.filter((_, i) => i !== index)
        }));
    };

    const updateFixedItem = (index: number, field: 'product_id' | 'quantity', value: number) => {
        const newItems = [...(formData.items || [])];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    // Configurable Handlers
    const addGroup = () => {
        setFormData(prev => ({
            ...prev,
            option_groups: [...(prev.option_groups || []), { name: '', sort_order: 0, options: [] }]
        }));
    };

    const updateGroup = (groupIndex: number, field: string, value: any) => {
        const newGroups = [...(formData.option_groups || [])];
        // @ts-ignore
        newGroups[groupIndex][field] = value;
        setFormData(prev => ({ ...prev, option_groups: newGroups }));
    };

    const removeGroup = (index: number) => {
        setFormData(prev => ({ ...prev, option_groups: prev.option_groups?.filter((_, i) => i !== index) }));
    };

    const addOptionToGroup = (groupIndex: number) => {
        const newGroups = [...(formData.option_groups || [])];
        newGroups[groupIndex].options.push({
            product_id: products[0]?.id,
            name: '',
            price_modifier: 0,
            sort_order: 0
        });
        setFormData(prev => ({ ...prev, option_groups: newGroups }));
    };

    const updateOption = (groupIndex: number, optIndex: number, field: string, value: any) => {
        const newGroups = [...(formData.option_groups || [])];
        // @ts-ignore
        newGroups[groupIndex].options[optIndex][field] = value;
        setFormData(prev => ({ ...prev, option_groups: newGroups }));
    };

    const removeOption = (groupIndex: number, optIndex: number) => {
        const newGroups = [...(formData.option_groups || [])];
        newGroups[groupIndex].options = newGroups[groupIndex].options.filter((_, i) => i !== optIndex);
        setFormData(prev => ({ ...prev, option_groups: newGroups }));
    };

    return (
        <div className="space-y-8 bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Bundle Name</label>
                    <input
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Slug</label>
                    <input
                        value={formData.slug}
                        onChange={(e) => handleChange('slug', e.target.value)}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Price (฿)</label>
                    <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleChange('price', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select
                        value={formData.category_id ?? ''}
                        onChange={(e) => handleChange('category_id', parseInt(e.target.value))}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    >
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                        value={formData.type}
                        onChange={(e) => handleChange('type', e.target.value)}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    >
                        <option value="fixed">Fixed Set</option>
                        <option value="configurable">Configurable</option>
                    </select>
                    <p className="text-xs text-zinc-500 mt-1">Fixed: Predefined items. Configurable: User chooses from options.</p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Image URL</label>
                    <input
                        value={formData.image_urls?.[0] || ''}
                        onChange={(e) => handleChange('image_urls', [e.target.value])}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>
            </div>

            <hr className="dark:border-zinc-800" />

            {/* Dynamic Sections Based on Type */}
            {formData.type === 'fixed' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Included Items</h3>
                        <button type="button" onClick={addFixedItem} className="text-sm text-blue-600 hover:underline">+ Add Item</button>
                    </div>
                    {formData.items?.map((item, idx) => (
                        <div key={idx} className="flex gap-4 mb-2 items-center">
                            <select
                                className="flex-1 px-3 py-2 border rounded dark:bg-black dark:border-zinc-700"
                                value={item.product_id}
                                onChange={(e) => updateFixedItem(idx, 'product_id', parseInt(e.target.value))}
                            >
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input
                                type="number"
                                className="w-24 px-3 py-2 border rounded dark:bg-black dark:border-zinc-700"
                                value={item.quantity}
                                onChange={(e) => updateFixedItem(idx, 'quantity', parseInt(e.target.value))}
                                placeholder="Qty"
                            />
                            <button type="button" onClick={() => removeFixedItem(idx)} className="text-red-500">X</button>
                        </div>
                    ))}
                </div>
            )}

            {formData.type === 'configurable' && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Option Groups</h3>
                        <button type="button" onClick={addGroup} className="text-sm text-blue-600 hover:underline">+ Add Group</button>
                    </div>
                    {formData.option_groups?.map((group, gIdx) => (
                        <div key={gIdx} className="border dark:border-zinc-800 p-4 rounded mb-4 bg-zinc-50 dark:bg-zinc-800/50">
                            <div className="flex gap-4 mb-2">
                                <input
                                    placeholder="Group Name (e.g. Box Size)"
                                    className="flex-1 px-3 py-2 border rounded dark:bg-black dark:border-zinc-700"
                                    value={group.name}
                                    onChange={(e) => updateGroup(gIdx, 'name', e.target.value)}
                                />
                                <input
                                    placeholder="Sort"
                                    type="number"
                                    className="w-20 px-3 py-2 border rounded dark:bg-black dark:border-zinc-700"
                                    value={group.sort_order}
                                    onChange={(e) => updateGroup(gIdx, 'sort_order', parseInt(e.target.value))}
                                />
                                <button type="button" onClick={() => removeGroup(gIdx)} className="text-red-500">Remove Group</button>
                            </div>

                            {/* Options inside group */}
                            <div className="ml-4 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-medium">Options</h4>
                                    <button type="button" onClick={() => addOptionToGroup(gIdx)} className="text-xs text-blue-600">+ Add Option</button>
                                </div>
                                {group.options?.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex gap-2 mb-2 items-center">
                                        <select
                                            className="flex-1 px-2 py-1 text-sm border rounded dark:bg-black dark:border-zinc-700"
                                            value={opt.product_id}
                                            onChange={(e) => updateOption(gIdx, oIdx, 'product_id', parseInt(e.target.value))}
                                        >
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <input
                                            placeholder="Name Override"
                                            className="flex-1 px-2 py-1 text-sm border rounded dark:bg-black dark:border-zinc-700"
                                            value={opt.name || ''}
                                            onChange={(e) => updateOption(gIdx, oIdx, 'name', e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            placeholder="+ Price"
                                            className="w-20 px-2 py-1 text-sm border rounded dark:bg-black dark:border-zinc-700"
                                            value={opt.price_modifier}
                                            onChange={(e) => updateOption(gIdx, oIdx, 'price_modifier', parseFloat(e.target.value))}
                                        />
                                        <button type="button" onClick={() => removeOption(gIdx, oIdx)} className="text-red-500 text-xs">X</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    disabled={loading}
                    onClick={() => router.back()}
                    className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={loading}
                    onClick={formData.id ? handleUpdate : handleCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    {loading ? 'Saving...' : (formData.id ? 'Update Bundle' : 'Create Bundle')}
                </button>
            </div>
        </div>
    );
}
