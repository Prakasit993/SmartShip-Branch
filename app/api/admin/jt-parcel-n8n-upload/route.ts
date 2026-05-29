import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth, getAdminApiAccess } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * โพรซี multipart ไปยัง n8n Webhook สำหรับนำเข้าข้อมูลคลังพัสดุ J&T
 *
 * Phase 3.6 — Async job tracking:
 *   1. สร้าง row ใน jt_upload_jobs (status='processing') + generate request_id
 *   2. Proxy ไฟล์ → n8n + ส่ง request_id ใน query ให้ n8n ใช้ตอน callback
 *   3. Return { request_id, job_id, status: 'processing' } ทันที (ไม่รอ n8n ทำเสร็จ)
 *   4. Modal poll /api/admin/jt-warehouse/upload-jobs?request_id=... จนกว่า status เปลี่ยน
 *   5. n8n เมื่อทำเสร็จ → POST /api/admin/jt-warehouse/upload-callback อัปเดต status
 *
 * Query: ?filename=... (ชื่อไฟล์สำหรับ n8n)
 * Body: multipart/form-data ฟิลด์ `file`
 */
export const maxDuration = 60;  // ลดจาก 300 — แค่รอ n8n acknowledge

export async function POST(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const webhookBase = process.env.JT_PARCEL_N8N_UPLOAD_WEBHOOK_URL?.trim();
    if (!webhookBase) {
        return NextResponse.json(
            { error: 'ยังไม่ได้ตั้งค่า JT_PARCEL_N8N_UPLOAD_WEBHOOK_URL บนเซิร์ฟเวอร์' },
            { status: 500 }
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
        return NextResponse.json({ error: 'JT_PARCEL_N8N_UPLOAD_WEBHOOK_URL ไม่ถูกต้อง' }, { status: 500 });
    }

    // 1. สร้าง job row + generate request_id
    const requestId = crypto.randomUUID();
    const access = await getAdminApiAccess(request);

    const { data: jobRow, error: insertError } = await supabaseAdmin
        .from('jt_upload_jobs')
        .insert({
            request_id: requestId,
            kind: 'jt_parcel',
            status: 'processing',
            file_name: filename,
            // หาก auth ผ่าน OAuth จะมี email; password-admin = NULL — สำหรับ audit
            // user_id ไม่ใส่เพราะ password-admin ไม่มี auth.uid()
            stats: {
                triggered_by_email: access.email,
                triggered_by_role: access.role,
            },
        })
        .select('id, request_id, status, started_at')
        .single();

    if (insertError || !jobRow) {
        return NextResponse.json(
            { error: `สร้าง job ไม่สำเร็จ: ${insertError?.message || 'unknown'}` },
            { status: 500 },
        );
    }

    // 2. Proxy file → n8n (ส่ง request_id ใน query)
    target.searchParams.set('filename', filename);
    target.searchParams.set('request_id', requestId);

    const outbound = new FormData();
    outbound.append('file', file, file.name);

    try {
        const upstream = await fetch(target.toString(), {
            method: 'POST',
            body: outbound,
            // n8n ตอบ immediately (acknowledge) — รอแค่ 30 วินาที
            signal: AbortSignal.timeout(30_000),
        });

        // ถ้า n8n ตอบ error — mark job failed ทันที
        if (!upstream.ok) {
            const errBody = await upstream.text();
            await supabaseAdmin
                .from('jt_upload_jobs')
                .update({
                    status: 'error',
                    finished_at: new Date().toISOString(),
                    error: `n8n ตอบ ${upstream.status}: ${errBody.slice(0, 500)}`,
                })
                .eq('request_id', requestId);

            return NextResponse.json(
                {
                    request_id: requestId,
                    job_id: jobRow.id,
                    status: 'error',
                    error: `n8n ตอบ ${upstream.status}`,
                },
                { status: 502 },
            );
        }

        // n8n รับงานเรียบร้อย — return job info ให้ modal เริ่ม poll
        return NextResponse.json({
            request_id: requestId,
            job_id: jobRow.id,
            status: 'processing',
            message: 'รับไฟล์เรียบร้อย ระบบกำลังประมวลผล',
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Upstream error';
        console.error('[jt-parcel-n8n-upload]', msg);

        await supabaseAdmin
            .from('jt_upload_jobs')
            .update({
                status: 'error',
                finished_at: new Date().toISOString(),
                error: `ส่งไป n8n ไม่สำเร็จ: ${msg}`,
            })
            .eq('request_id', requestId);

        return NextResponse.json(
            {
                request_id: requestId,
                job_id: jobRow.id,
                status: 'error',
                error: `ส่งไป n8n ไม่สำเร็จ: ${msg}`,
            },
            { status: 502 },
        );
    }
}
