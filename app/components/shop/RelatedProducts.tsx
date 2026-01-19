'use client';

import Link from 'next/link';
import { useLanguage } from '@app/context/LanguageContext';

interface RelatedProduct {
    id: number;
    name: string;
    price: number;
    image_urls: string[] | null;
    slug?: string;
}

interface RelatedProductsProps {
    products: RelatedProduct[];
    currentId: number;
}

export default function RelatedProducts({ products, currentId }: RelatedProductsProps) {
    const { language } = useLanguage();

    // Filter out current product and limit to 4
    const relatedItems = products
        .filter(p => p.id !== currentId)
        .slice(0, 4);

    if (relatedItems.length === 0) return null;

    return (
        <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                <span>🔗</span>
                {language === 'th' ? 'สินค้าที่เกี่ยวข้อง' : 'Related Products'}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {relatedItems.map((product) => (
                    <Link
                        key={product.id}
                        href={`/shop/${product.slug || product.id}`}
                        className="group bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-lg transition-all hover:border-blue-300 dark:hover:border-blue-800"
                    >
                        {/* Image */}
                        <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                            {product.image_urls?.[0] ? (
                                <img
                                    src={product.image_urls[0]}
                                    alt={product.name}
                                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-400 text-4xl">
                                    📦
                                </div>
                            )}
                        </div>

                        {/* Info */}
                        <div className="p-3">
                            <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                                {product.name}
                            </h3>
                            <p className="text-blue-600 dark:text-blue-400 font-bold mt-1">
                                ฿{product.price.toLocaleString()}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
