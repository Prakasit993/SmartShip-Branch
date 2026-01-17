'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface NavItem {
    href: string;
    label: string;
    icon: string;
    activeIcon: string;
    badge?: number;
}

export default function AdminBottomNav() {
    const pathname = usePathname();
    const [newOrdersCount, setNewOrdersCount] = useState(0);

    useEffect(() => {
        // Fetch new orders count
        const fetchNewOrders = async () => {
            const { count } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'new');
            setNewOrdersCount(count || 0);
        };

        fetchNewOrders();

        // Subscribe to realtime updates
        const channel = supabase
            .channel('orders-count')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchNewOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const navItems: NavItem[] = [
        {
            href: '/admin',
            label: 'หน้าหลัก',
            icon: '📊',
            activeIcon: '📈',
        },
        {
            href: '/admin/orders',
            label: 'คำสั่งซื้อ',
            icon: '📦',
            activeIcon: '📦',
            badge: newOrdersCount,
        },
        {
            href: '/admin/products',
            label: 'สินค้า',
            icon: '🏷️',
            activeIcon: '🏷️',
        },
        {
            href: '/admin/settings',
            label: 'ตั้งค่า',
            icon: '⚙️',
            activeIcon: '⚙️',
        },
    ];

    const isActive = (href: string) => {
        if (href === '/admin') {
            return pathname === '/admin';
        }
        return pathname.startsWith(href);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 md:hidden safe-area-bottom">
            <div className="flex items-center justify-around h-16 px-2">
                {navItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all
                                ${active
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                }`}
                        >
                            {/* Badge */}
                            {item.badge && item.badge > 0 && (
                                <span className="absolute top-1 right-1/4 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                                    {item.badge > 99 ? '99+' : item.badge}
                                </span>
                            )}

                            {/* Icon */}
                            <span className={`text-xl transition-transform ${active ? 'scale-110' : ''}`}>
                                {active ? item.activeIcon : item.icon}
                            </span>

                            {/* Label */}
                            <span className={`text-[10px] mt-0.5 font-medium ${active ? 'font-bold' : ''}`}>
                                {item.label}
                            </span>

                            {/* Active Indicator */}
                            {active && (
                                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
