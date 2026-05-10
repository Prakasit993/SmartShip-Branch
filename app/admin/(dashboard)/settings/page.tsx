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

    return (
        <div className="w-full max-w-3xl mx-auto py-1">
            <AdminPageHeader
                className="mb-8"
                title="ตั้งค่าเว็บไซต์"
                description="หน้าแรก: หัวข้อ คำอธิบาย รูปคารูเซล (alt/title ต่อรูป) • ติดต่อ แผนที่ • ชำระเงิน"
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
