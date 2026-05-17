import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { JT_RETURN_ACKNOWLEDGEMENTS_TABLE } from '@/lib/jtReturnAcknowledgements';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = (await req.json()) as {
            awb_number?: unknown;
            reason?: unknown;
            mute_aging?: unknown;
        };
        const awb = String(body.awb_number ?? '').trim();
        const reason = String(body.reason ?? '').trim();
        if (!awb) {
            return NextResponse.json({ error: 'กรุณาระบุเลขพัสดุ' }, { status: 400 });
        }
        if (!reason) {
            return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่รับทราบ' }, { status: 400 });
        }

        // ปิดเรื่อง = ซ่อนจาก aging. รับ false ตรงเท่านั้น; undefined/null/ค่าอื่น = default true
        const muteAging = body.mute_aging === false ? false : true;

        const acknowledgedBy = 'admin';
        const { data: existing, error: readError } = await supabaseAdmin
            .from(JT_RETURN_ACKNOWLEDGEMENTS_TABLE)
            .select('id')
            .eq('awb_number', awb)
            .eq('status', 'active')
            .maybeSingle();
        if (readError) {
            console.error('[return-acknowledgements POST read]', readError);
            return NextResponse.json({ error: readError.message }, { status: 500 });
        }

        const payload = {
            awb_number: awb.slice(0, 80),
            reason: reason.slice(0, 500),
            status: 'active',
            mute_aging: muteAging,
            acknowledged_by: acknowledgedBy,
            acknowledged_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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
            console.error('[return-acknowledgements POST write]', writeError);
            return NextResponse.json({ error: writeError.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, acknowledgement });
    } catch (e) {
        console.error('[return-acknowledgements POST]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

