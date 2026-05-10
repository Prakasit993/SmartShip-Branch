'use client';

import { AdminTablePanel } from '@app/admin/components/AdminTablePanel';
import Link from 'next/link';
import { useState } from 'react';

interface BulkDiscount {
    id: number;
    name: string;
    description: string | null;
    min_quantity: number;
    discount_type: 'percentage' | 'fixed_per_item' | 'fixed_total';
    discount_value: number;
    applies_to: 'all' | 'category' | 'bundle';
    target_id: number | null;
    is_active: boolean;
    starts_at: string | null;
    expires_at: string | null;
    created_at: string;
}

interface BulkDiscountListProps {
    discounts: BulkDiscount[];
}

export default function BulkDiscountList({ discounts }: BulkDiscountListProps) {
    const [items, setItems] = useState<BulkDiscount[]>(discounts);
    const [loading, setLoading] = useState<number | null>(null);

    const handleToggle = async (id: number) => {
        setLoading(id);
        try {
            const res = await fetch('/api/admin/bulk-discounts/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (res.ok) {
                setItems(items.map(item =>
                    item.id === id ? { ...item, is_active: !item.is_active } : item
                ));
            }
        } catch (err) {
            console.error('Error toggling discount:', err);
        } finally {
            setLoading(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('ต้องการลบส่วนลดนี้?')) return;

        setLoading(id);
        try {
            const res = await fetch('/api/admin/bulk-discounts/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            if (res.ok) {
                setItems(items.filter(item => item.id !== id));
            }
        } catch (err) {
            console.error('Error deleting discount:', err);
        } finally {
            setLoading(null);
        }
    };

    const getDiscountTypeLabel = (type: string) => {
        switch (type) {
            case 'percentage': return 'ลดเป็น %';
            case 'fixed_per_item': return 'ลดต่อชิ้น';
            case 'fixed_total': return 'ลดรวม';
            default: return type;
        }
    };

    const getAppliesToLabel = (appliesTo: string) => {
        switch (appliesTo) {
            case 'all': return 'ทุกสินค้า';
            case 'category': return 'หมวดหมู่';
            case 'bundle': return 'สินค้าเฉพาะ';
            default: return appliesTo;
        }
    };

    const formatDiscount = (discount: BulkDiscount) => {
        if (discount.discount_type === 'percentage') {
            return `${discount.discount_value}%`;
        }
        return `฿${discount.discount_value.toLocaleString()}`;
    };

    if (items.length === 0) {
        return (
            <section
                className="rounded-2xl border border-zinc-800/90 bg-zinc-950/45 p-12 text-center shadow-sm"
                aria-labelledby="bulk-discount-empty-heading"
            >
                <span className="mb-4 block text-4xl" aria-hidden>
                    💰
                </span>
                <h3 id="bulk-discount-empty-heading" className="text-lg font-semibold text-white mb-2">
                    ยังไม่มีส่วนลดซื้อเยอะ
                </h3>
                <p className="text-zinc-400 mb-4">
                    เริ่มสร้างส่วนลดเมื่อลูกค้าซื้อครบจำนวนที่กำหนด
                </p>
                <Link
                    href="/admin/bulk-discounts/new"
                    title="ไปหน้าสร้างส่วนลดซื้อเยอะใหม่"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-sm shadow-sm"
                >
                    + เพิ่มส่วนลดใหม่
                </Link>
            </section>
        );
    }

    return (
        <AdminTablePanel>
                <table className="min-w-full">
                    <caption className="sr-only">
                        รายการส่วนลดซื้อเยอะ สลับเปิดปิด แก้ไข และลบ
                    </caption>
                    <thead className="bg-zinc-900/90">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                ชื่อ
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                เงื่อนไข
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                ส่วนลด
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                ใช้กับ
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                สถานะ
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                จัดการ
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-zinc-950/40 divide-y divide-zinc-800">
                        {items.map((discount) => (
                            <tr key={discount.id} className="hover:bg-zinc-800/35 transition">
                                <td className="px-4 py-4">
                                    <div className="font-medium text-zinc-100">
                                        {discount.name}
                                    </div>
                                    {discount.description && (
                                        <div className="text-xs text-zinc-500 mt-0.5">
                                            {discount.description}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">
                                        ซื้อขั้นต่ำ {discount.min_quantity} ชิ้น
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="font-bold text-green-600 dark:text-green-400">
                                        {formatDiscount(discount)}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        {getDiscountTypeLabel(discount.discount_type)}
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                        {getAppliesToLabel(discount.applies_to)}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={discount.is_active}
                                        onClick={() => handleToggle(discount.id)}
                                        disabled={loading === discount.id}
                                        title={
                                            discount.is_active
                                                ? `ปิดใช้ส่วนลด "${discount.name}"`
                                                : `เปิดใช้ส่วนลด "${discount.name}"`
                                        }
                                        aria-label={
                                            discount.is_active
                                                ? `ปิดใช้ส่วนลด ${discount.name}`
                                                : `เปิดใช้ส่วนลด ${discount.name}`
                                        }
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${discount.is_active
                                                ? 'bg-green-500'
                                                : 'bg-zinc-300 dark:bg-zinc-600'
                                            }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${discount.is_active ? 'translate-x-6' : 'translate-x-1'
                                            }`} aria-hidden />
                                    </button>
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link
                                            href={`/admin/bulk-discounts/${discount.id}`}
                                            className="p-2 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                                            title={`แก้ไขส่วนลด — ${discount.name}`}
                                            aria-label={`แก้ไขส่วนลด ${discount.name}`}
                                        >
                                            <span aria-hidden>✏️</span>
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(discount.id)}
                                            disabled={loading === discount.id}
                                            className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                                            title={`ลบส่วนลด — ${discount.name}`}
                                            aria-label={`ลบส่วนลด ${discount.name}`}
                                        >
                                            <span aria-hidden>🗑️</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
        </AdminTablePanel>
    );
}
