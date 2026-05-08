import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
    JT_SHIPMENT_DETAIL_FIELDS,
    JT_SHIPMENT_DETAIL_FIELDS_SETTINGS_KEY,
    parseJtShipmentDetailFieldsFromSettingsValue,
    sanitizeJtShipmentDetailFieldsWithAllowed,
} from '@/lib/jtShipmentDetailFields';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

type RpcColumnRow = { column_name: string };

async function loadAvailableFields(): Promise<string[]> {
    const { data, error } = await supabaseAdmin.rpc('jt_shipments_import_columns');
    if (error) {
        return JT_SHIPMENT_DETAIL_FIELDS.map((f) => f.key);
    }
    const names = ((data || []) as RpcColumnRow[])
        .map((x) => String(x.column_name ?? '').trim())
        .filter(Boolean);
    return names.length > 0 ? names : JT_SHIPMENT_DETAIL_FIELDS.map((f) => f.key);
}

export async function GET(request: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', request);
        if (denied) return denied;

        const availableFields = await loadAvailableFields();
        const { data, error } = await supabaseAdmin
            .from('settings')
            .select('value')
            .eq('key', JT_SHIPMENT_DETAIL_FIELDS_SETTINGS_KEY)
            .maybeSingle();
        if (error) {
            console.error('[detail-fields-settings GET]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const parsed = parseJtShipmentDetailFieldsFromSettingsValue(data?.value);
        const fields = sanitizeJtShipmentDetailFieldsWithAllowed(parsed, availableFields);
        return NextResponse.json({ fields, availableFields });
    } catch (e) {
        console.error('[detail-fields-settings GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const availableFields = await loadAvailableFields();
        const body = (await req.json()) as { fields?: unknown };
        const fields = sanitizeJtShipmentDetailFieldsWithAllowed(body.fields, availableFields);
        const { error } = await supabaseAdmin.from('settings').upsert(
            {
                key: JT_SHIPMENT_DETAIL_FIELDS_SETTINGS_KEY,
                value: JSON.stringify(fields),
            },
            { onConflict: 'key' },
        );
        if (error) {
            console.error('[detail-fields-settings PUT]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true, fields });
    } catch (e) {
        console.error('[detail-fields-settings PUT]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
