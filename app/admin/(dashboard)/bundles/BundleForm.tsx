'use client';

import { useState, useRef } from 'react';
import { BundleInput, createBundle, updateBundle } from './actions';
import { useRouter } from 'next/navigation';
import {
    ADMIN_PRODUCT_IMAGE_ACCEPT,
    ADMIN_PRODUCT_IMAGE_HELP_TH,
    PRODUCT_IMAGE_MAX_BYTES,
    resolveProductImageMime,
} from '@/lib/adminProductImageUpload';

type Product = { id: number; name: string; price: number; width?: number; length?: number; height?: number; dimension_unit?: string };
type Category = { id: number; name: string };

interface BundleFormProps {
    initialData?: BundleInput;
    categories: Category[];
    products: Product[];
}

export default function BundleForm({ initialData, categories, products }: BundleFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        try {
            await createBundle(formData);
            router.push('/admin/bundles');
        } catch (err: any) {
            alert(err.message || 'สร้างชุดสินค้าไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        setLoading(true);
        try {
            await updateBundle(formData);
            router.push('/admin/bundles');
        } catch (err: any) {
            alert(err.message || 'อัพเดตไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    // Image upload handler
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const mime = resolveProductImageMime(file);
        if (!mime) {
            alert(ADMIN_PRODUCT_IMAGE_HELP_TH);
            e.target.value = '';
            return;
        }
        if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
            alert('ไฟล์ใหญ่เกินไป (สูงสุด 5 MB)');
            e.target.value = '';
            return;
        }

        setUploadingImage(true);
        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);

            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formDataUpload,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            handleChange('image_urls', [data.url]);
        } catch (err: any) {
            alert('อัพโหลดไม่สำเร็จ: ' + err.message);
        } finally {
            setUploadingImage(false);
        }
    };

    // Sync dimensions from first product in items
    const syncDimensionsFromProduct = () => {
        const firstItem = formData.items?.[0];
        if (!firstItem) {
            alert('กรุณาเพิ่มสินค้าในชุดก่อน');
            return;
        }
        const product = products.find(p => p.id === firstItem.product_id);
        if (product) {
            setFormData(prev => ({
                ...prev,
                width_cm: product.width || prev.width_cm,
                length_cm: product.length || prev.length_cm,
                height_cm: product.height || prev.height_cm
            }));
        }
    };

    // Fixed Items Handlers
    const addFixedItem = () => {
        const isFirstItem = !formData.items || formData.items.length === 0;
        const newProductId = products[0]?.id;

        setFormData(prev => {
            const updated = {
                ...prev,
                items: [...(prev.items || []), { product_id: newProductId, quantity: 1 }]
            };

            // Auto-sync dimensions if this is the first item and dimensions are empty
            if (isFirstItem && (!prev.width_cm && !prev.length_cm && !prev.height_cm)) {
                const product = products.find(p => p.id === newProductId);
                if (product) {
                    updated.width_cm = product.width;
                    updated.length_cm = product.length;
                    updated.height_cm = product.height;
                }
            }

            return updated;
        });
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
        <div className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-4xl mx-auto">
            {/* Header */}
            <div className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="text-xl font-bold">🛍️ {formData.id ? 'แก้ไขชุดสินค้า' : 'เพิ่มชุดสินค้าใหม่'}</h2>
                <p className="text-sm text-zinc-500">กรอกข้อมูลชุดสินค้าให้ครบถ้วน</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">🏷️ ชื่อชุดสินค้า</label>
                    <input
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="เช่น ชุดกล่อง A3 พร้อมเทป"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">🔗 Slug (URL)</label>
                    <input
                        value={formData.slug}
                        onChange={(e) => handleChange('slug', e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="box-a3-set"
                    />
                    <p className="text-xs text-zinc-500 mt-1">ใช้เป็น URL ของสินค้า ไม่ต้องมีช่องว่าง</p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">💰 ราคา (บาท)</label>
                    <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => handleChange('price', parseFloat(e.target.value))}
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">📂 หมวดหมู่</label>
                    <select
                        value={formData.category_id ?? ''}
                        onChange={(e) => handleChange('category_id', parseInt(e.target.value))}
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="">-- เลือกหมวดหมู่ --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">📦 ประเภท</label>
                    <select
                        value={formData.type}
                        onChange={(e) => handleChange('type', e.target.value)}
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="fixed">📦 แบบตายตัว (Fixed)</option>
                        <option value="configurable">⚙️ แบบเลือกได้ (Configurable)</option>
                    </select>
                    <p className="text-xs text-zinc-500 mt-1">
                        {formData.type === 'fixed' ? '📦 สินค้าในชุดกำหนดไว้แล้ว' : '⚙️ ลูกค้าเลือกตัวเลือกได้'}
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">🖼️ รูปภาพ</label>
                    <p className="text-xs text-zinc-500 mb-2">{ADMIN_PRODUCT_IMAGE_HELP_TH}</p>
                    <div className="flex gap-2">
                        <input
                            value={formData.image_urls?.[0] || ''}
                            onChange={(e) => handleChange('image_urls', [e.target.value])}
                            className="flex-1 px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="URL รูปภาพ"
                        />
                        <label className="cursor-pointer">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ADMIN_PRODUCT_IMAGE_ACCEPT}
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                            <span className={`inline-flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${uploadingImage
                                ? 'bg-zinc-300 text-zinc-500'
                                : 'bg-green-600 text-white hover:bg-green-700'
                                }`}>
                                {uploadingImage ? '⏳ ...' : '📷'}
                            </span>
                        </label>
                    </div>
                    {formData.image_urls?.[0] && (
                        <img
                            src={formData.image_urls[0]}
                            alt="Preview"
                            className="mt-2 w-20 h-20 object-cover rounded-lg border"
                            loading="lazy"
                            decoding="async"
                        />
                    )}
                </div>

                {/* SKU & Dimensions */}
                <div className="col-span-full bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">📐 ขนาดสำหรับค้นหา</span>
                        {formData.type === 'fixed' && formData.items && formData.items.length > 0 && (
                            <button
                                type="button"
                                onClick={syncDimensionsFromProduct}
                                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1"
                            >
                                🔄 ดึงขนาดจากสินค้า
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium mb-1">🔖 SKU (รหัส)</label>
                            <input
                                value={formData.sku || ''}
                                onChange={(e) => handleChange('sku', e.target.value)}
                                className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="A-001"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">↔ กว้าง (ซม.)</label>
                            <input
                                type="number"
                                value={formData.width_cm || ''}
                                onChange={(e) => handleChange('width_cm', parseFloat(e.target.value))}
                                className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-green-500 outline-none"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">↕ ยาว (ซม.)</label>
                            <input
                                type="number"
                                value={formData.length_cm || ''}
                                onChange={(e) => handleChange('length_cm', parseFloat(e.target.value))}
                                className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-purple-500 outline-none"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">↥ สูง (ซม.)</label>
                            <input
                                type="number"
                                value={formData.height_cm || ''}
                                onChange={(e) => handleChange('height_cm', parseFloat(e.target.value))}
                                className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">⚖️ น้ำหนัก (กรัม)</label>
                            <input
                                type="number"
                                value={formData.weight_g || ''}
                                onChange={(e) => handleChange('weight_g', parseFloat(e.target.value))}
                                className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <hr className="dark:border-zinc-800" />

            {/* Fixed Bundle Items */}
            {formData.type === 'fixed' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-lg font-semibold">📦 สินค้าในชุด</h3>
                            <p className="text-xs text-zinc-500">เลือกสินค้าและจำนวนที่รวมในชุดนี้</p>
                        </div>
                        <button type="button" onClick={addFixedItem} className="text-sm text-blue-600 hover:underline font-medium">
                            ➕ เพิ่มสินค้า
                        </button>
                    </div>
                    {formData.items?.length === 0 && (
                        <p className="text-zinc-500 text-sm text-center py-4">ยังไม่มีสินค้าในชุด กดปุ่ม "เพิ่มสินค้า" เพื่อเริ่มต้น</p>
                    )}
                    {formData.items?.map((item, idx) => (
                        <div key={idx} className="flex gap-3 mb-2 items-center">
                            <select
                                className="flex-1 px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700"
                                value={item.product_id}
                                onChange={(e) => updateFixedItem(idx, 'product_id', parseInt(e.target.value))}
                            >
                                {products.map(p => <option key={p.id} value={p.id}>{p.name} (฿{p.price})</option>)}
                            </select>
                            <input
                                type="number"
                                className="w-20 px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 text-center"
                                value={item.quantity}
                                onChange={(e) => updateFixedItem(idx, 'quantity', parseInt(e.target.value))}
                                min={1}
                            />
                            <span className="text-xs text-zinc-500">ชิ้น</span>
                            <button type="button" onClick={() => removeFixedItem(idx)} className="text-red-500 hover:bg-red-100 px-2 py-1 rounded">✕</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Configurable Options */}
            {formData.type === 'configurable' && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-lg font-semibold">⚙️ กลุ่มตัวเลือก</h3>
                            <p className="text-xs text-zinc-500">สร้างกลุ่มตัวเลือกให้ลูกค้าเลือก เช่น ขนาดกล่อง, สีเทป</p>
                        </div>
                        <button type="button" onClick={addGroup} className="text-sm text-purple-600 hover:underline font-medium">
                            ➕ เพิ่มกลุ่ม
                        </button>
                    </div>
                    {formData.option_groups?.map((group, gIdx) => (
                        <div key={gIdx} className="border dark:border-zinc-700 p-4 rounded-xl mb-4 bg-white dark:bg-zinc-800/50">
                            <div className="flex gap-3 mb-3">
                                <input
                                    placeholder="ชื่อกลุ่ม เช่น ขนาดกล่อง"
                                    className="flex-1 px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700"
                                    value={group.name}
                                    onChange={(e) => updateGroup(gIdx, 'name', e.target.value)}
                                />
                                <input
                                    placeholder="ลำดับ"
                                    type="number"
                                    className="w-16 px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 text-center"
                                    value={group.sort_order}
                                    onChange={(e) => updateGroup(gIdx, 'sort_order', parseInt(e.target.value))}
                                />
                                <button type="button" onClick={() => removeGroup(gIdx)} className="text-red-500 text-sm hover:underline">ลบกลุ่ม</button>
                            </div>

                            {/* Options inside group */}
                            <div className="ml-4 pl-4 border-l-2 border-purple-200 dark:border-purple-700">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-medium">📋 ตัวเลือกในกลุ่ม</h4>
                                    <button type="button" onClick={() => addOptionToGroup(gIdx)} className="text-xs text-purple-600 hover:underline">➕ เพิ่มตัวเลือก</button>
                                </div>
                                {group.options?.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex gap-2 mb-2 items-center">
                                        <select
                                            className="flex-1 px-2 py-1.5 text-sm border rounded-lg dark:bg-black dark:border-zinc-700"
                                            value={opt.product_id}
                                            onChange={(e) => updateOption(gIdx, oIdx, 'product_id', parseInt(e.target.value))}
                                        >
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <input
                                            placeholder="ชื่อแสดง"
                                            className="flex-1 px-2 py-1.5 text-sm border rounded-lg dark:bg-black dark:border-zinc-700"
                                            value={opt.name || ''}
                                            onChange={(e) => updateOption(gIdx, oIdx, 'name', e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            placeholder="+฿"
                                            className="w-16 px-2 py-1.5 text-sm border rounded-lg dark:bg-black dark:border-zinc-700 text-center"
                                            value={opt.price_modifier}
                                            onChange={(e) => updateOption(gIdx, oIdx, 'price_modifier', parseFloat(e.target.value))}
                                        />
                                        <button type="button" onClick={() => removeOption(gIdx, oIdx)} className="text-red-500 text-xs">✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                    type="button"
                    disabled={loading}
                    onClick={() => router.back()}
                    className="px-6 py-2.5 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition font-medium"
                >
                    ← ยกเลิก
                </button>
                <button
                    type="button"
                    disabled={loading}
                    onClick={formData.id ? handleUpdate : handleCreate}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
                >
                    {loading ? '⏳ กำลังบันทึก...' : (formData.id ? '💾 บันทึกการแก้ไข' : '➕ สร้างชุดสินค้า')}
                </button>
            </div>
        </div>
    );
}
