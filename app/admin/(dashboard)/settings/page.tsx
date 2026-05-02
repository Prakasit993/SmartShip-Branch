import { supabase } from '@/lib/supabaseClient';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
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
        <div className="w-full max-w-3xl mx-auto py-1">
            <AdminPageHeader
                className="mb-8"
                title="ตั้งค่าเว็บไซต์"
                description="จัดการข้อมูลหน้าแรก, ข้อมูลติดต่อ, และการตั้งค่าอื่นๆ"
                titleLeft={<span aria-hidden>⚙️</span>}
            />

            <SettingsForm
                initialSettings={settingsMap}
                saved={params.saved === '1'}
                error={params.error === '1'}
            />
        </div>
    );
}
