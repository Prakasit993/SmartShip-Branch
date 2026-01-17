'use client';

import { createProduct, updateProduct } from '../actions';
import { useFormStatus } from 'react-dom';
import { useState, useRef } from 'react';

interface ProductFormProps {
    product?: any; // If provided, it's an Edit form
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium transition"
        >
            {pending ? '⏳ กำลังบันทึก...' : label}
        </button>
    );
}

interface ImageUploadProps {
    index: number;
    defaultValue?: string;
    onUrlChange: (index: number, url: string) => void;
}

function ImageUpload({ index, defaultValue, onUrlChange }: ImageUploadProps) {
    const [url, setUrl] = useState(defaultValue || '');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'อัพโหลดไม่สำเร็จ');
            }

            setUrl(data.url);
            onUrlChange(index, data.url);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setUrl(newUrl);
        onUrlChange(index, newUrl);
    };

    const clearImage = () => {
        setUrl('');
        onUrlChange(index, '');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <span className="text-zinc-400 py-2 text-sm w-6 text-center">{index + 1}.</span>
                <div className="flex-1 space-y-2">
                    {/* URL Input */}
                    <div className="flex gap-2">
                        <input
                            name="image_urls"
                            value={url}
                            onChange={handleUrlChange}
                            className="flex-1 px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder={index === 0 ? "URL รูปหลัก หรือกดปุ่มอัพโหลด" : "URL รูปเพิ่มเติม"}
                        />

                        {/* Upload Button */}
                        <label className="cursor-pointer">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                                onChange={handleFileUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                            <span className={`inline-flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium transition ${uploading
                                    ? 'bg-zinc-300 text-zinc-500 cursor-wait'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}>
                                {uploading ? (
                                    <>⏳ กำลังอัพ...</>
                                ) : (
                                    <>📷 อัพโหลด</>
                                )}
                            </span>
                        </label>

                        {/* Clear Button */}
                        {url && (
                            <button
                                type="button"
                                onClick={clearImage}
                                className="px-3 py-2.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl text-sm font-medium transition"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Preview */}
                    {url && (
                        <div className="flex items-center gap-3 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                            <img
                                src={url}
                                alt={`รูปที่ ${index + 1}`}
                                className="w-16 h-16 object-cover rounded-lg border"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error';
                                }}
                            />
                            <span className="text-xs text-zinc-500 truncate flex-1">{url.substring(0, 50)}...</span>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <p className="text-red-500 text-xs">❌ {error}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ProductForm({ product }: ProductFormProps) {
    const action = product ? updateProduct.bind(null, product.id) : createProduct;

    // Track image URLs for proper form submission
    const [imageUrls, setImageUrls] = useState<string[]>(() => {
        const urls = product?.image_urls || [];
        // Ensure we have 5 slots
        return [...urls, ...Array(5 - urls.length).fill('')].slice(0, 5);
    });

    const handleImageUrlChange = (index: number, url: string) => {
        const newUrls = [...imageUrls];
        newUrls[index] = url;
        setImageUrls(newUrls);
    };

    return (
        <form action={action} className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow border border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="text-xl font-bold">📦 {product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
                <p className="text-sm text-zinc-500">กรอกข้อมูลสินค้าให้ครบถ้วน</p>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">🏷️ ชื่อสินค้า *</label>
                    <input
                        name="name"
                        defaultValue={product?.name}
                        required
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="เช่น กล่องไปรษณีย์ A3"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">📋 รหัสสินค้า (SKU)</label>
                    <input
                        name="sku"
                        defaultValue={product?.sku || ''}
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition"
                        placeholder="เช่น BOX-A3"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">💰 ราคา (บาท) *</label>
                    <input
                        name="price"
                        type="number"
                        step="0.01"
                        required
                        defaultValue={product?.price}
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition"
                        placeholder="0.00"
                    />
                </div>
            </div>

            {/* Inventory */}
            <div>
                <label className="block text-sm font-medium mb-1">📦 จำนวนในสต๊อก</label>
                <input
                    name="stock_quantity"
                    type="number"
                    defaultValue={product?.stock_quantity || 0}
                    className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
            </div>

            {/* Dimensions & Specs */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <h3 className="text-sm font-bold mb-4 text-zinc-900 dark:text-zinc-100">📐 ขนาดและสเปค</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">กว้าง (ซม.)</label>
                        <input
                            name="width"
                            type="number"
                            step="0.01"
                            defaultValue={product?.width || 0}
                            className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">ยาว (ซม.)</label>
                        <input
                            name="length"
                            type="number"
                            step="0.01"
                            defaultValue={product?.length || 0}
                            className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">สูง (ซม.)</label>
                        <input
                            name="height"
                            type="number"
                            step="0.01"
                            defaultValue={product?.height || 0}
                            className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500">น้ำหนัก (กก.)</label>
                        <input
                            name="weight"
                            type="number"
                            step="0.01"
                            defaultValue={product?.weight || 0}
                            className="w-full px-3 py-2 border rounded-xl dark:bg-black dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">🎨 สี</label>
                        <input
                            name="color"
                            defaultValue={product?.color || ''}
                            className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="เช่น น้ำตาล, ขาว"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">📏 ขนาด/รุ่น</label>
                        <input
                            name="size_label"
                            defaultValue={product?.size_label || ''}
                            className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="เช่น Box 2A, Size M"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">📄 ความหนา</label>
                        <input
                            name="thickness"
                            defaultValue={product?.thickness || ''}
                            className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="เช่น 3 ชั้น, 5mm"
                        />
                    </div>
                </div>
            </div>

            {/* Marketing & Promotion */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <h3 className="text-sm font-bold mb-2 text-zinc-900 dark:text-zinc-100">🔥 โปรโมชั่น</h3>
                <p className="text-xs text-zinc-500 mb-4">ตั้งราคาพิเศษ เมื่อซื้อจำนวนมาก</p>

                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-orange-800 dark:text-orange-300">💵 ราคาโปรโมชั่น (บาท)</label>
                            <input
                                name="promotional_price"
                                type="number"
                                step="0.01"
                                defaultValue={product?.promotional_price || ''}
                                className="w-full px-4 py-2.5 border-2 border-orange-300 dark:border-orange-700 rounded-xl dark:bg-black focus:ring-2 focus:ring-orange-500 outline-none"
                                placeholder="ไม่บังคับ"
                            />
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">ราคาที่ลดลงจากราคาปกติ</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-orange-800 dark:text-orange-300">🛒 ซื้อขั้นต่ำ (ชิ้น)</label>
                            <input
                                name="promo_min_quantity"
                                type="number"
                                min="1"
                                defaultValue={product?.promo_min_quantity || 1}
                                className="w-full px-4 py-2.5 border-2 border-orange-300 dark:border-orange-700 rounded-xl dark:bg-black focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">ต้องซื้อกี่ชิ้นถึงได้ราคานี้</p>
                        </div>
                        <div className="flex items-center pt-6">
                            <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 px-4 py-3 rounded-xl border border-orange-300 dark:border-orange-700">
                                <input
                                    name="is_featured"
                                    type="checkbox"
                                    defaultChecked={product?.is_featured || false}
                                    id="is_featured"
                                    className="w-5 h-5 accent-orange-600"
                                />
                                <label htmlFor="is_featured" className="text-sm font-medium cursor-pointer">
                                    🔥 สินค้าแนะนำ
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-sm">
                    <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">💡 ตัวอย่างการตั้งโปรโมชั่น:</p>
                    <ul className="text-blue-700 dark:text-blue-400 text-xs space-y-1 ml-4">
                        <li>• ราคาปกติ ฿100, ราคาโปร ฿80, ซื้อขั้นต่ำ 10 ชิ้น → ซื้อ 10 ชิ้นขึ้นไป ได้ราคา ฿80/ชิ้น</li>
                        <li>• ถ้าไม่ใส่ราคาโปร สินค้าจะขายราคาปกติ</li>
                    </ul>
                </div>
            </div>

            {/* Media & Details */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">🖼️ รูปสินค้า (สูงสุด 5 รูป)</label>
                    <p className="text-xs text-zinc-500 mb-3">อัพโหลดไฟล์ JPG, PNG, WebP หรือใส่ URL รูปภาพ</p>

                    <div className="space-y-4">
                        {[0, 1, 2, 3, 4].map((index) => (
                            <ImageUpload
                                key={index}
                                index={index}
                                defaultValue={imageUrls[index]}
                                onUrlChange={handleImageUrlChange}
                            />
                        ))}
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">📝 รายละเอียดสินค้า</label>
                    <textarea
                        name="description"
                        rows={3}
                        defaultValue={product?.description || ''}
                        className="w-full px-4 py-2.5 border rounded-xl dark:bg-black dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="อธิบายรายละเอียดสินค้า..."
                    />
                </div>

                <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 rounded-xl">
                    <input
                        name="is_active"
                        type="checkbox"
                        defaultChecked={product?.is_active ?? true}
                        id="is_active"
                        className="w-5 h-5 accent-green-600"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">✅ เปิดขายสินค้านี้</label>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="px-6 py-2.5 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition font-medium"
                >
                    ← ยกเลิก
                </button>
                <SubmitButton label={product ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มสินค้า'} />
            </div>
        </form>
    );
}
