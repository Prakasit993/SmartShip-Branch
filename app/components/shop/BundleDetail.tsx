'use client';

import { useState, useEffect, useRef } from 'react';
import { useCart } from '@app/context/CartContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@app/context/LanguageContext';
import { ShoppingCart, CreditCard, MessageCircle, ChevronLeft, Package, Edit, Check } from 'lucide-react';
import Link from 'next/link';

// Extend Window interface for TypeScript
declare global {
    interface Window {
        __ADD_TO_CART_LOCK__?: Map<number, number>;
    }
}

// Use window global for lock - survives HMR and all React re-renders
const getAddToCartLock = (): Map<number, number> => {
    if (typeof window !== 'undefined') {
        if (!window.__ADD_TO_CART_LOCK__) {
            window.__ADD_TO_CART_LOCK__ = new Map();
        }
        return window.__ADD_TO_CART_LOCK__;
    }
    return new Map();
};

interface BundleDetailProps {
    bundle: any;
    items?: any[];
    optionGroups?: any[];
    isAdmin?: boolean;
}

export default function BundleDetail({ bundle, items, optionGroups, isAdmin = false }: BundleDetailProps) {
    const { addToCart } = useCart();
    const router = useRouter();
    const { t } = useLanguage();
    const [quantity, setQuantity] = useState(20);
    const [selectedOptions, setSelectedOptions] = useState<Record<number, any>>({});
    const [totalPrice, setTotalPrice] = useState(bundle.price);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const isAddingRef = useRef(false);

    // Recalculate price when options change
    useEffect(() => {
        let modifierSum = 0;
        Object.values(selectedOptions).forEach((opt: any) => {
            modifierSum += (opt.price_modifier || 0);
        });
        setTotalPrice(bundle.price + modifierSum);
    }, [selectedOptions, bundle.price]);

    const handleOptionSelect = (groupId: number, option: any) => {
        setSelectedOptions(prev => ({ ...prev, [groupId]: option }));
    };

    const handleAddToCart = () => {
        const now = Date.now();
        const lock = getAddToCartLock();
        const lastAdded = lock.get(bundle.id);

        // If there's a recent lock (within 3 seconds), block this add
        if (lastAdded && now - lastAdded < 3000) {
            console.log('Blocked by window global lock:', bundle.id);
            return;
        }

        // Set the lock immediately at window level
        lock.set(bundle.id, now);

        // Also check ref as secondary protection
        if (isAddingRef.current) {
            console.log('Blocked by ref lock');
            return;
        }
        isAddingRef.current = true;

        // Validate Configurable
        if (bundle.type === 'configurable' && optionGroups) {
            const missingGroups = optionGroups.filter(g => !selectedOptions[g.id]);
            if (missingGroups.length > 0) {
                alert(`Please select options for: ${missingGroups.map(g => g.name).join(', ')}`);
                isAddingRef.current = false;
                lock.delete(bundle.id);
                return;
            }
        }

        // Prepare Cart Item options
        const finalOptions = bundle.type === 'configurable'
            ? Object.entries(selectedOptions).map(([groupId, opt]: [string, any]) => {
                const group = optionGroups?.find(g => g.id === parseInt(groupId));
                return {
                    group_name: group?.name || 'Option',
                    option_name: opt.name || 'Selected',
                    product_id: opt.product_id,
                    price_modifier: opt.price_modifier
                };
            })
            : undefined;

        console.log('Actually adding to cart:', bundle.id, 'qty:', quantity);

        addToCart({
            bundle_id: bundle.id,
            bundle_name: bundle.name,
            price: totalPrice,
            quantity: quantity,
            image_url: bundle.image_urls?.[0],
            options: finalOptions
        });

        // Reset ref after a delay
        setTimeout(() => {
            isAddingRef.current = false;
        }, 3000);

        // Clean up window global lock after 5 seconds
        setTimeout(() => {
            getAddToCartLock().delete(bundle.id);
        }, 5000);
    };

    // Calculate max available stock based on items
    const maxStock = items ? Math.min(...items.map(i => Math.floor((i.products?.stock_quantity || 0) / i.quantity))) : 0;
    const isOutOfStock = maxStock <= 0;

    const handleQuantityChange = (val: number) => {
        const newQty = Math.max(1, Math.min(val, maxStock));
        setQuantity(newQty);
    };

    const handleBuyNow = () => {
        handleAddToCart();
        router.push('/checkout');
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden font-sans">

            {/* Admin Edit Bar */}
            {isAdmin && (
                <div className="bg-amber-50 dark:bg-amber-900/20 px-4 py-2 border-b border-amber-100 dark:border-amber-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                        <Edit size={14} /> Admin Mode
                    </span>
                    <Link
                        href={`/admin/bundles/${bundle.id}`}
                        className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-md font-medium transition-colors"
                    >
                        Edit this Bundle
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Image Section */}
                <div className="bg-zinc-50 dark:bg-black/40 p-6 md:p-10 flex flex-col items-center justify-start gap-6 h-full border-r border-zinc-100 dark:border-zinc-800">
                    <div className="w-full relative aspect-square bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-800">
                        {bundle.image_urls?.[activeImageIndex] ? (
                            <img
                                src={bundle.image_urls[activeImageIndex]}
                                alt={bundle.name}
                                className="w-full h-full object-contain object-center p-4 transition-transform duration-500 hover:scale-105"
                            />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full text-zinc-400 text-sm">{t('product.no_image')}</div>
                        )}
                        {isOutOfStock && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
                                <span className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold text-xl shadow-2xl">{t('product.out_of_stock')}</span>
                            </div>
                        )}
                    </div>

                    {/* Thumbnails */}
                    {bundle.image_urls && bundle.image_urls.length > 1 && (
                        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 px-2 w-full scrollbar-hide -mx-2">
                            {bundle.image_urls.map((url: string, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${activeImageIndex === idx
                                        ? 'border-zinc-900 dark:border-white ring-2 ring-zinc-200 dark:ring-zinc-700 opacity-100'
                                        : 'border-transparent bg-white dark:bg-zinc-800 opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <img src={url} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Info Section */}
                <div className="p-6 md:p-10 flex flex-col h-full bg-white dark:bg-zinc-900">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                {bundle.type} Bundle
                            </span>
                            {!isOutOfStock ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    {t('product.in_stock')}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold bg-red-100/50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    {t('product.out_of_stock')}
                                </span>
                            )}
                        </div>

                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-zinc-900 dark:text-white tracking-tight mb-4 leading-tight">
                            {bundle.name}
                        </h1>

                        <div className="flex items-baseline gap-4 mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-6">
                            <span className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">
                                ฿{totalPrice.toLocaleString()}
                            </span>
                            {/* Optional: Show original price if discounted logic exists later */}
                        </div>

                        <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none text-zinc-600 dark:text-zinc-400 mb-8 font-light leading-relaxed">
                            {bundle.description || t('product.no_description')}
                        </div>

                        {/* Fixed Items List */}
                        {bundle.type === 'fixed' && items && items.length > 0 && (
                            <div className="mb-8 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800">
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Package size={14} /> {t('product.included_items')}
                                </h3>
                                <ul className="space-y-3">
                                    {items.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-4">
                                            <div className="bg-white dark:bg-zinc-800 w-8 h-8 flex items-center justify-center rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 font-bold text-xs text-zinc-900 dark:text-white shrink-0">
                                                x{item.quantity}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-zinc-900 dark:text-zinc-100 text-sm truncate">
                                                    {item.products?.name}
                                                </div>
                                                <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-2">
                                                    {(item.products?.width || item.products?.length || item.products?.height) && (
                                                        <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px]">
                                                            {item.products.width}x{item.products.length}x{item.products.height} {item.products.dimension_unit}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Configurable Options */}
                        {bundle.type === 'configurable' && optionGroups && (
                            <div className="space-y-6 mb-8">
                                {optionGroups.map(group => (
                                    <div key={group.id}>
                                        <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
                                            {group.name} <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {group.options.map((opt: any) => {
                                                const isSelected = selectedOptions[group.id]?.id === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => handleOptionSelect(group.id, opt)}
                                                        className={`px-4 py-3 text-sm border-2 rounded-xl transition-all text-left relative overflow-hidden group
                                                        ${isSelected
                                                                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black shadow-lg shadow-zinc-200 dark:shadow-zinc-900'
                                                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-transparent text-zinc-700 dark:text-zinc-300'
                                                            }
                                                    `}
                                                    >
                                                        <div className="flex justify-between items-center w-full">
                                                            <span className="font-semibold truncate pr-2">{opt.name || 'Option'}</span>
                                                            {isSelected && <Check size={14} />}
                                                        </div>
                                                        {opt.price_modifier > 0 && (
                                                            <div className={`text-xs mt-1 font-medium ${isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'}`}>
                                                                +฿{opt.price_modifier}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions and Cart */}
                    <div className="mt-auto border-t border-zinc-100 dark:border-zinc-800 pt-6 space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex items-center border-2 border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden h-12 sm:h-auto shrink-0 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600">
                                <button
                                    onClick={() => handleQuantityChange(quantity - 20)}
                                    disabled={quantity <= 1 || isOutOfStock}
                                    className="px-4 h-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition flex items-center justify-center"
                                >
                                    -
                                </button>
                                <div className="w-12 text-center font-bold text-zinc-900 dark:text-white bg-transparent">
                                    {quantity}
                                </div>
                                <button
                                    onClick={() => handleQuantityChange(quantity + 20)}
                                    disabled={quantity >= maxStock || isOutOfStock}
                                    className="px-4 h-full hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition flex items-center justify-center"
                                >
                                    +
                                </button>
                            </div>

                            <button
                                onClick={handleAddToCart}
                                disabled={isOutOfStock}
                                className="flex-1 h-12 sm:h-14 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-zinc-200 dark:shadow-none flex items-center justify-center gap-2"
                            >
                                <ShoppingCart size={18} />
                                เพิ่มสินค้าในตะกร้า
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button className="flex items-center justify-center gap-2 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 font-semibold text-sm transition">
                                <MessageCircle size={16} />
                                {t('product.chat')}
                            </button>
                            <Link href="/shop" className="flex items-center justify-center gap-2 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-300 font-semibold text-sm transition">
                                <ChevronLeft size={16} />
                                {t('shop.back')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
