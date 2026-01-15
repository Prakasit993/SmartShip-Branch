import { supabase } from '@/lib/supabaseClient';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
    searchParams,
}: {
    searchParams: Promise<{ saved?: string; error?: string }>;
}) {
    const params = await searchParams;
    const { data: settings } = await supabase.from('settings').select('*');

    // Convert settings array to object
    const settingsMap: Record<string, string> = {};
    settings?.forEach(s => {
        // Remove quotes from JSON string if simple string
        settingsMap[s.key] = String(s.value).replace(/^"|"$/g, '');
    });

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">⚙️ ตั้งค่าเว็บไซต์</h1>
                <p className="text-zinc-400 mt-1">จัดการข้อมูลหน้าแรก, ข้อมูลติดต่อ, และการตั้งค่าอื่นๆ</p>
            </div>

            <SettingsForm
                initialSettings={settingsMap}
                saved={params.saved === '1'}
                error={params.error === '1'}
            />
        </div>
    );
}
