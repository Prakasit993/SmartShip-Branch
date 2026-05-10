'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const CartDrawer = dynamic(() => import('./CartDrawer'), { ssr: false });

/**
 * แสดงตะกร้า slide-over เฉพาะหน้า storefront (ไม่รวม /admin)
 */
export default function CartDrawerGate() {
    const pathname = usePathname();
    if (pathname?.startsWith('/admin')) return null;
    return <CartDrawer />;
}
