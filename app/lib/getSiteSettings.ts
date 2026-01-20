import { supabase } from '@/lib/supabaseClient';

export async function getSiteSettings(): Promise<Record<string, string>> {
    const { data: settings } = await supabase.from('settings').select('*');

    // Convert settings array to object
    const settingsMap: Record<string, string> = {};
    settings?.forEach((s) => {
        // Remove quotes from JSON string if simple string
        settingsMap[s.key] = String(s.value).replace(/^"|"$/g, '');
    });

    return settingsMap;
}
