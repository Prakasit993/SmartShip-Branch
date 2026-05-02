import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { AdminTablePanel } from '@app/admin/components/AdminTablePanel';
import DeleteProductButton from './_components/DeleteProductButton';
import ToastListener from '@app/admin/components/ToastListener';

export const dynamic = 'force-dynamic';

const ITEMS_PER_PAGE = 10;

export default async function ProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>;
}) {
    const params = await searchParams;
    const currentPage = Math.max(1, parseInt(params.page || '1', 10));
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    // Get total count
    const { count: totalCount } = await supabaseAdmin
        .from('products')
        .select('*', { count: 'exact', head: true });

    const totalPages = Math.ceil((totalCount || 0) / ITEMS_PER_PAGE);

    // Get paginated products
    const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

    if (error) {
        return <div className="text-red-500">❌ เกิดข้อผิดพลาด: {error.message}</div>;
    }

    return (
        <div className="space-y-6 pb-20">
            <ToastListener />
            <AdminPageHeader
                title="สินค้า (คลังสินค้า)"
                description="จัดการรายการสินค้าทั้งหมด"
                titleLeft={<span aria-hidden>📦</span>}
                actions={
                    <Link
                        href="/admin/products/new"
                        className="inline-flex justify-center px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-bold shadow-sm"
                    >
                        ➕ เพิ่มสินค้า
                    </Link>
                }
            />

            <AdminTablePanel>
                <table className="min-w-full divide-y divide-zinc-800">
                    <thead className="bg-zinc-900/90">
                        <tr>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ชื่อสินค้า</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">สต๊อก</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ราคา</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">สถานะ</th>
                            <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-zinc-950/40 divide-y divide-zinc-800">
                        {products?.map((product) => (
                            <tr key={product.id} className="hover:bg-zinc-800/35 transition">
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">{product.name}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-zinc-500 hidden sm:table-cell">{product.sku || '-'}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                                    {product.stock_quantity < 5 ? (
                                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                            ⚠️ {product.stock_quantity}
                                        </span>
                                    ) : (
                                        <span className="text-green-600 font-medium">{product.stock_quantity}</span>
                                    )}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-bold">฿{product.price?.toLocaleString()}</td>
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
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <Link href={`/admin/products/${product.id}`} className="text-blue-600 hover:text-blue-900">
                                        ✏️ แก้ไข
                                    </Link>
                                    <DeleteProductButton id={product.id} />
                                </td>
                            </tr>
                        ))}
                        {products?.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                                    📭 ยังไม่มีสินค้า
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </AdminTablePanel>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <p className="text-sm text-zinc-500">
                        หน้า {currentPage} จาก {totalPages} ({totalCount} รายการ)
                    </p>
                    <div className="flex gap-2">
                        {currentPage > 1 && (
                            <Link
                                href={`/admin/products?page=${currentPage - 1}`}
                                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-600 transition text-sm"
                            >
                                ← ก่อนหน้า
                            </Link>
                        )}
                        {currentPage < totalPages && (
                            <Link
                                href={`/admin/products?page=${currentPage + 1}`}
                                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded-xl hover:bg-zinc-300 dark:hover:bg-zinc-600 transition text-sm"
                            >
                                ถัดไป →
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
