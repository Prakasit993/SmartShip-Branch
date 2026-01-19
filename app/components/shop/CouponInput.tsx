'use client';

import { useState } from 'react';
import { useLanguage } from '@app/context/LanguageContext';

interface CouponInputProps {
    onApply: (discount: { code: string; amount: number; type: string }) => void;
    orderTotal: number;
}

export default function CouponInput({ onApply, orderTotal }: CouponInputProps) {
    const { language } = useLanguage();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);

    const handleApply = async () => {
        if (!code.trim()) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code.trim().toUpperCase(),
                    order_total: orderTotal
                }),
            });

            const data = await res.json();

            if (res.ok && data.valid) {
                setApplied({
                    code: code.toUpperCase(),
                    discount: data.discount_amount
                });
                onApply({
                    code: code.toUpperCase(),
                    amount: data.discount_amount,
                    type: data.discount_type,
                });
                setError('');
            } else {
                setError(data.error || (language === 'th' ? 'โค้ดไม่ถูกต้อง' : 'Invalid code'));
                setApplied(null);
            }
        } catch (err) {
            setError(language === 'th' ? 'เกิดข้อผิดพลาด' : 'Error validating code');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = () => {
        setApplied(null);
        setCode('');
        onApply({ code: '', amount: 0, type: '' });
    };

    if (applied) {
        return (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                        ✓
                    </div>
                    <div>
                        <div className="font-medium text-green-700 dark:text-green-400 text-sm">
                            {applied.code}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-500">
                            {language === 'th' ? 'ลด' : 'Save'} ฿{applied.discount.toLocaleString()}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleRemove}
                    className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-full transition text-green-600"
                    title={language === 'th' ? 'ลบ' : 'Remove'}
                >
                    ✕
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">🎫</span>
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                        placeholder={language === 'th' ? 'โค้ดส่วนลด' : 'Discount code'}
                        className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-500 outline-none transition"
                    />
                </div>
                <button
                    onClick={handleApply}
                    disabled={loading || !code.trim()}
                    className="px-4 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg font-medium text-sm hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {loading ? '...' : (language === 'th' ? 'ใช้โค้ด' : 'Apply')}
                </button>
            </div>
            {error && (
                <p className="text-red-500 text-xs">{error}</p>
            )}
        </div>
    );
}
