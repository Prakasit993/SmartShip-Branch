import Link from 'next/link';

type CatalogPaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  query: Record<string, string | undefined>;
  /** ด้านบนผลลัพธ์ = เส้นแบ่งล่าง; ด้านล่าง = เส้นแบ่งบน */
  placement?: 'top' | 'bottom';
};

/** สร้างลิงก์ `/shop` พร้อมตัวกรองและหน้า (หน้า 1 ไม่ใส่ query เพื่อ URL สะอาด) */
export function catalogPageHref(
  query: Record<string, string | undefined>,
  targetPage: number
): string {
  const sp = new URLSearchParams();
  if (query.name) sp.set('name', query.name);
  if (query.w) sp.set('w', query.w);
  if (query.l) sp.set('l', query.l);
  if (query.h) sp.set('h', query.h);
  if (targetPage > 1) sp.set('page', String(targetPage));
  const s = sp.toString();
  return s ? `/shop?${s}` : '/shop';
}

const DELTA = 2;

/** แถบเลขหน้าแบบมีจุดไข่ปลา (ตามแพทเทิร์นที่พบบ่อยใน UI kit) */
function pageNumberItems(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 1) return [1];
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const range: number[] = [];
  const left = current - DELTA;
  const right = current + DELTA + 1;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= left && i < right)) {
      range.push(i);
    }
  }

  const withEllipsis: (number | 'ellipsis')[] = [];
  let prev: number | undefined;

  for (const i of range) {
    if (prev !== undefined) {
      if (i - prev === 2) {
        withEllipsis.push(prev + 1);
      } else if (i - prev !== 1) {
        withEllipsis.push('ellipsis');
      }
    }
    withEllipsis.push(i);
    prev = i;
  }

  return withEllipsis;
}

export default function CatalogPagination({
  page,
  pageSize,
  totalItems,
  query,
  placement = 'bottom',
}: CatalogPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  const isTop = placement === 'top';
  const navClass = isTop
    ? 'mb-8 flex flex-col gap-4 border-b border-zinc-200 pb-8 dark:border-zinc-800'
    : 'mt-12 flex flex-col gap-4 border-t border-zinc-200 pt-10 dark:border-zinc-800';

  const summary = (
    <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
      {totalItems === 0 ? (
        <>ไม่มีรายการในหน้านี้</>
      ) : (
        <>
          แสดง {startItem.toLocaleString('th-TH')}–{endItem.toLocaleString('th-TH')} จาก{' '}
          {totalItems.toLocaleString('th-TH')} รายการ
          {totalPages > 1 && (
            <>
              {' '}
              · หน้า {page.toLocaleString('th-TH')} / {totalPages.toLocaleString('th-TH')}
            </>
          )}
        </>
      )}
    </p>
  );

  /** หนึ่งหน้าเดียว = ไม่ต้องมีแถบนำทาง (ให้หัวข้อหน้าแสดงจำนวนแทน) */
  if (totalPages <= 1) {
    return null;
  }

  const items = pageNumberItems(page, totalPages);

  const btnBase =
    'inline-flex min-h-10 items-center justify-center rounded-full border px-3 py-2 text-sm font-semibold transition-colors';
  const btnActive =
    `${btnBase} border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`;
  const btnGhost =
    'inline-flex min-h-10 cursor-not-allowed items-center rounded-full border border-transparent px-3 py-2 text-sm text-zinc-400 opacity-60';

  const jumpId = `catalog-page-jump-${placement}`;

  return (
    <nav className={navClass} aria-label="แบ่งหน้ารายการสินค้า">
      {summary}

      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          {page > 1 ? (
            <Link
              href={catalogPageHref(query, 1)}
              className={`${btnActive} shrink-0 px-3 sm:px-4`}
              aria-label="หน้าแรก"
            >
              « แรก
            </Link>
          ) : (
            <span className={`${btnGhost} shrink-0`} aria-hidden>
              « แรก
            </span>
          )}

          {page > 1 ? (
            <Link href={catalogPageHref(query, page - 1)} className={`${btnActive} shrink-0`}>
              ← ก่อนหน้า
            </Link>
          ) : (
            <span className={`${btnGhost} shrink-0`}>← ก่อนหน้า</span>
          )}

          <div
            className="flex flex-wrap items-center justify-center gap-1"
            role="group"
            aria-label="เลขหน้า"
          >
            {items.map((item, idx) =>
              item === 'ellipsis' ? (
                <span
                  key={`e-${idx}`}
                  className="flex min-h-10 min-w-10 items-center justify-center text-zinc-400"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <Link
                  key={item}
                  href={catalogPageHref(query, item)}
                  className={`flex min-h-10 min-w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    item === page
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30'
                      : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                  aria-current={item === page ? 'page' : undefined}
                >
                  {item.toLocaleString('th-TH')}
                </Link>
              )
            )}
          </div>

          {page < totalPages ? (
            <Link href={catalogPageHref(query, page + 1)} className={`${btnActive} shrink-0`}>
              ถัดไป →
            </Link>
          ) : (
            <span className={`${btnGhost} shrink-0`}>ถัดไป →</span>
          )}

          {page < totalPages ? (
            <Link
              href={catalogPageHref(query, totalPages)}
              className={`${btnActive} shrink-0 px-3 sm:px-4`}
              aria-label="หน้าสุดท้าย"
            >
              สุดท้าย »
            </Link>
          ) : (
            <span className={`${btnGhost} shrink-0`} aria-hidden>
              สุดท้าย »
            </span>
          )}
        </div>

        <form
          method="get"
          action="/shop"
          className="flex flex-wrap items-center justify-center gap-2 text-sm"
          role="search"
          aria-label="ไปยังหน้าที่ต้องการ"
        >
          {query.name ? <input type="hidden" name="name" value={query.name} /> : null}
          {query.w ? <input type="hidden" name="w" value={query.w} /> : null}
          {query.l ? <input type="hidden" name="l" value={query.l} /> : null}
          {query.h ? <input type="hidden" name="h" value={query.h} /> : null}

          <label htmlFor={jumpId} className="text-zinc-600 dark:text-zinc-400">
            ไปที่หน้า
          </label>
          <input
            id={jumpId}
            name="page"
            type="number"
            inputMode="numeric"
            min={1}
            max={totalPages}
            defaultValue={page}
            required
            className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-center text-sm font-semibold tabular-nums text-zinc-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            aria-describedby={`${jumpId}-hint`}
          />
          <span id={`${jumpId}-hint`} className="text-zinc-500 dark:text-zinc-400 tabular-nums">
            / {totalPages.toLocaleString('th-TH')}
          </span>
          <button
            type="submit"
            className="inline-flex min-h-10 items-center rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition-colors hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            ไป
          </button>
        </form>
      </div>
    </nav>
  );
}
