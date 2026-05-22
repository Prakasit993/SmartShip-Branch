import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import {
    JT_ACK_KINDS,
    JT_RETURN_ACKNOWLEDGEMENTS_TABLE,
    type JtAckKind,
} from '@/lib/jtReturnAcknowledgements';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/admin/jt-shipments/parcel-acknowledgements
 *
 * Generic acknowledgement สำหรับพัสดุ (kind = 'return' | 'stagnant').
 *
 * Body:
 *   { awb_number, kind, reason, action?: 'hide' | 'restore' }
 *   - action='hide' (default): สร้าง/อัปเดต ack เป็น status='active' → ซ่อน AWB จากการ์ด + AI tool
 *   - action='restore'       : ดึงกลับ — set active ack เป็น status='cancelled'
 */

function isKind(v: unknown): v is JtAckKind {
    return typeof v === 'string' && (JT_ACK_KINDS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = (await req.json()) as {
            awb_number?: unknown;
            kind?: unknown;
            reason?: unknown;
            action?: unknown;
        };

        const awb = String(body.awb_number ?? '').trim();
        const reason = String(body.reason ?? '').trim();
        const kind: JtAckKind = isKind(body.kind) ? body.kind : 'stagnant';
        const action = body.action === 'restore' ? 'restore' : 'hide';

        if (!awb) {
            return NextResponse.json({ error: 'กรุณาระบุเลขพัสดุ' }, { status: 400 });
        }
        if (action === 'hide' && !reason) {
            return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่รับทราบ' }, { status: 400 });
        }

        const actor = 'admin';
        const now = new Date().toISOString();

        // หาแถว active เดิมของ (awb, kind)
        const { data: existing, error: readError } = await supabaseAdmin
            .from(JT_RETURN_ACKNOWLEDGEMENTS_TABLE)
            .select('id')
            .eq('awb_number', awb)
            .eq('kind', kind)
            .eq('status', 'active')
            .maybeSingle();
        if (readError) {
            console.error('[parcel-acknowledgements read]', readError);
            return NextResponse.json({ error: readError.message }, { status: 500 });
        }

        if (action === 'restore') {
            if (!existing?.id) {
                // ไม่มี ack ที่ active อยู่ → ถือว่าดึงกลับสำเร็จ (idempotent)
                return NextResponse.json({ ok: true, restored: false });
            }
            const { error: cancelError } = await supabaseAdmin
                .from(JT_RETURN_ACKNOWLEDGEMENTS_TABLE)
                .update({
                    status: 'cancelled',
                    cancelled_reason: reason.slice(0, 500) || 'ดึงกลับโดยแอดมิน',
                    cancelled_at: now,
                    updated_at: now,
                })
                .eq('id', existing.id);
            if (cancelError) {
                console.error('[parcel-acknowledgements restore]', cancelError);
                return NextResponse.json({ error: cancelError.message }, { status: 500 });
            }
            return NextResponse.json({ ok: true, restored: true });
        }

        // action='hide'
        const payload = {
            awb_number: awb.slice(0, 80),
            kind,
            reason: reason.slice(0, 500),
            status: 'active',
            acknowledged_by: actor,
            acknowledged_at: now,
            updated_at: now,
        };
        const query = existing?.id
            ? supabaseAdmin
                  .from(JT_RETURN_ACKNOWLEDGEMENTS_TABLE)
                  .update(payload)
                  .eq('id', existing.id)
                  .select('*')
                  .single()
            : supabaseAdmin
                  .from(JT_RETURN_ACKNOWLEDGEMENTS_TABLE)
                  .insert(payload)
                  .select('*')
                  .single();
        const { data: acknowledgement, error: writeError } = await query;
        if (writeError) {
            console.error('[parcel-acknowledgements hide]', writeError);
            return NextResponse.json({ error: writeError.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, acknowledgement });
    } catch (e) {
        console.error('[parcel-acknowledgements POST]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
