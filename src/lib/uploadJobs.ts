/**
 * Shared utility สำหรับติดตามสถานะการอัปโหลดไฟล์ผ่าน n8n
 *
 * รองรับ 3 modules (Phase 3.7):
 *   - jt_parcel    — /admin/jt-warehouse (ใช้ผ่าน N8N webhook upload_stock)
 *   - jt_shipment  — /admin/shipments    (ใช้ผ่าน N8N webhook)
 *   - tiktok       — /admin/tiktok-dashboard (ใช้ผ่าน N8N webhook)
 *
 * Flow:
 *   1. UI ยิง POST upload route ของแต่ละ module
 *   2. Route เรียก createUploadJob({kind, fileName, triggeredBy})
 *      → INSERT jt_upload_jobs row + return {requestId, jobId}
 *   3. Route proxy file → n8n webhook + ส่ง request_id ใน query
 *   4. n8n ทำเสร็จ → POST /api/admin/jt-warehouse/upload-callback
 *      → UPDATE jt_upload_jobs SET status='success'/'error', stats, error
 *   5. UI poll /api/admin/jt-warehouse/upload-jobs?request_id=
 *      → render status real-time
 */

import { supabaseAdmin } from './supabaseAdmin';

export type JobKind = 'jt_parcel' | 'jt_shipment' | 'tiktok';

export type JobStatus = 'processing' | 'success' | 'error' | 'timeout';

export const JOB_KIND_LABEL: Record<JobKind, string> = {
    jt_parcel: 'คลังพัสดุ J&T',
    jt_shipment: 'ใบนำส่ง J&T',
    tiktok: 'TikTok Shipments',
};

export const JOB_KIND_ICON: Record<JobKind, string> = {
    jt_parcel: '📦',
    jt_shipment: '🚚',
    tiktok: '🎵',
};

export type UploadJobRow = {
    id: string;
    request_id: string;
    user_id: string | null;
    kind: JobKind;
    status: JobStatus;
    file_name: string | null;
    started_at: string;
    finished_at: string | null;
    stats: Record<string, unknown> | null;
    error: string | null;
};

export type CreateJobInput = {
    kind: JobKind;
    fileName: string;
    triggeredBy: {
        email: string | null;
        role: 'admin' | 'staff' | null;
    };
};

export type CreateJobResult = {
    requestId: string;
    jobId: string;
    startedAt: string;
};

/**
 * สร้าง job row ใหม่ — generate request_id, INSERT, return key
 *
 * ใช้ใน upload route ก่อน proxy file ไปยัง n8n
 */
export async function createUploadJob(input: CreateJobInput): Promise<CreateJobResult> {
    const requestId = crypto.randomUUID();

    const { data, error } = await supabaseAdmin
        .from('jt_upload_jobs')
        .insert({
            request_id: requestId,
            kind: input.kind,
            status: 'processing',
            file_name: input.fileName,
            stats: {
                triggered_by_email: input.triggeredBy.email,
                triggered_by_role: input.triggeredBy.role,
            },
        })
        .select('id, started_at')
        .single();

    if (error || !data) {
        throw new Error(`สร้าง upload job ไม่สำเร็จ: ${error?.message || 'unknown'}`);
    }

    return {
        requestId,
        jobId: data.id,
        startedAt: data.started_at,
    };
}

/**
 * Mark job as failed — ใช้เมื่อ proxy ไปยัง n8n ล้มเหลว (ก่อน n8n รับงาน)
 *
 * Idempotent — รันซ้ำได้ปลอดภัย
 */
export async function markUploadJobError(
    requestId: string,
    errorMessage: string,
): Promise<void> {
    await supabaseAdmin
        .from('jt_upload_jobs')
        .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            error: errorMessage.slice(0, 2000),
        })
        .eq('request_id', requestId);
}

/**
 * อ่าน job ตาม request_id — สำหรับ polling endpoint
 */
export async function getUploadJob(requestId: string): Promise<UploadJobRow | null> {
    const { data, error } = await supabaseAdmin
        .from('jt_upload_jobs')
        .select('id, request_id, user_id, kind, status, file_name, started_at, finished_at, stats, error')
        .eq('request_id', requestId)
        .maybeSingle();

    if (error) {
        throw new Error(`อ่าน upload job ไม่สำเร็จ: ${error.message}`);
    }

    return (data as UploadJobRow | null) ?? null;
}
