import { supabase } from '@/lib/supabaseClient';

export const CATALOG_PAGE_SIZE = 24;

/** หลีกเลี่ยงตัวพิเศษของ SQL LIKE / ILIKE */
export function escapeIlikePattern(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function hasDimensionFilters(w?: string, l?: string, h?: string): boolean {
  return Boolean(w?.trim() || l?.trim() || h?.trim());
}

function displayCategory(name: string): string {
  if (name === 'Uncategorized') return 'ไม่ระบุหมวด';
  return name;
}

export function compareBundles(a: any, b: any): number {
  const ca = displayCategory(a.categories?.name || 'Uncategorized');
  const cb = displayCategory(b.categories?.name || 'Uncategorized');
  const byCat = ca.localeCompare(cb, 'th');
  if (byCat !== 0) return byCat;
  const ao = Number(a.sort_order ?? a.id ?? 0);
  const bo = Number(b.sort_order ?? b.id ?? 0);
  return ao - bo;
}

function applyNameFilter(bundles: any[], name: string): any[] {
  const lowerName = name.toLowerCase();
  return bundles.filter(
    (b: any) =>
      b.name?.toLowerCase().includes(lowerName) ||
      b.description?.toLowerCase().includes(lowerName) ||
      b.sku?.toLowerCase().includes(lowerName) ||
      b.slug?.toLowerCase().includes(lowerName)
  );
}

function applyDimensionFilters(bundles: any[], w?: string, l?: string, h?: string): any[] {
  const dimensionFilters = [w, l, h].filter(Boolean);
  if (dimensionFilters.length === 0) return bundles;

  return bundles.filter((b: any) => {
    const dbW = b.width_cm ? Number(b.width_cm) : 0;
    const dbL = b.length_cm ? Number(b.length_cm) : 0;
    const dbH = b.height_cm ? Number(b.height_cm) : 0;
    const hasValidDims = dbW > 0 || dbL > 0 || dbH > 0;

    if (hasValidDims) {
      const wVal = w && !isNaN(parseFloat(w)) ? parseFloat(w) : null;
      const lVal = l && !isNaN(parseFloat(l)) ? parseFloat(l) : null;
      const hVal = h && !isNaN(parseFloat(h)) ? parseFloat(h) : null;
      const fitsW = wVal === null || dbW >= wVal;
      const fitsL = lVal === null || dbL >= lVal;
      const fitsH = hVal === null || dbH >= hVal;
      return fitsW && fitsL && fitsH;
    }
    const searchText = `${b.name || ''} ${b.description || ''} ${b.slug || ''}`;
    return dimensionFilters.every((dim) => searchText.includes(dim!));
  });
}

/**
 * โหลดทั้งหมดแล้วกรอง/เรียง/แบ่งหน้าในหน่วยความจำ — ใช้เมื่อมีตัวกรองขนาด (ตรรกะข้อความสำรอง)
 */
async function fetchCatalogBundlesInMemory(params: {
  name?: string;
  w?: string;
  l?: string;
  h?: string;
  page: number;
  pageSize: number;
}): Promise<{ bundles: any[]; totalItems: number }> {
  const { name, w, l, h, page, pageSize } = params;

  const { data: bundles, error } = await supabase
    .from('bundles')
    .select('*, categories(*)')
    .eq('is_active', true)
    .order('sort_order', { foreignTable: 'categories' });

  if (error) {
    console.error('[catalogBundles] fetch all:', error.message);
    return { bundles: [], totalItems: 0 };
  }

  let rows = bundles || [];
  if (name?.trim()) rows = applyNameFilter(rows, name.trim());
  rows = applyDimensionFilters(rows, w, l, h);

  const sorted = [...rows].sort(compareBundles);
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const sliceStart = (safePage - 1) * pageSize;

  return {
    bundles: sorted.slice(sliceStart, sliceStart + pageSize),
    totalItems,
  };
}

/** เพิ่มเงื่อนไขค้นหาชื่อ/รายละเอียด/SKU/slug แบบ ilike */
function applyNameOrFilter(q: any, name?: string): any {
  if (!name?.trim()) return q;
  const commaSanitized = name.trim().replace(/,/g, ' ');
  const pat = `%${escapeIlikePattern(commaSanitized)}%`;
  return q.or(`name.ilike.${pat},description.ilike.${pat},sku.ilike.${pat},slug.ilike.${pat}`);
}

/**
 * แบ่งหน้าที่ฝั่ง Supabase (นับก่อน แล้ว range ที่หน้าที่ถูก clamp) — เมื่อไม่มีตัวกรองขนาด w/l/h
 */
async function fetchCatalogBundlesFromDb(params: {
  name?: string;
  page: number;
  pageSize: number;
}): Promise<{ bundles: any[]; totalItems: number }> {
  const { name, page, pageSize } = params;

  let countQ = supabase.from('bundles').select('*', { count: 'exact', head: true }).eq('is_active', true);
  countQ = applyNameOrFilter(countQ, name);

  const { count: totalCount, error: countErr } = await countQ;
  if (countErr) {
    console.error('[catalogBundles] count:', countErr.message);
    return { bundles: [], totalItems: 0 };
  }

  const totalItems = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  let dataQ = supabase.from('bundles').select('*, categories(*)').eq('is_active', true);
  dataQ = applyNameOrFilter(dataQ, name);

  const { data, error } = await dataQ
    .order('sort_order', { foreignTable: 'categories', ascending: true })
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('[catalogBundles] paged query:', error.message);
    return { bundles: [], totalItems: 0 };
  }

  return {
    bundles: data ?? [],
    totalItems,
  };
}

export type CatalogFetchParams = {
  name?: string;
  w?: string;
  l?: string;
  h?: string;
  page: number;
  pageSize?: number;
};

/**
 * คืนรายการสินค้าของหน้าปัจจุบันและจำนวนทั้งหมดที่ตรงเงื่อนไข
 */
export async function fetchCatalogPage(
  params: CatalogFetchParams
): Promise<{ bundles: any[]; totalItems: number }> {
  const pageSize = params.pageSize ?? CATALOG_PAGE_SIZE;
  const page = Math.max(1, params.page);

  if (hasDimensionFilters(params.w, params.l, params.h)) {
    return fetchCatalogBundlesInMemory({ ...params, page, pageSize });
  }

  return fetchCatalogBundlesFromDb({
    name: params.name,
    page,
    pageSize,
  });
}
