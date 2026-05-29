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

type CodBucket = { label: string; count: number; sum: number };
export type CodSummary = {
    branch_code: string;
    pending_total: number;
    pending_count: number;
    buckets: {
        low: CodBucket;
        mid: CodBucket;
        high: CodBucket;
        very_high: CodBucket;
    };
};

type AlertCounter = { count: number; cod_sum: number };
export type AlertSummary = {
    branch_code: string;
    pending: AlertCounter;
    stuck: AlertCounter;
    problem: AlertCounter;
};

export type DateRange = 'today' | 'all';

// คืน YYYY-MM-DD ของวันนี้ใน Asia/Bangkok (ไม่พึ่ง browser TZ)
function bangkokToday(): string {
    // 'sv-SE' locale ให้ format ISO YYYY-MM-DD ที่ครอบคลุมทุก timezone
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
}

type Props = {
    searchParams: Promise<{ range?: string }>;
};

export default async function JtWarehousePage({ searchParams }: Props) {
    const { range: rangeRaw } = await searchParams;
    const range: DateRange = rangeRaw === 'all' ? 'all' : 'today';
    const today = bangkokToday();
    const dateParams = range === 'today'
        ? { p_date_from: today, p_date_to: today }
        : {};

    const [branchRes, staffRes, metaRes] = await Promise.all([
        supabaseAdmin.rpc('get_warehouse_jt_branch_summary', dateParams),
        supabaseAdmin.rpc('get_warehouse_jt_branch_staff_summary', dateParams),
        // meta ใช้ live view ที่อ่านจาก parcels โดยตรง — ไม่ filter ตาม range เพราะเป็น health indicator ทั้งระบบ
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

    // Pre-fetch COD summary + Alert summary ของทุก branch ขนานกัน
    const perBranchData = await Promise.all(
        branches.map(async (b) => {
            const [codRes, alertRes] = await Promise.all([
                supabaseAdmin.rpc('get_warehouse_jt_cod_summary', {
                    p_delivery_branch_code: b.delivery_branch_code,
                    ...dateParams,
                }),
                supabaseAdmin.rpc('get_warehouse_jt_alert_summary', {
                    p_delivery_branch_code: b.delivery_branch_code,
                    ...dateParams,
                }),
            ]);
            return {
                code: b.delivery_branch_code,
                cod: codRes.data as CodSummary,
                alert: alertRes.data as AlertSummary,
            };
        }),
    );
    const codSummaryByBranch: Record<string, CodSummary> = Object.fromEntries(
        perBranchData.map((d) => [d.code, d.cod]),
    );
    const alertSummaryByBranch: Record<string, AlertSummary> = Object.fromEntries(
        perBranchData.map((d) => [d.code, d.alert]),
    );

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
                codSummaryByBranch={codSummaryByBranch}
                alertSummaryByBranch={alertSummaryByBranch}
                range={range}
                today={today}
            />
        </div>
    );
}
