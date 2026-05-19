import Link from 'next/link';
import CartPageClient from './CartPageClient';

export const metadata = {
    title: 'ตะกร้าสินค้า',
    description: 'ตรวจสอบรายการและจำนวนสินค้าก่อนชำระเงิน',
};

export default function CartPage() {
    return (
        <div className="home-typography bg-[var(--background)] min-h-[70vh]">
            <div className="max-w-lg mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
                <nav aria-label="ตำแหน่งในหน้าเว็บ" className="mb-6">
                    <ol className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <li>
                            <Link
                                href="/"
                                className="font-medium text-zinc-600 hover:text-cyan-600 underline-offset-4 hover:underline dark:text-zinc-300"
                            >
                                หน้าแรก
                            </Link>
                        </li>
                        <li aria-hidden className="text-zinc-300 dark:text-zinc-600">
                            /
                        </li>
                        <li className="font-semibold text-zinc-800 dark:text-zinc-100" aria-current="page">
                            ตะกร้าสินค้า
                        </li>
                    </ol>
                </nav>
                <CartPageClient />
            </div>
        </div>
    );
}
