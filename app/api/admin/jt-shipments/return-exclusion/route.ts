import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
    JT_RETURN_EXCLUSION_SETTINGS_KEY,
    parseJtReturnExclusionFromSettingsValue,
    sanitizeJtReturnExclusion,
} from '@/lib/jtReturnExclusion';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

export async function GET(request: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', request);
        if (denied) return denied;

        const { data, error } = await supabaseAdmin
            .from('settings')
            .select('value')
            .eq('key', JT_RETURN_EXCLUSION_SETTINGS_KEY)
            .maybeSingle();
        if (error) {
            console.error('[return-exclusion GET]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const exclusion = parseJtReturnExclusionFromSettingsValue(data?.value);
        return NextResponse.json({ exclusion });
    } catch (e) {
        console.error('[return-exclusion GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = (await req.json()) as { exclusion?: unknown };
        const exclusion = sanitizeJtReturnExclusion(body.exclusion);
        const { error } = await supabaseAdmin.from('settings').upsert(
            {
                key: JT_RETURN_EXCLUSION_SETTINGS_KEY,
                value: JSON.stringify(exclusion),
            },
            { onConflict: 'key' },
        );
        if (error) {
            console.error('[return-exclusion PUT]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true, exclusion });
    } catch (e) {
        console.error('[return-exclusion PUT]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
