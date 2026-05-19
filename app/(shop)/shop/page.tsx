import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ProductSearch from '@app/components/shop/ProductSearch';
import CatalogPagination from '@app/components/shop/CatalogPagination';
import { CATALOG_PAGE_SIZE, fetchCatalogPage } from '@/lib/shop/catalogBundles';

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

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; w?: string; l?: string; h?: string; page?: string }>;
}) {
  const { name, w, l, h, page: pageParam } = await searchParams;

  let page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
  if (!Number.isFinite(page) || page < 1) page = 1;

  const { bundles: pageBundles, totalItems } = await fetchCatalogPage({
    name,
    w,
    l,
    h,
    page,
  });

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
    w: w || undefined,
    l: l || undefined,
    h: h || undefined,
  };

  return (
    <div className="home-typography bg-[var(--background)] min-h-[60vh]">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-12">
        <header className="mb-8 sm:mb-10 lg:mb-12 max-w-2xl mx-auto text-center">
          <nav aria-label="ตำแหน่งในหน้าเว็บ" className="mb-4 flex justify-center">
            <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              <li>
                <Link
                  href="/"
                  className="font-medium text-zinc-600 underline-offset-4 transition-colors hover:text-cyan-600 hover:underline dark:text-zinc-300 dark:hover:text-cyan-400"
                >
                  หน้าแรก
                </Link>
              </li>
              <li aria-hidden className="select-none text-zinc-300 dark:text-zinc-600">
                /
              </li>
              <li className="font-semibold text-zinc-800 dark:text-zinc-100" aria-current="page">
                สินค้าทั้งหมด
              </li>
            </ol>
          </nav>
          <p className="inline-block px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300 font-semibold home-type-badge-pill mb-3">
            แคตตาล็อก
          </p>
          <h1 className="home-type-section font-black text-zinc-900 dark:text-white text-balance">
            สินค้าทั้งหมด
          </h1>
          <p className="home-type-intro text-zinc-500 dark:text-zinc-400 mt-3 text-pretty">
            เลือกชุดกล่องและอุปกรณ์แพ็คที่เหมาะกับคุณ — ค้นหาตามชื่อหรือขนาดได้จากช่องด้านล่าง
          </p>
          {totalItems > 0 && (
            <p className="mt-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-300">
              พบ {totalItems.toLocaleString('th-TH')} รายการ
              {totalPages > 1 && (
                <span className="text-zinc-400 dark:text-zinc-500">
                  {' '}
                  · แบ่งเป็น {totalPages.toLocaleString('th-TH')} หน้า (หน้าละไม่เกิน{' '}
                  {CATALOG_PAGE_SIZE.toLocaleString('th-TH')} รายการ)
                </span>
              )}
            </p>
          )}
        </header>

        <ProductSearch />

        {sortedCategories.length > 0 && totalPages > 1 && (
          <CatalogPagination
            placement="top"
            page={page}
            pageSize={CATALOG_PAGE_SIZE}
            totalItems={totalItems}
            query={queryForPagination}
          />
        )}

        {sortedCategories.length === 0 ? (
          <div className="text-center py-16 sm:py-24 rounded-2xl sm:rounded-3xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/40 px-6">
            <div className="text-5xl mb-4" aria-hidden>
              📭
            </div>
            <p className="home-type-intro text-zinc-600 dark:text-zinc-400 font-medium">
              ไม่พบสินค้าที่ตรงกับเงื่อนไข
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2 mb-6">
              ลองเปลี่ยนคำค้นหาหรือขนาดกล่อง แล้วค้นหาใหม่
            </p>
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center justify-center px-6 py-3 rounded-full font-semibold home-type-cta bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 shadow-lg shadow-blue-500/25"
            >
              ล้างการค้นหา
            </Link>
          </div>
        ) : (
          sortedCategories.map((category) => {
            const items = grouped[category] || [];
            return (
              <section
                key={category}
                id={`cat-${encodeURIComponent(category)}`}
                className="mb-10 sm:mb-14 scroll-mt-28 last:mb-4"
              >
                <div className="flex flex-wrap items-end justify-between gap-3 mb-5 pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                    {displayCategory(category)}
                  </h2>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full tabular-nums">
                    {items.length} รายการ
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
                  {items.map((bundle: any) => (
                    <Link href={`/shop/bundle/${bundle.slug}`} key={bundle.id} className="group block h-full">
                      <article className="h-full flex flex-col bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-transparent hover:border-cyan-400/80 dark:hover:border-cyan-500/50 shadow-md hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1 transition-all duration-200">
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
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 33vw, 25vw"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-400 dark:text-zinc-500 text-sm gap-2 p-4">
                              <span className="text-3xl" aria-hidden>
                                📦
                              </span>
                              <span>ยังไม่มีรูป</span>
                            </div>
                          )}
                          {bundle.type === 'configurable' && (
                            <span className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full shadow-md">
                              ปรับแต่งได้
                            </span>
                          )}
                        </div>

                        <div className="p-3 sm:p-4 flex-1 flex flex-col">
                          <h3 className="home-type-product-name font-bold line-clamp-2 text-zinc-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                            {bundle.name}
                          </h3>
                          <p className="home-type-body-muted text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1.5 min-h-[2.75rem] text-pretty">
                            {bundle.description?.trim() ? bundle.description : ''}
                          </p>
                          <div className="mt-auto pt-3 flex items-end justify-between gap-2">
                            <span className="home-type-price font-black bg-gradient-to-r from-cyan-500 to-blue-500 dark:from-cyan-300 dark:to-cyan-500 bg-clip-text text-transparent">
                              ฿{formatPrice(bundle.price)}
                            </span>
                            <span className="text-cyan-600 dark:text-cyan-400 text-xs sm:text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
                              ดูรายละเอียด →
                            </span>
                          </div>
                        </div>
                      </article>
                    </Link>
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
