import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
    // Fetch products with their stock levels
    const { data: products, error } = await supabaseAdmin
        .from('products')
        .select('id, name, sku, stock_quantity, is_active')
        .order('name', { ascending: true });

    if (error) {
        return <div className="text-red-500">Error loading stock: {error.message}</div>;
    }

    const lowStockThreshold = 10;
    const lowStockProducts = products?.filter(p => p.stock_quantity !== null && p.stock_quantity <= lowStockThreshold) || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">📋 Stock Management</h1>
            </div>

            {/* Low Stock Warning */}
            {lowStockProducts.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <h2 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2">
                        ⚠️ สินค้าใกล้หมด ({lowStockProducts.length} รายการ)
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {lowStockProducts.map(p => (
                            <Link
                                key={p.id}
                                href={`/admin/products/${p.id}`}
                                className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm hover:bg-yellow-200 dark:hover:bg-yellow-800 transition"
                            >
                                {p.name} ({p.stock_quantity})
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Stock Table */}
            <div className="bg-white dark:bg-zinc-900 shadow rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">SKU</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Stock</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-zinc-200 dark:divide-zinc-800">
                        {products?.map((product) => (
                            <tr key={product.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{product.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 font-mono">{product.sku || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${product.stock_quantity === null || product.stock_quantity === undefined
                                            ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                            : product.stock_quantity <= 0
                                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                : product.stock_quantity <= lowStockThreshold
                                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        }`}>
                                        {product.stock_quantity ?? 'N/A'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link href={`/admin/products/${product.id}`} className="text-blue-600 hover:text-blue-900">
                                        Edit
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {products?.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-zinc-500">No products found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-sm text-zinc-500">Total Products</p>
                    <p className="text-2xl font-bold">{products?.length || 0}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-sm text-zinc-500">Low Stock Items</p>
                    <p className="text-2xl font-bold text-yellow-600">{lowStockProducts.length}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="text-sm text-zinc-500">Out of Stock</p>
                    <p className="text-2xl font-bold text-red-600">
                        {products?.filter(p => p.stock_quantity !== null && p.stock_quantity <= 0).length || 0}
                    </p>
                </div>
            </div>
        </div>
    );
}
