'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@app/context/LanguageContext';
import type { CartItem } from '@app/context/CartContext';

type CartPanelProps = {
    items: CartItem[];
    cartTotal: number;
    cartCount: number;
    removeFromCart: (index: number) => void;
    updateLineQuantity: (index: number, quantity: number) => void;
    clearCart: () => void;
    variant: 'drawer' | 'page';
    onRequestClose?: () => void;
};

export default function CartPanel({
    items,
    cartTotal,
    cartCount,
    removeFromCart,
    updateLineQuantity,
    clearCart,
    variant,
    onRequestClose,
}: CartPanelProps) {
    const { t } = useLanguage();

    const wrapperClass =
        variant === 'page'
            ? 'flex flex-col min-h-[50vh] font-sans'
            : 'relative z-[101] w-full max-w-sm md:max-w-md bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300';

    return (
        <div className={wrapperClass}>
            <div className="flex justify-between items-center p-6 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                        {t('cart.title')}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                        {items.length} {t('cart.line_items')} · {cartCount} {t('cart.units')}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    {items.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof window !== 'undefined' && window.confirm(t('cart.clear_confirm'))) {
                                    clearCart();
                                }
                            }}
                            className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 px-2 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                            {t('cart.clear')}
                        </button>
                    )}
                    {variant === 'drawer' && onRequestClose && (
                        <button
                            type="button"
                            onClick={onRequestClose}
                            className="p-2 -mr-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            aria-label={t('cart.close')}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 dark:text-zinc-600">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="32"
                                height="32"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="9" cy="21" r="1" />
                                <circle cx="20" cy="21" r="1" />
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t('cart.empty')}</h3>
                            <p className="text-zinc-500 text-sm mt-1 max-w-xs mx-auto">{t('cart.empty_desc')}</p>
                        </div>
                        <Link
                            href="/shop"
                            onClick={variant === 'drawer' ? onRequestClose : undefined}
                            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-cyan-500 text-white font-semibold text-sm hover:bg-cyan-600 transition-colors"
                        >
                            {t('cart.start_shopping')}
                        </Link>
                    </div>
                ) : (
                    items.map((item, idx) => (
                        <div
                            key={`cart-line-${idx}`}
                            className="flex gap-4 group rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 bg-zinc-50/50 dark:bg-zinc-800/30"
                        >
                            <div className="w-[72px] h-[72px] bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200/80 dark:border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                                {item.image_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element -- remote URLs from storage
                                    <img
                                        src={item.image_url}
                                        alt={
                                            item.bundle_name?.trim()
                                                ? `${item.bundle_name.trim()} — ภาพในตะกร้า`
                                                : 'ภาพสินค้าในตะกร้า'
                                        }
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                ) : (
                                    <span className="text-zinc-400 text-[10px] text-center px-1">{t('product.no_image')}</span>
                                )}
                            </div>

                            <div className="flex-1 flex flex-col min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                    {item.bundle_slug ? (
                                        <Link
                                            href={`/shop/bundle/${item.bundle_slug}`}
                                            onClick={variant === 'drawer' ? onRequestClose : undefined}
                                            className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight text-left hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                        >
                                            {item.bundle_name}
                                        </Link>
                                    ) : (
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                                            {item.bundle_name}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeFromCart(idx)}
                                        className="text-zinc-400 hover:text-red-500 transition-colors p-1 shrink-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                        aria-label={t('cart.remove_line')}
                                    >
                                        <Trash2 size={16} strokeWidth={2} />
                                    </button>
                                </div>

                                {item.options && item.options.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {item.options.map((o, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-medium border border-zinc-200 dark:border-zinc-700"
                                            >
                                                {o.option_name}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                                    <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900">
                                        <button
                                            type="button"
                                            className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-lg transition-colors"
                                            onClick={() => {
                                                if (item.quantity <= 1) removeFromCart(idx);
                                                else updateLineQuantity(idx, item.quantity - 1);
                                            }}
                                            aria-label={t('cart.decrease_qty')}
                                        >
                                            <Minus size={16} />
                                        </button>
                                        <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                                            {item.quantity}
                                        </span>
                                        <button
                                            type="button"
                                            className="p-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-lg transition-colors"
                                            onClick={() => updateLineQuantity(idx, item.quantity + 1)}
                                            aria-label={t('cart.increase_qty')}
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            ฿{item.price.toLocaleString()} × {item.quantity}
                                        </p>
                                        <p className="font-bold text-zinc-900 dark:text-white tabular-nums">
                                            ฿{(item.price * item.quantity).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {items.length > 0 && (
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/30 backdrop-blur-sm shrink-0 space-y-4">
                    <div className="flex justify-between items-baseline gap-4">
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">{t('cart.order_total')}</span>
                        <span className="text-2xl font-black text-zinc-900 dark:text-white tabular-nums">
                            ฿{cartTotal.toLocaleString()}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-snug">{t('cart.shipping_note')}</p>
                    <div className="flex flex-col gap-2">
                        <Link
                            href="/checkout"
                            onClick={variant === 'drawer' ? onRequestClose : undefined}
                            className="block w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-center rounded-xl font-bold text-base hover:opacity-95 hover:shadow-lg transition-all active:scale-[0.99]"
                        >
                            {t('cart.checkout')}
                        </Link>
                        <Link
                            href="/shop"
                            onClick={variant === 'drawer' ? onRequestClose : undefined}
                            className="block w-full py-3 text-center text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                        >
                            {t('cart.continue_shopping')}
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
