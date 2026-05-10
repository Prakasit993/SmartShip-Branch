import { supabase } from '@/lib/supabaseClient';
import { unstable_noStore as noStore } from 'next/cache';

export async function getSiteSettings(): Promise<Record<string, string>> {
    // Prevent caching to always fetch fresh settings
    noStore();
    
    const { data: settings } = await supabase.from('settings').select('*');

    // Convert settings array to object
    const settingsMap: Record<string, string> = {};
    settings?.forEach((s) => {
        const v = s.value as unknown;
        if (s.key === 'hero_images') {
            if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
                settingsMap[s.key] = JSON.stringify(v);
            } else {
                settingsMap[s.key] = v !== undefined && v !== null ? String(v) : '';
            }
            return;
        }
        settingsMap[s.key] = String(v ?? '').replace(/^"|"$/g, '');
    });

    return settingsMap;
}
