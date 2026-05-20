import { supabase } from '@/lib/supabaseClient';

export const CATALOG_PAGE_SIZE = 24;

export function escapeIlikePattern(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
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

function applyNameOrFilter(q: any, name?: string): any {
  if (!name?.trim()) return q;
  const pat = `%${escapeIlikePattern(name.trim().replace(/,/g, ' '))}%`;
  return q.or(`name.ilike.${pat},description.ilike.${pat},sku.ilike.${pat},slug.ilike.${pat}`);
}

function applyBrandFilter(q: any, brand?: string): any {
  if (!brand?.trim()) return q;
  const pat = `%${escapeIlikePattern(brand.trim())}%`;
  return q.or(`name.ilike.${pat},description.ilike.${pat}`);
}

async function fetchCatalogBundlesFromDb(params: {
  name?: string;
  brand?: string;
  pmin?: string;
  pmax?: string;
  page: number;
  pageSize: number;
}): Promise<{ bundles: any[]; totalItems: number }> {
  const { name, brand, pmin, pmax, page, pageSize } = params;

  const buildBase = () => {
    let q = supabase.from('bundles').select('*', { count: 'exact', head: false }).eq('is_active', true);
    q = applyNameOrFilter(q, name);
    q = applyBrandFilter(q, brand);
    if (pmin && !isNaN(Number(pmin))) q = q.gte('price', Number(pmin));
    if (pmax && !isNaN(Number(pmax))) q = q.lte('price', Number(pmax));
    return q;
  };

  const { count: totalCount, error: countErr } = await buildBase()
    .select('*', { count: 'exact', head: true });
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
  dataQ = applyBrandFilter(dataQ, brand);
  if (pmin && !isNaN(Number(pmin))) dataQ = dataQ.gte('price', Number(pmin));
  if (pmax && !isNaN(Number(pmax))) dataQ = dataQ.lte('price', Number(pmax));

  const { data, error } = await dataQ
    .order('sort_order', { foreignTable: 'categories', ascending: true })
    .order('id', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('[catalogBundles] paged query:', error.message);
    return { bundles: [], totalItems: 0 };
  }

  return { bundles: data ?? [], totalItems };
}

export type CatalogFetchParams = {
  name?: string;
  brand?: string;
  pmin?: string;
  pmax?: string;
  page: number;
  pageSize?: number;
};

export async function fetchCatalogPage(
  params: CatalogFetchParams
): Promise<{ bundles: any[]; totalItems: number }> {
  const pageSize = params.pageSize ?? CATALOG_PAGE_SIZE;
  const page = Math.max(1, params.page);
  return fetchCatalogBundlesFromDb({ ...params, page, pageSize });
}
