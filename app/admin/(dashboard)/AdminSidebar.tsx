'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAdminLanguage } from '@app/admin/context/AdminLanguageContext';
import { AdminGlobalDate } from '@app/admin/components/AdminGlobalDate';

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

    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeSidebar();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);

    return (
        <>
            {/* Mobile: แถวชื่อ + แถบ วันที่·เวลา เต็มความกว้าง (ไม่ truncate — เวลาไม่หาย) */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-[#070d1b] backdrop-blur">
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-sm shadow-lg" aria-hidden>
                            📦
                        </div>
                        <span className="min-w-0 truncate font-bold text-sm leading-tight text-white">SmartShip Admin</span>
                    </div>
                    <button
                        onClick={() => setIsOpen(true)}
                        className="min-h-11 min-w-11 shrink-0 rounded-lg p-2 text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        aria-label="Open menu"
                        aria-expanded={isOpen}
                        aria-controls="admin-sidebar-nav"
                    >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
                <div className="border-t border-zinc-800/70 px-3 py-1.5 sm:px-4">
                    <AdminGlobalDate
                        compact
                        className="block w-full whitespace-normal break-words text-left text-[11px] leading-snug text-zinc-300 tabular-nums sm:text-xs"
                    />
                </div>
            </div>

            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black/60 z-50"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar - Desktop fixed, Mobile drawer */}
            <aside
                id="admin-sidebar-nav"
                className={`
                w-64 bg-[#060b17] border-r border-zinc-800 flex flex-col fixed z-50 text-white
                h-[100dvh] max-h-[100dvh] min-h-0
                transition-transform duration-300 ease-in-out
                md:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
            >
                <div className="shrink-0 p-8 pb-4">
                    <div className="flex items-center justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-blue-900/40" aria-hidden>
                            📦
                        </div>
                        <div>
                            <h1 className="font-bold text-lg tracking-tight">SmartShip</h1>
                            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Admin Portal</p>
                        </div>
                        </div>
                        <button
                            onClick={closeSidebar}
                            className="md:hidden min-h-11 min-w-11 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            aria-label="Close menu"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Language Switcher */}
                    <div className="flex items-center gap-1 p-1 bg-[#0d1527] rounded-lg border border-zinc-800">
                        <button
                            onClick={() => setLanguage('th')}
                            className={`flex-1 min-h-11 px-3 py-1.5 rounded-md text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${language === 'th'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            TH
                        </button>
                        <button
                            onClick={() => setLanguage('en')}
                            className={`flex-1 min-h-11 px-3 py-1.5 rounded-md text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${language === 'en'
                                ? 'bg-blue-600 text-white shadow'
                                : 'text-zinc-400 hover:text-white'
                                }`}
                        >
                            EN
                        </button>
                    </div>
                </div>

                <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2 space-y-1">
                    <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-4">{t('nav.overview')}</p>
                    <NavItem href="/admin" icon="📊" label={t('nav.dashboard')} active={pathname === '/admin'} onClick={closeSidebar} />
                    <NavItem href="/admin/jt-dashboard" icon="📊" label={t('nav.jtDashboard')} active={isActive('/admin/jt-dashboard')} onClick={closeSidebar} />
                    <NavItem href="/admin/jt-deep-dive-dashboard" icon="💹" label={t('nav.jtDeepDive')} active={isActive('/admin/jt-deep-dive-dashboard')} onClick={closeSidebar} />
                    <NavItem href="/admin/tiktok-dashboard" icon="🎵" label={t('nav.tiktokDashboard')} active={isActive('/admin/tiktok-dashboard')} onClick={closeSidebar} />
                    <NavItem href="/admin/customer-profile" icon="👤" label={t('nav.customerProfile')} active={isActive('/admin/customer-profile')} onClick={closeSidebar} />
                    <NavItem href="/admin/jt-warehouse" icon="📦" label={t('nav.jtWarehouse')} active={isActive('/admin/jt-warehouse')} onClick={closeSidebar} />
                    <NavItem href="/admin/orders" icon="🛍️" label={t('nav.orders')} active={isActive('/admin/orders')} onClick={closeSidebar} />

                    {(role === 'admin' || role === 'true') && (
                        <>
                            <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-8">{t('nav.management')}</p>
                            <NavItem href="/admin/products" icon="🏷️" label={t('nav.products')} active={isActive('/admin/products')} onClick={closeSidebar} />
                            <NavItem href="/admin/bundles" icon="📦" label={t('nav.bundles')} active={isActive('/admin/bundles')} onClick={closeSidebar} />
                            <NavItem href="/admin/stock" icon="📋" label={t('nav.stock')} active={isActive('/admin/stock')} onClick={closeSidebar} />


                            <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-8">{t('nav.marketing')}</p>
                            <NavItem href="/admin/bulk-discounts" icon="💰" label={t('nav.bulkDiscounts')} active={isActive('/admin/bulk-discounts')} onClick={closeSidebar} />

                            <p className="px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest mb-2 mt-8">{t('nav.system')}</p>
                            <NavItem href="/admin/ai-chat-logs" icon="💬" label={t('nav.aiChatLogs')} active={isActive('/admin/ai-chat-logs')} onClick={closeSidebar} />
                            <NavItem href="/admin/settings" icon="⚙️" label={t('nav.settings')} active={isActive('/admin/settings')} onClick={closeSidebar} />
                        </>
                    )}
                </nav>

                <div className="shrink-0 border-t border-zinc-800 bg-[#060a14] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full min-h-11 px-4 py-3 text-zinc-400 hover:text-white hover:bg-[#0f1a31] rounded-lg transition-all text-sm font-medium group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                        <span className="group-hover:translate-x-1 transition-transform" aria-hidden>
                            🚪
                        </span>
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
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 min-h-11 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${active
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400/40'
                : 'text-zinc-400 hover:text-white hover:bg-[#0f1a31]'
                }`}
        >
            <span aria-hidden>{icon}</span>
            {label}
        </Link>
    );
}
