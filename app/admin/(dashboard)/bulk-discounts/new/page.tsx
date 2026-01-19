'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewBulkDiscountPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: '',
        description: '',
        min_quantity: 2,
        discount_type: 'percentage' as 'percentage' | 'fixed_per_item' | 'fixed_total',
        discount_value: 10,
        applies_to: 'all' as 'all' | 'category' | 'bundle',
        target_id: '',
        is_active: true,
        starts_at: '',
        expires_at: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/admin/bulk-discounts/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    target_id: form.target_id ? parseInt(form.target_id) : null,
                    starts_at: form.starts_at || null,
                    expires_at: form.expires_at || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create discount');
            }

            router.push('/admin/bulk-discounts');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/bulk-discounts"
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
                >
                    ←
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        เพิ่มส่วนลดซื้อเยอะ
                    </h1>
                    <p className="text-sm text-zinc-500">สร้างส่วนลดใหม่เมื่อซื้อครบจำนวน</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        ชื่อส่วนลด *
                    </label>
                    <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="เช่น ซื้อ 5 ลด 10%"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        รายละเอียด
                    </label>
                    <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                    />
                </div>

                {/* Min Quantity */}
                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        จำนวนขั้นต่ำ *
                    </label>
                    <input
                        type="number"
                        required
                        min={2}
                        value={form.min_quantity}
                        onChange={(e) => setForm({ ...form, min_quantity: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Discount Type & Value */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            ประเภทส่วนลด *
                        </label>
                        <select
                            value={form.discount_type}
                            onChange={(e) => setForm({ ...form, discount_type: e.target.value as typeof form.discount_type })}
                            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="percentage">ลดเป็น %</option>
                            <option value="fixed_per_item">ลดต่อชิ้น (บาท)</option>
                            <option value="fixed_total">ลดรวม (บาท)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                            จำนวนส่วนลด *
                        </label>
                        <input
                            type="number"
                            required
                            min={1}
                            value={form.discount_value}
                            onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) })}
                            className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Applies To */}
                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                        ใช้กับ *
                    </label>
                    <select
                        value={form.applies_to}
                        onChange={(e) => setForm({ ...form, applies_to: e.target.value as typeof form.applies_to })}
                        className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="all">ทุกสินค้า</option>
                        <option value="category">หมวดหมู่เฉพาะ</option>
                        <option value="bundle">สินค้าเฉพาะ</option>
                    </select>
                </div>

                {/* Is Active */}
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="is_active"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        เปิดใช้งานทันที
                    </label>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition"
                    >
                        {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                    <Link
                        href="/admin/bulk-discounts"
                        className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                    >
                        ยกเลิก
                    </Link>
                </div>
            </form>
        </div>
    );
}
