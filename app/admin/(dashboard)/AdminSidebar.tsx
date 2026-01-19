'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAdminLanguage } from '@app/admin/context/AdminLanguageContext';

export default function AdminSidebar({ role }: { role: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const { language, setLanguage, t } = useAdminLanguage();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    const handleLogout = async () => {
        await fetch('/api/auth/admin-logout', { method: 'POST' });
        router.push('/admin/login');
        router.refresh();
    };

    const closeSidebar = () => setIsOpen(false);

    return (
        <>
            {/* Mobile Header with Hamburger */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center text-sm shadow-lg">
                        📦
                    </div>
                    <span className="font-bold text-white">SmartShip Admin</span>
                </div>
                <button
                    onClick={() => setIsOpen(true)}
                    className="p-2 text-white hover:bg-zinc-800 rounded-lg transition"
                    aria-label="Open menu"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/60 z-50"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar - Desktop fixed, Mobile drawer */}
            <aside className={`
                w-64 bg-black border-r border-zinc-900 flex flex-col fixed h-full z-50 text-white
                transition-transform duration-300 ease-in-out
                md:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-8 pb-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-blue-900/40">
                            📦
                        </div>
                        <div>
                            <h1 className="font-bold text-lg tracking-tight">SmartShip</h1>
                            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Admin Portal</p>
                        </div>
                    </div>

                    {/* Language Switcher */}
                    <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg">
                        <button
                            onClick={() => setLanguage('th')}
                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${language === 'th'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            TH
                        </button>
                        <button
                            onClick={() => setLanguage('en')}
                            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${language === 'en'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            EN
                        </button>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-4">{t('nav.overview')}</p>
                    <NavItem href="/admin" icon="📊" label={t('nav.dashboard')} active={pathname === '/admin'} onClick={closeSidebar} />
                    <NavItem href="/admin/orders" icon="🛍️" label={t('nav.orders')} active={isActive('/admin/orders')} onClick={closeSidebar} />

                    {(role === 'admin' || role === 'true') && (
                        <>
                            <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-8">{t('nav.management')}</p>
                            <NavItem href="/admin/products" icon="🏷️" label={t('nav.products')} active={isActive('/admin/products')} onClick={closeSidebar} />
                            <NavItem href="/admin/bundles" icon="📦" label={t('nav.bundles')} active={isActive('/admin/bundles')} onClick={closeSidebar} />
                            <NavItem href="/admin/stock" icon="📋" label={t('nav.stock')} active={isActive('/admin/stock')} onClick={closeSidebar} />
                            <NavItem href="/admin/shipping" icon="🚚" label={t('nav.shipping')} active={isActive('/admin/shipping')} onClick={closeSidebar} />

                            <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-8">{t('nav.marketing')}</p>
                            <NavItem href="/admin/reviews" icon="⭐" label={t('nav.reviews')} active={isActive('/admin/reviews')} onClick={closeSidebar} />
                            <NavItem href="/admin/coupons" icon="🎫" label={t('nav.coupons')} active={isActive('/admin/coupons')} onClick={closeSidebar} />
                            <NavItem href="/admin/bulk-discounts" icon="💰" label={t('nav.bulkDiscounts')} active={isActive('/admin/bulk-discounts')} onClick={closeSidebar} />

                            <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-8">{t('nav.system')}</p>
                            <NavItem href="/admin/settings" icon="⚙️" label={t('nav.settings')} active={isActive('/admin/settings')} onClick={closeSidebar} />
                        </>
                    )}
                </nav>

                <div className="p-4 border-t border-zinc-900 mt-auto">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all text-sm font-medium group"
                    >
                        <span className="group-hover:translate-x-1 transition-transform">🚪</span>
                        {t('nav.signOut')}
                    </button>
                </div>
            </aside>
        </>
    );
}

function NavItem({ href, icon, label, active, onClick }: { href: string; icon: string; label: string; active: boolean; onClick?: () => void }) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
        >
            <span>{icon}</span>
            {label}
        </Link>
    );
}
