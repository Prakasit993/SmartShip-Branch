import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import ToastListener from '@app/admin/components/ToastListener';
import { JtParcelN8nUpload } from './JtParcelN8nUpload';

export const dynamic = 'force-dynamic';

export default function JtWarehousePage() {
    return (
        <div className="space-y-6 pb-20">
            <ToastListener />
            <AdminPageHeader
                title="คลังพัสดุ J&T"
                description="นำเข้าข้อมูลพัสดุ J&T จากไฟล์ Excel หรือ CSV"
                titleLeft={<span aria-hidden>📦</span>}
                actions={<JtParcelN8nUpload />}
            />
        </div>
    );
}
