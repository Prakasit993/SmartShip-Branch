import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { DeepDiveAiAssistant } from './DeepDiveAiAssistant';
import { DeepDiveDashboardTabs } from './DeepDiveDashboardTabs';

export const dynamic = 'force-dynamic';

export default function JtDeepDiveDashboardPage() {
    return (
        <div className="space-y-6 pb-20">
            <AdminPageHeader
                title="วิเคราะห์เชิงลึก"
                description="แยกมุมมองกำไรและการจัดส่งออกเป็นแท็บ เพื่อให้ดูตัวเลขสำคัญได้ชัดเจนและไม่รกเกินไป"
                tone="dark"
                meta={
                    <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/30">
                        Deep Dive
                    </span>
                }
            />

            <DeepDiveAiAssistant />
            <DeepDiveDashboardTabs />
        </div>
    );
}
