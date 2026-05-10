import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { AdminTablePanel } from '@app/admin/components/AdminTablePanel';
import ToastListener from '@app/admin/components/ToastListener';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
    // Fetch products with their stock levels
    const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('id, name, sku, stock_quantity, is_active, image_urls, image_alt')
        .order('name', { ascending: true });

    if (error) {
        return <div className="text-red-500">❌ เกิดข้อผิดพลาด: {error.message}</div>;
    }

    const lowStockThreshold = 10;
    const lowStockProducts = products?.filter(p => p.stock_quantity !== null && p.stock_quantity <= lowStockThreshold) || [];
    const outOfStockProducts = products?.filter(p => p.stock_quantity !== null && p.stock_quantity <= 0) || [];

    return (
        <div className="space-y-6 pb-20">
            <ToastListener />
            <AdminPageHeader
                title="จัดการสต๊อก"
                description="ตรวจสอบจำนวนคงคลัง แก้ไขสต๊อกได้จากลิงก์แก้ไขสินค้า — รูปในตารางใช้ข้อความ alt จากหน้าแก้ไขสินค้า (SEO)"
                titleLeft={<span aria-hidden>📋</span>}
            />

            {/* Summary Cards */}
            <div
                className="grid grid-cols-3 gap-3 md:gap-4"
                role="region"
                aria-label="สรุปจำนวนสินค้าและสถานะสต๊อก"
            >
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <p className="text-xs md:text-sm text-zinc-500">📦 สินค้าทั้งหมด</p>
                    <p className="text-xl md:text-2xl font-bold">{products?.length || 0}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-2xl border border-yellow-200 dark:border-yellow-800">
                    <p className="text-xs md:text-sm text-yellow-700 dark:text-yellow-400">⚠️ ใกล้หมด</p>
                    <p className="text-xl md:text-2xl font-bold text-yellow-600">{lowStockProducts.length}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-200 dark:border-red-800">
                    <p className="text-xs md:text-sm text-red-700 dark:text-red-400">❌ หมดสต๊อก</p>
                    <p className="text-xl md:text-2xl font-bold text-red-600">{outOfStockProducts.length}</p>
                </div>
            </div>

            {/* Low Stock Warning */}
            {lowStockProducts.length > 0 && (
                <section
                    className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4"
                    aria-labelledby="stock-low-heading"
                >
                    <h2 id="stock-low-heading" className="font-bold text-yellow-800 dark:text-yellow-300 mb-3">
                        ⚠️ สินค้าใกล้หมด ({lowStockProducts.length} รายการ)
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {lowStockProducts.map((p) => (
                            <Link
                                key={p.id}
                                href={`/admin/products/${p.id}`}
                                title={`แก้ไขสินค้า ${p.name} — สต๊อกคงเหลือ ${p.stock_quantity ?? 0} ชิ้น`}
                                className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm hover:bg-yellow-200 dark:hover:bg-yellow-800 transition font-medium"
                            >
                                {p.name} <span className="font-bold">({p.stock_quantity})</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Stock Table */}
            <AdminTablePanel>
                <table className="min-w-full divide-y divide-zinc-800">
                    <caption className="sr-only">
                        รายการสินค้า จำนวนสต๊อก และลิงก์ไปแก้ไขสินค้า
                    </caption>
                    <thead className="bg-zinc-900/90">
                        <tr>
                            <th className="px-2 md:px-3 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-14">
                                รูป
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">สินค้า</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">สต๊อก</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">สถานะ</th>
                            <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-zinc-950/40 divide-y divide-zinc-800">
                        {products?.map((product: any) => (
                            <tr key={product.id} className="hover:bg-zinc-800/35 transition">
                                <td className="px-2 md:px-3 py-3 align-middle">
                                    {product.image_urls?.[0] ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- admin list; remote storage URLs
                                        <img
                                            src={product.image_urls[0]}
                                            alt={
                                                product.image_alt?.trim()
                                                    ? product.image_alt.trim()
                                                    : `${product.name} — ภาพสินค้า`
                                            }
                                            title={product.image_alt?.trim() || product.name}
                                            className="h-10 w-10 rounded-lg object-cover border border-zinc-700 bg-zinc-900"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    ) : (
                                        <span
                                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/80 text-[10px] text-zinc-500"
                                            aria-label="ไม่มีรูปสินค้า"
                                        >
                                            —
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">{product.name}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-zinc-500 font-mono hidden sm:table-cell">{product.sku || '-'}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                                    <span
                                        title={
                                            product.stock_quantity === null || product.stock_quantity === undefined
                                                ? 'ยังไม่ได้ระบุจำนวนสต๊อก'
                                                : `จำนวนคงเหลือ ${product.stock_quantity} ชิ้น`
                                        }
                                        className={`px-2 py-1 rounded-full text-xs font-bold ${product.stock_quantity === null || product.stock_quantity === undefined
                                        ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                        : product.stock_quantity <= 0
                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                            : product.stock_quantity <= lowStockThreshold
                                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        }`}
                                    >
                                        {product.stock_quantity ?? 'N/A'}
                                    </span>
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm hidden sm:table-cell">
                                    {product.is_active ? (
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                            ✅ ใช้งาน
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                            ⛔ ปิด
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link
                                        href={`/admin/products/${product.id}`}
                                        className="text-blue-600 hover:text-blue-900"
                                        title={`แก้ไขสินค้าและสต๊อก — ${product.name}`}
                                    >
                                        ✏️ แก้ไข
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {products?.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">📭 ยังไม่มีสินค้า</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </AdminTablePanel>
        </div>
    );
}
