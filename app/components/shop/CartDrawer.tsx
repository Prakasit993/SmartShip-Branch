'use client';

import { useLanguage } from '@app/context/LanguageContext';
import { useCart } from '@app/context/CartContext';
import Link from 'next/link';

export default function CartDrawer() {
    const { isCartOpen, toggleCart, items, removeFromCart, cartTotal } = useCart();
    const { t } = useLanguage();

    if (!isCartOpen) return null;

    const handleUpdateQuantity = (idx: number, newQty: number) => {
        // This is a temporary local update helper until context supports updateQuantity
        // For now we can't implement it without context changes, so we will keep simple remove for now
        // Or better yet, we can simply remove and re-add or implement updateQuantity in context in next step.
        // Let's stick to the visual upgrade first, and keep Remove button.
    };

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex justify-end font-sans">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={toggleCart}
            />

            {/* Drawer */}
            <div className="relative z-[101] w-full max-w-sm md:max-w-md bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800">
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{t('cart.title')}</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{items.length} {t('cart.items_selected')}</p>
                    </div>
                    <button
                        onClick={toggleCart}
                        className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t('cart.empty')}</h3>
                                <p className="text-zinc-500 text-sm mt-1">{t('cart.empty_desc')}</p>
                            </div>
                            <Link href="/shop" onClick={toggleCart} className="text-blue-600 font-medium hover:underline text-sm">
                                {t('cart.start_shopping')}
                            </Link>
                        </div>
                    ) : (
                        items.map((item, idx) => (
                            <div key={idx} className="flex gap-4 group">
                                <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.bundle_name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-zinc-300 text-xs text-center p-1">{t('product.no_image')}</div>
                                    )}
                                </div>

                                <div className="flex-1 flex flex-col justify-between py-0.5">
                                    <div>
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">{item.bundle_name}</h4>
                                            <button
                                                onClick={() => removeFromCart(idx)}
                                                className="text-zinc-400 hover:text-red-500 transition-colors p-1 -mr-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                        {item.options && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {item.options.map((o, i) => (
                                                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium border border-zinc-200 dark:border-zinc-700">
                                                        {o.option_name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-end mt-2">
                                        <div className="flex items-center text-sm text-zinc-500">
                                            {t('product.quantity')}: <span className="font-medium text-zinc-900 dark:text-zinc-100 ml-1">{item.quantity}</span>
                                        </div>
                                        <div className="font-bold text-zinc-900 dark:text-white">
                                            ฿{(item.price * item.quantity).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 backdrop-blur-sm">
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-zinc-500 text-sm">
                                <span>{t('cart.subtotal')}</span>
                                <span>฿{cartTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-zinc-900 dark:text-white text-xl font-bold">
                                <span>{t('cart.total')}</span>
                                <span>฿{cartTotal.toLocaleString()}</span>
                            </div>
                        </div>
                        <Link
                            href="/checkout"
                            onClick={toggleCart}
                            className="block w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-center rounded-xl font-bold text-lg hover:translate-y-[-2px] hover:shadow-lg transition-all active:scale-[0.98] duration-200"
                        >
                            {t('cart.checkout')}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
