'use client';

import Link from 'next/link';
import { useCart } from '@app/context/CartContext';
import { useLanguage } from '@app/context/LanguageContext';

export default function Header({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
    const { cartCount, toggleCart } = useCart();
    const { t, language, setLanguage } = useLanguage();

    return (
        <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="container flex h-16 items-center justify-between px-4 md:px-6">
                <Link href="/" className="font-bold text-xl flex items-center gap-2">
                    <span className="text-2xl">📦</span> Express Shop
                </Link>

                <nav className="flex gap-4 md:gap-6 items-center">
                    <Link href="/shop" className="text-sm font-medium hover:underline underline-offset-4 hidden md:block">
                        {t('nav.catalog')}
                    </Link>
                    <Link href="/track" className="text-sm font-medium hover:underline underline-offset-4 hidden md:block">
                        {t('nav.track')}
                    </Link>
                    <Link href="/contact" className="text-sm font-medium hover:underline underline-offset-4 hidden md:block">
                        {language === 'th' ? 'ติดต่อ' : 'Contact'}
                    </Link>

                    <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700 mx-2 hidden md:block"></div>



                    <div className="flex items-center gap-1 text-sm font-medium border border-zinc-200 dark:border-zinc-800 rounded-full p-1 bg-white dark:bg-black">
                        <button
                            onClick={() => setLanguage('th')}
                            className={`px-3 py-1 rounded-full transition-all text-xs ${language === 'th' ? 'text-white font-bold bg-black dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                        >
                            TH
                        </button>
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-3 py-1 rounded-full transition-all text-xs ${language === 'en' ? 'text-white font-bold bg-black dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                        >
                            EN
                        </button>
                    </div>
                    <Link href="/profile" className="flex items-center gap-2 text-sm font-medium hover:text-blue-600 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <span className="hidden md:inline">Account</span>
                    </Link>
                    <button
                        onClick={toggleCart}
                        className="relative p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition group"
                    >
                        <div className="w-6 h-6 flex items-center justify-center text-zinc-700 dark:text-zinc-300 group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        </div>
                        {cartCount > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 w-5 bg-blue-600 text-[10px] font-bold text-white rounded-full flex items-center justify-center border-2 border-white dark:border-black transform scale-100 transition-transform">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </nav>
            </div>
        </header>
    );
}
