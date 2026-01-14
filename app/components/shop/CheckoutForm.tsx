'use client';

import { useCart } from '@app/context/CartContext';
import { createOrder } from '@app/actions/order';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@app/context/LanguageContext';

export default function CheckoutForm() {
    const { items, cartTotal, clearCart } = useCart();
    const router = useRouter();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);

    // User Data State
    const [userData, setUserData] = useState<{ name: string, phone: string, address: string } | null>(null);

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { user } } = await import('@/lib/supabaseClient').then(m => m.supabase.auth.getUser());
            if (user) {
                // Try to get last order for address
                const { data: orders } = await import('@/lib/supabaseClient').then(m => m.supabase
                    .from('orders')
                    .select('customer_name, customer_phone, shipping_address')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                );

                if (orders && orders.length > 0) {
                    setUserData({
                        name: orders[0].customer_name,
                        phone: orders[0].customer_phone,
                        address: orders[0].shipping_address
                    });
                } else {
                    // Fallback to Metadata if available? or just empty
                    // Social login might provide name
                    setUserData({
                        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                        phone: '',
                        address: ''
                    });
                }
            }
        };
        fetchUserData();
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        formData.append('cart', JSON.stringify(items));

        const res = await createOrder(null, formData);

        if (res?.error) {
            alert(res.error);
            setLoading(false);
        } else if (res?.success) {
            clearCart();
            router.push(`/track?order_no=${res.orderNo}`);
        }
    };

    if (items.length === 0) {
        return <div className="text-center py-10">{t('cart.empty')}</div>;
    }

    return (
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 font-sans">
            {/* Left Column: Form */}
            <div className="md:col-span-7 lg:col-span-8">
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 md:p-8">
                    <h2 className="text-xl font-bold mb-6 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm">1</span>
                        {t('checkout.shipping_info')}
                    </h2>
                    <form id="checkout-form" onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t('form.fullname')}</label>
                                <input
                                    name="name"
                                    required
                                    defaultValue={userData?.name}
                                    key={userData ? 'loaded' : 'loading'} // Force re-render when loaded
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                                    placeholder={t('form.fullname_placeholder')}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t('form.phone')}</label>
                                <input
                                    name="phone"
                                    required
                                    type="tel"
                                    defaultValue={userData?.phone}
                                    key={userData ? 'loaded-phone' : 'loading-phone'}
                                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                                    placeholder={t('form.phone_placeholder')}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t('form.email')}</label>
                            <input
                                name="email"
                                type="email"
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                                placeholder={t('form.email_placeholder')}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t('form.address')}</label>
                            <textarea
                                name="address"
                                required
                                rows={3}
                                defaultValue={userData?.address}
                                key={userData ? 'loaded-address' : 'loading-address'}
                                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 resize-none"
                                placeholder={t('form.address_placeholder')}
                            />
                        </div>

                        <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <h2 className="text-xl font-bold mb-6 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm">2</span>
                                {t('checkout.payment_notes')}
                            </h2>
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t('form.payment_method')}</label>
                                    <div className="relative">
                                        <select
                                            name="payment_method"
                                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-500 transition-all text-zinc-900 dark:text-zinc-100 appearance-none cursor-pointer"
                                        >
                                            <option value="transfer">{t('form.method.transfer')}</option>
                                            <option value="promptpay">{t('form.method.promptpay')}</option>
                                            <option value="shop">{t('form.method.shop')}</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t('form.notes')}</label>
                                    <textarea
                                        name="notes"
                                        rows={2}
                                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-500 transition-all text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 resize-none"
                                        placeholder={t('form.notes_placeholder')}
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right Column: Summary */}
            <div className="md:col-span-5 lg:col-span-4 space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-100 dark:border-zinc-800 p-6 sticky top-6">
                    <h2 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100 pb-4 border-b border-zinc-100 dark:border-zinc-800">{t('checkout.order_summary')}</h2>
                    <div className="space-y-4 mb-6 text-sm max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                        {items.map((item, idx) => (
                            <div key={idx} className="flex gap-3">
                                <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-md shrink-0 overflow-hidden">
                                    {item.image_url && <img src={item.image_url} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{item.bundle_name}</div>
                                    <div className="text-zinc-500 text-xs">{t('product.quantity')}: {item.quantity}</div>
                                </div>
                                <div className="font-semibold text-zinc-900 dark:text-zinc-100">฿{(item.price * item.quantity).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-3 py-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex justify-between text-zinc-500 text-sm">
                            <span>{t('cart.subtotal')}</span>
                            <span>฿{cartTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-zinc-500 text-sm">
                            <span>{t('checkout.shipping')}</span>
                            <span className="text-green-600 font-medium">{t('checkout.free')}</span>
                        </div>
                        <div className="flex justify-between text-zinc-900 dark:text-white font-bold text-xl pt-2">
                            <span>{t('cart.total')}</span>
                            <span>฿{cartTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        form="checkout-form"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-lg font-bold shadow-blue-200 dark:shadow-none shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {t('checkout.processing')}
                            </>
                        ) : (
                            t('checkout.confirm_order')
                        )}
                    </button>
                    <div className="text-center mt-3">
                        <span className="text-xs text-zinc-400 flex items-center justify-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                            {t('checkout.secure')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
