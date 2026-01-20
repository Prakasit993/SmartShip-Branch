import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import ProductSearch from '@app/components/shop/ProductSearch';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
    searchParams,
}: {
    searchParams: Promise<{ name?: string; w?: string; l?: string; h?: string }>;
}) {
    const { name, w, l, h } = await searchParams;

    let supabaseQuery = supabase
        .from('bundles')
        .select('*, categories(*)')
        .eq('is_active', true)
        .order('sort_order', { foreignTable: 'categories' });

    const { data: bundles, error } = await supabaseQuery;

    let filteredBundles = bundles || [];

    // Filter by name
    if (name) {
        const lowerName = name.toLowerCase();
        filteredBundles = filteredBundles.filter((b: any) =>
            b.name?.toLowerCase().includes(lowerName) ||
            b.description?.toLowerCase().includes(lowerName) ||
            b.sku?.toLowerCase().includes(lowerName) ||
            b.slug?.toLowerCase().includes(lowerName)
        );
    }

    // Filter by dimensions
    const dimensionFilters = [w, l, h].filter(Boolean);
    if (dimensionFilters.length > 0) {
        filteredBundles = filteredBundles.filter((b: any) => {
            // Parse DB values
            const dbW = b.width_cm ? Number(b.width_cm) : 0;
            const dbL = b.length_cm ? Number(b.length_cm) : 0;
            const dbH = b.height_cm ? Number(b.height_cm) : 0;

            // Check if this bundle has valid dimensions data (to avoid filtering out legacy items)
            const hasValidDims = dbW > 0 || dbL > 0 || dbH > 0;

            if (hasValidDims) {
                // Use GTE (Fit logic: Box >= Input)
                // If input is null/invalid, it matches (ignore that dimension)
                const wVal = w && !isNaN(parseFloat(w)) ? parseFloat(w) : null;
                const lVal = l && !isNaN(parseFloat(l)) ? parseFloat(l) : null;
                const hVal = h && !isNaN(parseFloat(h)) ? parseFloat(h) : null;

                const fitsW = wVal === null || dbW >= wVal;
                const fitsL = lVal === null || dbL >= lVal;
                const fitsH = hVal === null || dbH >= hVal;

                return fitsW && fitsL && fitsH;
            } else {
                // Fallback: Text matching for legacy data
                const searchText = `${b.name || ''} ${b.description || ''} ${b.slug || ''}`;
                return dimensionFilters.every(dim => searchText.includes(dim!));
            }
        });
    }

    const hasFilters = name || w || l || h;

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
                    <p className="text-lg">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
                    <Link href="/shop" className="text-blue-600 hover:underline mt-2 inline-block">
                        ล้างการค้นหา
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
