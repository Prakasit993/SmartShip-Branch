import { cache } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** Single fetch per request shared by `generateMetadata` and the Home page. */
export const getHomePageData = cache(async () => {
  const [settingsResult, featuredBundlesResult, reviewsResult] = await Promise.all([
    supabase.from('settings').select('*'),
    supabase
      .from('bundles')
      .select('*, categories(name)')
      .eq('is_active', true)
      .limit(4),
    supabase
      .from('reviews')
      .select('id, rating, comment, reviewer_name, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  return { settingsResult, featuredBundlesResult, reviewsResult };
});
