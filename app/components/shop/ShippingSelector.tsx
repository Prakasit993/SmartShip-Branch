'use client';

import { useState } from 'react';
import { useLanguage } from '@app/context/LanguageContext';

interface ShippingOption {
    id: string;
    name: string;
    description: string;
    icon: string;
    priceDisplay: string;
    priceValue: number;
}

interface ShippingSelectorProps {
    onSelect: (option: { code: string; base_rate: number } | null) => void;
}

const shippingOptions: ShippingOption[] = [
    {
        id: 'pickup',
        name: 'รับที่หน้าร้าน',
        description: 'มารับสินค้าด้วยตนเองที่ร้าน',
        icon: '🏪',
        priceDisplay: 'ฟรี',
        priceValue: 0,
    },
    {
        id: 'delivery',
        name: 'จัดส่ง',
        description: 'Admin จะติดต่อแจ้งค่าจัดส่งภายหลัง',
        icon: '🚚',
        priceDisplay: 'แจ้งราคาภายหลัง',
        priceValue: 0, // Admin will set later
    },
];

export default function ShippingSelector({ onSelect }: ShippingSelectorProps) {
    const { language } = useLanguage();
    const [selected, setSelected] = useState<string>('pickup');

    const handleSelect = (option: ShippingOption) => {
        setSelected(option.id);
        onSelect({
            code: option.id,
            base_rate: option.priceValue,
        });
    };

    // Auto-select first option on mount
    useState(() => {
        onSelect({
            code: shippingOptions[0].id,
            base_rate: shippingOptions[0].priceValue,
        });
    });

    return (
        <div className="space-y-3">
            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                {language === 'th' ? '🚚 เลือกวิธีจัดส่ง' : '🚚 Shipping Method'}
            </label>

            {shippingOptions.map((option) => {
                const isSelected = selected === option.id;
                const isFree = option.priceValue === 0 && option.id === 'pickup';

                return (
                    <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option)}
                        className={`w-full p-4 rounded-xl border-2 transition-all text-left ${isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
                                : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600'
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {/* Icon */}
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${isSelected
                                        ? 'bg-blue-100 dark:bg-blue-900/40'
                                        : 'bg-zinc-100 dark:bg-zinc-700'
                                    }`}>
                                    {option.icon}
                                </div>

                                {/* Info */}
                                <div>
                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                        {option.name}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {option.description}
                                    </div>
                                </div>
                            </div>

                            {/* Price */}
                            <div className="text-right">
                                {isFree ? (
                                    <span className="text-green-600 dark:text-green-400 font-bold">
                                        ฟรี
                                    </span>
                                ) : (
                                    <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                                        {option.priceDisplay}
                                    </span>
                                )}

                                {/* Radio indicator */}
                                <div className={`mt-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ml-auto ${isSelected
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-zinc-300 dark:border-zinc-600'
                                    }`}>
                                    {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </div>
                    </button>
                );
            })}

            {/* Note for delivery option */}
            {selected === 'delivery' && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                        📦 หลังจากสั่งซื้อ Admin จะติดต่อกลับเพื่อแจ้งค่าจัดส่งตามที่อยู่และน้ำหนักสินค้า
                    </p>
                </div>
            )}

            {/* Hidden inputs for form submission */}
            <input type="hidden" name="shipping_method" value={selected} />
            <input type="hidden" name="shipping_cost" value={shippingOptions.find(o => o.id === selected)?.priceValue || 0} />
        </div>
    );
}
