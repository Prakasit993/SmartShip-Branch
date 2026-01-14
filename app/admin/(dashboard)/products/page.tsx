import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';
import DeleteProductButton from './_components/DeleteProductButton';

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
        return <div className="text-red-500">Error loading products: {error.message}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold">Products (Inventory)</h1>
                <Link
                    href="/admin/products/new"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm md:text-base"
                >
                    + Add Product
                </Link>
            </div>

            <div className="bg-white dark:bg-zinc-900 shadow rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Stock</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Price</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
                            <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-zinc-200 dark:divide-zinc-800">
                        {products?.map((product) => (
                            <tr key={product.id}>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">{product.name}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-zinc-500 hidden sm:table-cell">{product.sku || '-'}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                                    {product.stock_quantity < 5 ? (
                                        <span className="text-red-600 font-bold">{product.stock_quantity}</span>
                                    ) : (
                                        product.stock_quantity
                                    )}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">฿{product.price}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm hidden sm:table-cell">
                                    {product.is_active ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                            Inactive
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link href={`/admin/products/${product.id}`} className="text-blue-600 hover:text-blue-900 mr-2 md:mr-4">
                                        Edit
                                    </Link>
                                    <DeleteProductButton id={product.id} />
                                </td>
                            </tr>
                        ))}
                        {products?.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-zinc-500">No products found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

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
                                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition text-sm"
                            >
                                ← ก่อนหน้า
                            </Link>
                        )}
                        {currentPage < totalPages && (
                            <Link
                                href={`/admin/products?page=${currentPage + 1}`}
                                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition text-sm"
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
