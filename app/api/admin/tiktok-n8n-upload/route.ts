import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth, getAdminApiAccess } from '@/lib/adminApiAuth';
import { createUploadJob, markUploadJobError } from '@/lib/uploadJobs';

/**
 * โพรซี multipart ไปยัง n8n Webhook สำหรับ TikTok Shop
 *
 * Phase 3.7 — Async job tracking (uploadJobs.ts)
 * Webhook URL: TIKTOK_N8N_UPLOAD_WEBHOOK_URL
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const webhookBase = process.env.TIKTOK_N8N_UPLOAD_WEBHOOK_URL?.trim();
    if (!webhookBase) {
        return NextResponse.json(
            { error: 'ยังไม่ได้ตั้งค่า TIKTOK_N8N_UPLOAD_WEBHOOK_URL บนเซิร์ฟเวอร์' },
            { status: 500 },
        );
    }

    let filename = request.nextUrl.searchParams.get('filename')?.trim();
    const formDataIn = await request.formData();
    const file = formDataIn.get('file');

    if (!(file instanceof File)) {
        return NextResponse.json({ error: 'ไม่พบไฟล์ในแบบฟอร์ม (ต้องใช้ฟิลด์ชื่อ file)' }, { status: 400 });
    }
    if (!filename) filename = file.name || 'upload.bin';
    if (file.size === 0) {
        return NextResponse.json({ error: 'ไฟล์ว่างเปล่า' }, { status: 400 });
    }

    let target: URL;
    try {
        target = new URL(webhookBase);
    } catch {
        return NextResponse.json({ error: 'TIKTOK_N8N_UPLOAD_WEBHOOK_URL ไม่ถูกต้อง' }, { status: 500 });
    }

    const access = await getAdminApiAccess(request);

    let job: { requestId: string; jobId: string };
    try {
        job = await createUploadJob({
            kind: 'tiktok',
            fileName: filename,
            triggeredBy: { email: access.email, role: access.role },
        });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'สร้าง job ไม่สำเร็จ' },
            { status: 500 },
        );
    }

    target.searchParams.set('filename', filename);
    target.searchParams.set('request_id', job.requestId);

    const outbound = new FormData();
    outbound.append('file', file, file.name);

    try {
        const upstream = await fetch(target.toString(), {
            method: 'POST',
            body: outbound,
            signal: AbortSignal.timeout(30_000),
        });

        if (!upstream.ok) {
            const errBody = await upstream.text();
            const msg = `n8n ตอบ ${upstream.status}: ${errBody.slice(0, 500)}`;
            await markUploadJobError(job.requestId, msg);
            return NextResponse.json(
                { request_id: job.requestId, job_id: job.jobId, status: 'error', error: msg },
                { status: 502 },
            );
        }

        return NextResponse.json({
            request_id: job.requestId,
            job_id: job.jobId,
            status: 'processing',
            message: 'รับไฟล์เรียบร้อย ระบบกำลังประมวลผล',
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Upstream error';
        console.error('[tiktok-n8n-upload]', msg);
        await markUploadJobError(job.requestId, `ส่งไป n8n ไม่สำเร็จ: ${msg}`);
        return NextResponse.json(
            { request_id: job.requestId, job_id: job.jobId, status: 'error', error: msg },
            { status: 502 },
        );
    }
}
