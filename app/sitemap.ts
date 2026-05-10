import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';
import { supabase } from '@/lib/supabaseClient';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl().origin;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/shop/packing-quote`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/privacy-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/cookie-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const { data: bundles } = await supabase
    .from('bundles')
    .select('slug, created_at')
    .eq('is_active', true);

  const bundleRoutes: MetadataRoute.Sitemap =
    bundles?.map((b) => ({
      url: `${base}/shop/bundle/${b.slug}`,
      lastModified: b.created_at ? new Date(b.created_at as string) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })) ?? [];

  return [...staticRoutes, ...bundleRoutes];
}
