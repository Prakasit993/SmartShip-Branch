import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client — **สร้างแบบ lazy** เพื่อไม่ให้ throw ตอนโหลดโมดูลถ้า env ยังไม่พร้อม
 * (ป้องกัน Route Handler คืนหน้า HTML error แทน JSON)
 */
let singleton: SupabaseClient | null = null;

function getSupabaseAdminClient(): SupabaseClient {
    if (singleton) return singleton;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Missing Supabase environment variables for Admin client');
    }
    singleton = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return singleton;
}

/** Proxy — import ไม่ throw; เรียกใช้งานครั้งแรกถึงจะตรวจ env */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
    get(_target, prop, _receiver) {
        const client = getSupabaseAdminClient();
        const value = Reflect.get(client, prop, client);
        return typeof value === 'function' ? value.bind(client) : value;
    },
});
