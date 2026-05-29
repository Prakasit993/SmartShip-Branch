import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/admin/jt-warehouse/upload-callback
 *
 * Endpoint สำหรับ n8n ยิงกลับมาแจ้งผลลัพธ์การประมวลผลไฟล์
 *
 * Auth: Bearer token (N8N_UPLOAD_CALLBACK_SECRET)
 *
 * Body:
 * {
 *   "request_id": "<uuid>",
 *   "status": "success" | "error",
 *   "affected_rows": 5835,        // optional, ตอน success
 *   "duration_ms": 12500,         // optional
 *   "error": "<message>"          // required ตอน status='error'
 * }
 */

type CallbackPayload = {
    request_id?: unknown;
    status?: unknown;
    affected_rows?: unknown;
    duration_ms?: unknown;
    error?: unknown;
    [key: string]: unknown;
};

const ALLOWED_STATUS = new Set(['success', 'error']);

export async function POST(request: NextRequest) {
    // 1. Verify Bearer secret
    const expectedSecret = process.env.N8N_UPLOAD_CALLBACK_SECRET?.trim();
    if (!expectedSecret) {
        console.error('[upload-callback] N8N_UPLOAD_CALLBACK_SECRET not set');
        return NextResponse.json({ error: 'callback not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization')?.trim() ?? '';
    const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (provided !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse + validate body
    let body: CallbackPayload;
    try {
        body = (await request.json()) as CallbackPayload;
    } catch {
        return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
    }

    const requestId = typeof body.request_id === 'string' ? body.request_id.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : '';

    if (!requestId) {
        return NextResponse.json({ error: 'request_id required' }, { status: 400 });
    }
    if (!ALLOWED_STATUS.has(status)) {
        return NextResponse.json(
            { error: `status ต้องเป็นหนึ่งใน: ${Array.from(ALLOWED_STATUS).join(', ')}` },
            { status: 400 },
        );
    }

    // 3. Build update payload
    const updatePayload: Record<string, unknown> = {
        status,
        finished_at: new Date().toISOString(),
    };

    // stats — รวบ field ที่เกี่ยวข้อง
    const stats: Record<string, unknown> = {};
    if (typeof body.affected_rows === 'number') stats.affected_rows = body.affected_rows;
    if (typeof body.duration_ms === 'number') stats.duration_ms = body.duration_ms;
    // เก็บ field อื่น ๆ ที่ n8n ส่งมา (เผื่ออนาคต)
    for (const [key, value] of Object.entries(body)) {
        if (['request_id', 'status', 'error'].includes(key)) continue;
        if (key in stats) continue;
        stats[key] = value;
    }
    if (Object.keys(stats).length > 0) {
        // merge กับ stats เดิม (เก็บ triggered_by_email/role ไว้)
        const { data: existing } = await supabaseAdmin
            .from('jt_upload_jobs')
            .select('stats')
            .eq('request_id', requestId)
            .maybeSingle();
        const existingStats = (existing?.stats as Record<string, unknown> | null) ?? {};
        updatePayload.stats = { ...existingStats, ...stats };
    }

    if (status === 'error' && typeof body.error === 'string') {
        updatePayload.error = body.error.slice(0, 2000);
    }

    // 4. Update job row (idempotent — UNIQUE constraint บน request_id)
    const { data, error } = await supabaseAdmin
        .from('jt_upload_jobs')
        .update(updatePayload)
        .eq('request_id', requestId)
        .select('id, request_id, status, kind, started_at')
        .maybeSingle();

    if (error) {
        console.error('[upload-callback] update error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'request_id ไม่พบในระบบ' }, { status: 404 });
    }

    // 5. อัปเดต auto_sync_health — track สถานะ sync ต่อ portal
    //    (best-effort, ถ้าพังก็ไม่ block callback)
    try {
        const affectedRows =
            typeof body.affected_rows === 'number' ? body.affected_rows : null;
        const healthPatch: Record<string, unknown> = {
            kind: data.kind,
            last_started_at: data.started_at,
            last_finished_at: new Date().toISOString(),
            last_status: status,
            last_request_id: requestId,
        };
        if (affectedRows !== null) healthPatch.last_affected_rows = affectedRows;
        if (status === 'error' && typeof body.error === 'string') {
            healthPatch.last_error = body.error.slice(0, 2000);
        } else if (status === 'success') {
            healthPatch.last_error = null;
        }

        await supabaseAdmin
            .from('auto_sync_health')
            .upsert(healthPatch, { onConflict: 'kind' });

        // Increment counters (separate RPC — atomic)
        const counterField =
            status === 'success' ? 'success_count_today' : 'error_count_today';
        try {
            await supabaseAdmin.rpc('increment_auto_sync_counter', {
                p_kind: data.kind,
                p_field: counterField,
            });
        } catch {
            /* ignore — RPC อาจยังไม่ได้ apply */
        }
    } catch (e) {
        // Health update ไม่ critical — log แล้วผ่าน
        console.error('[upload-callback] health update error:', e);
    }

    return NextResponse.json({ ok: true, job_id: data.id, status: data.status });
}
