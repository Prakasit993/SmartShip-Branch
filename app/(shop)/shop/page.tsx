import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ProductSearch from '@app/components/shop/ProductSearch';
import CatalogPagination from '@app/components/shop/CatalogPagination';
import { CATALOG_PAGE_SIZE, fetchCatalogPage } from '@/lib/shop/catalogBundles';
import GhostWatermark from '@app/components/home/GhostWatermark';
import InfiniteTicker from '@app/components/home/InfiniteTicker';
import HolographicCard from '@app/components/home/HolographicCard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'สินค้าทั้งหมด',
  description:
    'รวมสินค้า IT พรีเมียม Notebook การ์ดจอ RAM หูฟัง คีย์บอร์ด — คัดสรรของแท้พร้อมรับประกัน จัดส่งด่วนทั่วไทย',
};

function displayCategory(name: string): string {
  if (name === 'Uncategorized') return 'ไม่ระบุหมวด';
  return name;
}

function formatPrice(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(n)) return n.toLocaleString('th-TH');
  return String(value ?? '');
}

const CAT_ICONS: Record<string, string> = {
  'การ์ดจอ (GPU)': '🎮',
  'Notebook': '💻',
  'RAM & Storage': '💾',
  'อุปกรณ์ Gaming': '🕹️',
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; brand?: string; pmin?: string; pmax?: string; page?: string }>;
}) {
  const { name, brand, pmin, pmax, page: pageParam } = await searchParams;

  let page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  if (!Number.isFinite(page) || page < 1) page = 1;

  const { bundles: pageBundles, totalItems } = await fetchCatalogPage({ name, brand, pmin, pmax, page });

  const totalPages = Math.max(1, Math.ceil(totalItems / CATALOG_PAGE_SIZE) || 1);
  page = Math.min(page, totalPages);

  const grouped = pageBundles.reduce((acc: Record<string, any[]>, bundle: any) => {
    const catName = bundle.categories?.name || 'Uncategorized';
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(bundle);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort((a, b) =>
    displayCategory(a).localeCompare(displayCategory(b), 'th')
  );

  const queryForPagination = {
    name: name || undefined,
    brand: brand || undefined,
    pmin: pmin || undefined,
    pmax: pmax || undefined,
  };

  return (
    <div className="home-typography bg-[var(--background)] min-h-[60vh]">

      {/* Hero Header */}
      <div className="relative overflow-hidden bg-zinc-950 dark:bg-black border-b border-zinc-800">
        {/* Ghost Watermark */}
        <GhostWatermark text="SHOP" />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-grid-zinc-800/30 [mask-image:radial-gradient(ellipse_at_center,white_20%,transparent_70%)] pointer-events-none" />
        {/* Cyan glow blob */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-32 bg-cyan-500/10 blur-3xl rounded-full" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          {/* Breadcrumb */}
          <nav aria-label="ตำแหน่งในหน้าเว็บ" className="mb-5 flex">
            <ol className="flex items-center gap-x-2 text-sm text-zinc-500">
              <li>
                <Link href="/" className="font-medium text-zinc-400 hover:text-cyan-400 transition-colors">
                  หน้าแรก
                </Link>
              </li>
              <li aria-hidden className="text-zinc-700">/</li>
              <li className="font-semibold text-white" aria-current="page">สินค้าทั้งหมด</li>
            </ol>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/30 text-cyan-400 font-mono text-[11px] tracking-[0.22em] uppercase font-bold mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                // CATALOG
              </div>
              <h1 className="home-type-section font-black text-white text-balance">
                สินค้าทั้งหมด
              </h1>
              <p className="home-type-intro text-zinc-400 mt-2 text-pretty max-w-lg">
                IT พรีเมียม — คัดสรรของแท้ทุกชิ้น ตรวจสอบแล้ว พร้อมรับประกัน
              </p>
            </div>
            {totalItems > 0 && (
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs text-zinc-500 tracking-widest uppercase">รายการทั้งหมด</p>
                <p className="font-black text-3xl text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 tabular-nums">
                  {totalItems.toLocaleString('th-TH')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ticker at bottom of header */}
        <InfiniteTicker />
      </div>

      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">

        {/* Search */}
        <div className="mb-8 sm:mb-10">
          <ProductSearch />
        </div>

        {sortedCategories.length > 0 && totalPages > 1 && (
          <CatalogPagination
            placement="top"
            page={page}
            pageSize={CATALOG_PAGE_SIZE}
            totalItems={totalItems}
            query={queryForPagination}
          />
        )}

        {/* Empty state */}
        {sortedCategories.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border-2 border-dashed border-zinc-800 bg-zinc-950/60 px-6">
            <div className="text-6xl mb-5" aria-hidden>📭</div>
            <p className="home-type-intro text-zinc-400 font-medium">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
            <p className="text-sm text-zinc-600 mt-2 mb-6">ลองเปลี่ยนคำค้นหาหรือขนาด</p>
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center justify-center px-6 py-3 rounded-full font-semibold home-type-cta bg-cyan-500 text-black hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/25"
            >
              ล้างการค้นหา
            </Link>
          </div>
        ) : (
          sortedCategories.map((category) => {
            const items = grouped[category] || [];
            const icon = CAT_ICONS[category] ?? '📦';
            return (
              <section
                key={category}
                id={`cat-${encodeURIComponent(category)}`}
                className="mb-14 scroll-mt-28 last:mb-4"
              >
                {/* Category heading */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    {/* Icon badge */}
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/30 flex items-center justify-center text-xl shrink-0">
                      {icon}
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                        {displayCategory(category)}
                      </h2>
                      {/* Neon underline */}
                      <div className="h-0.5 w-12 mt-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                    </div>
                  </div>
                  <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-zinc-800 px-3 py-1 rounded-full tabular-nums">
                    {items.length} รายการ
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
                  {items.map((bundle: any) => (
                    <HolographicCard key={bundle.id} className="rounded-2xl sm:rounded-3xl h-full">
                      <Link href={`/shop/bundle/${bundle.slug}`} className="group block h-full">
                        <article className="h-full flex flex-col bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-transparent group-hover:border-cyan-400/80 dark:group-hover:border-cyan-500/50 shadow-md group-hover:shadow-xl group-hover:shadow-cyan-500/10 transition-all duration-200">

                          {/* Image */}
                          <div className="aspect-square relative bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            {bundle.image_urls?.[0] ? (
                              <Image
                                src={bundle.image_urls[0]}
                                alt={bundle.name?.trim() ? `${bundle.name.trim()} — ภาพสินค้า` : 'สินค้า'}
                                title={bundle.name?.trim() || undefined}
                                fill
                                loading="lazy"
                                decoding="async"
                                quality={75}
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 33vw, 25vw"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 gap-2 p-4">
                                <span className="text-4xl" aria-hidden>📦</span>
                                <span className="text-xs">ยังไม่มีรูป</span>
                              </div>
                            )}

                            {/* Type badge */}
                            {bundle.type === 'configurable' && (
                              <span className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full shadow-md">
                                ปรับแต่งได้
                              </span>
                            )}

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                              <span className="bg-cyan-500 text-black text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-cyan-500/40">
                                ดูรายละเอียด →
                              </span>
                            </div>
                          </div>

                          {/* Info */}
                          <div className="p-3 sm:p-4 flex-1 flex flex-col">
                            <h3 className="home-type-product-name font-bold line-clamp-2 text-zinc-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                              {bundle.name}
                            </h3>
                            {bundle.description?.trim() && (
                              <p className="home-type-body-muted text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1.5 min-h-[2.5rem] text-pretty">
                                {bundle.description}
                              </p>
                            )}
                            <div className="mt-auto pt-3 flex items-end justify-between gap-2">
                              <span className="home-type-price font-black bg-gradient-to-r from-cyan-500 to-blue-500 dark:from-cyan-300 dark:to-cyan-500 bg-clip-text text-transparent">
                                ฿{formatPrice(bundle.price)}
                              </span>
                              {/* Neon dot indicator */}
                              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                            </div>
                          </div>

                        </article>
                      </Link>
                    </HolographicCard>
                  ))}
                </div>
              </section>
            );
          })
        )}

        {sortedCategories.length > 0 && (
          <CatalogPagination
            page={page}
            pageSize={CATALOG_PAGE_SIZE}
            totalItems={totalItems}
            query={queryForPagination}
          />
        )}
      </div>
    </div>
  );
}
