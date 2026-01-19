import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import ProductSearch from '@app/components/shop/ProductSearch';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q } = await searchParams;
    const query = q || '';

    let supabaseQuery = supabase
        .from('bundles')
        .select('*, categories(*)')
        .eq('is_active', true)
        .order('sort_order', { foreignTable: 'categories' });

    // Client-side filtering would be easier for complex "or" logic across related tables if the dataset is small,
    // but here we can try a simple text search on the bundle level.
    // Note: 'or' with foreign tables is tricky in simple Supabase queries.
    // For now, let's filter after fetching since the catalog is small (<100 items).
    // This allows robust "characteristics" search against description/name.

    const { data: bundles, error } = await supabaseQuery;

    let filteredBundles = bundles || [];

    if (query) {
        const lowerQuery = query.toLowerCase();
        // Parse dimension search like "30 20 5" or "30x20x5"
        const dimensionPattern = query.replace(/[^\d\s]/g, ' ').trim().split(/\s+/).filter(Boolean);

        filteredBundles = filteredBundles.filter((b: any) => {
            // Regular text search
            const matchesText =
                b.name?.toLowerCase().includes(lowerQuery) ||
                b.description?.toLowerCase().includes(lowerQuery) ||
                b.categories?.name?.toLowerCase().includes(lowerQuery) ||
                b.slug?.toLowerCase().includes(lowerQuery) ||
                b.sku?.toLowerCase().includes(lowerQuery);

            // Dimension search - check if all dimension numbers appear in name or description
            const matchesDimensions = dimensionPattern.length >= 2 &&
                dimensionPattern.every(dim =>
                    b.name?.includes(dim) ||
                    b.description?.includes(dim) ||
                    b.slug?.includes(dim)
                );

            return matchesText || matchesDimensions;
        });
    }

    // Simple grouping by category
    const grouped = filteredBundles.reduce((acc: any, bundle: any) => {
        const catName = bundle.categories?.name || 'Uncategorized';
        if (!acc[catName]) acc[catName] = [];
        acc[catName].push(bundle);
        return acc;
    }, {});

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6 text-center">Our Catalog</h1>

            <ProductSearch />

            {Object.keys(grouped).length === 0 ? (
                <div className="text-center py-20 text-zinc-500">
                    <p className="text-lg">No products found matching &quot;{query}&quot;</p>
                    <Link href="/shop" className="text-blue-600 hover:underline mt-2 inline-block">
                        Clear Search
                    </Link>
                </div>
            ) : (
                Object.entries(grouped).map(([category, items]: [string, any]) => (
                    <section key={category} className="mb-12">
                        <h2 className="text-xl font-bold mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2 flex items-center gap-2">
                            {category}
                            <span className="text-xs font-normal text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{items.length}</span>
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {items.map((bundle: any) => (
                                <Link href={`/shop/bundle/${bundle.slug}`} key={bundle.id} className="group block">
                                    <div className="bg-white dark:bg-zinc-900 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                        <div className="aspect-square relative bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                            {bundle.image_urls?.[0] ? (
                                                <img
                                                    src={bundle.image_urls[0]}
                                                    alt={bundle.name}
                                                    className="object-cover w-full h-full group-hover:scale-105 transition duration-300"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-zinc-400">No Image</div>
                                            )}
                                            {bundle.type === 'configurable' && (
                                                <span className="absolute top-2 right-2 bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded">
                                                    Customizable
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-blue-600 transition-colors">{bundle.name}</h3>
                                            <p className="text-sm text-zinc-500 line-clamp-2 mt-1 min-h-[2.5em]">{bundle.description}</p>
                                            <div className="mt-3 flex items-center justify-between">
                                                <span className="text-lg font-bold">฿{bundle.price}</span>
                                                <span className="text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">View Details &rarr;</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                ))
            )}
        </div>
    );
}
