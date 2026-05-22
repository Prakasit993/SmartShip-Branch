import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import {
    TIKTOK_ACK_KINDS,
    TIKTOK_RETURN_ACKNOWLEDGEMENTS_TABLE,
    type TiktokAckKind,
} from '@/lib/tiktokReturnAcknowledgements';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/admin/tiktok-shipments/parcel-acknowledgements
 *
 * รับทราบ/ซ่อน/ดึงกลับ พัสดุ TikTok (kind = 'return' | 'stagnant').
 *
 * Body:
 *   { awb_number, kind, reason?, mute_aging?, action?: 'hide' | 'restore' }
 *   - action='hide' (default): สร้าง/อัปเดต ack เป็น status='active' → ซ่อน AWB จากการ์ด
 *   - action='restore'       : set active ack เป็น status='cancelled'
 *   - mute_aging (kind='return') : true=ปิดเรื่องแล้ว (default), false=ยังต้องตามต่อ
 */

function isKind(v: unknown): v is TiktokAckKind {
    return typeof v === 'string' && (TIKTOK_ACK_KINDS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = (await req.json()) as {
            awb_number?: unknown;
            kind?: unknown;
            reason?: unknown;
            mute_aging?: unknown;
            action?: unknown;
        };

        const awb = String(body.awb_number ?? '').trim();
        const reason = String(body.reason ?? '').trim();
        const kind: TiktokAckKind = isKind(body.kind) ? body.kind : 'stagnant';
        const action = body.action === 'restore' ? 'restore' : 'hide';
        // ปิดเรื่อง = ซ่อนจาก aging. รับ false ตรงเท่านั้น; ค่าอื่น = default true
        const muteAging = body.mute_aging === false ? false : true;

        if (!awb) {
            return NextResponse.json({ error: 'กรุณาระบุเลขพัสดุ' }, { status: 400 });
        }
        if (action === 'hide' && !reason) {
            return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่รับทราบ' }, { status: 400 });
        }

        const actor = 'admin';
        const now = new Date().toISOString();

        const { data: existing, error: readError } = await supabaseAdmin
            .from(TIKTOK_RETURN_ACKNOWLEDGEMENTS_TABLE)
            .select('id')
            .eq('awb_number', awb)
            .eq('kind', kind)
            .eq('status', 'active')
            .maybeSingle();
        if (readError) {
            console.error('[tiktok parcel-acknowledgements read]', readError);
            return NextResponse.json({ error: readError.message }, { status: 500 });
        }

        if (action === 'restore') {
            if (!existing?.id) {
                return NextResponse.json({ ok: true, restored: false });
            }
            const { error: cancelError } = await supabaseAdmin
                .from(TIKTOK_RETURN_ACKNOWLEDGEMENTS_TABLE)
                .update({
                    status: 'cancelled',
                    cancelled_reason: reason.slice(0, 500) || 'ดึงกลับโดยแอดมิน',
                    cancelled_at: now,
                    updated_at: now,
                })
                .eq('id', existing.id);
            if (cancelError) {
                console.error('[tiktok parcel-acknowledgements restore]', cancelError);
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
            mute_aging: muteAging,
            acknowledged_by: actor,
            acknowledged_at: now,
            updated_at: now,
        };
        const query = existing?.id
            ? supabaseAdmin
                  .from(TIKTOK_RETURN_ACKNOWLEDGEMENTS_TABLE)
                  .update(payload)
                  .eq('id', existing.id)
                  .select('*')
                  .single()
            : supabaseAdmin
                  .from(TIKTOK_RETURN_ACKNOWLEDGEMENTS_TABLE)
                  .insert(payload)
                  .select('*')
                  .single();
        const { data: acknowledgement, error: writeError } = await query;
        if (writeError) {
            console.error('[tiktok parcel-acknowledgements hide]', writeError);
            return NextResponse.json({ error: writeError.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, acknowledgement });
    } catch (e) {
        console.error('[tiktok parcel-acknowledgements POST]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
