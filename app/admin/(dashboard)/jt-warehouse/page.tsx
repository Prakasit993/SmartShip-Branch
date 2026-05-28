import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import ToastListener from '@app/admin/components/ToastListener';
import { JtParcelN8nUpload } from './JtParcelN8nUpload';
import { BranchStaffView } from './BranchStaffView';

export const dynamic = 'force-dynamic';

type BranchSummary = {
    delivery_branch_code: string;
    delivery_branch_name: string | null;
    parcel_count: number;
    staff_count: number;
    delivered_count: number;
    pending_count: number;
    stuck_count: number;
};

type StaffSummary = {
    delivery_branch_code: string;
    delivery_branch_name: string | null;
    delivery_staff_id: string;
    delivery_staff_name: string | null;
    delivery_staff_position: string | null;
    delivery_staff_phone: string | null;
    parcel_count: number;
    delivered_count: number;
    pending_count: number;
    stuck_count: number;
    cod_total: number;
};

type LastUploadMeta = {
    last_uploaded_at: string | null;
    total_parcels: number;
    branch_count: number;
    staff_count: number;
};

export default async function JtWarehousePage() {
    const [branchRes, staffRes, metaRes] = await Promise.all([
        supabaseAdmin.rpc('get_warehouse_jt_branch_summary'),
        supabaseAdmin.rpc('get_warehouse_jt_branch_staff_summary'),
        supabaseAdmin.from('warehouse_jt_last_upload').select('*').maybeSingle(),
    ]);

    const branches: BranchSummary[] = (branchRes.data ?? []) as BranchSummary[];
    const staff: StaffSummary[] = (staffRes.data ?? []) as StaffSummary[];
    const meta: LastUploadMeta = (metaRes.data ?? {
        last_uploaded_at: null,
        total_parcels: 0,
        branch_count: 0,
        staff_count: 0,
    }) as LastUploadMeta;

    const anyError = branchRes.error || staffRes.error || metaRes.error;

    return (
        <div className="space-y-6 pb-20">
            <ToastListener />
            <AdminPageHeader
                title="คลังพัสดุ J&T"
                description="สรุปจำนวนพัสดุแยกตามสาขาและพนักงานนำจ่าย — อัปโหลดไฟล์ได้ที่ปุ่มมุมขวา"
                titleLeft={<span aria-hidden>📦</span>}
                actions={<JtParcelN8nUpload />}
            />

            {anyError ? (
                <div className="rounded-xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-sm text-red-200">
                    โหลดข้อมูลล้มเหลว: {anyError.message}
                </div>
            ) : null}

            <BranchStaffView
                branches={branches}
                staff={staff}
                meta={meta}
            />
        </div>
    );
}
