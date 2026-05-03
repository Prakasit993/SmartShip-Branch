import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
    JT_CUSTOM_METRIC_SETTINGS_KEY,
    parseJtCustomMetricCardsFromSettingsValue,
    sanitizeJtCustomMetricCards,
} from '@/lib/jtCustomMetricCards';

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('settings')
            .select('value')
            .eq('key', JT_CUSTOM_METRIC_SETTINGS_KEY)
            .maybeSingle();
        if (error) {
            console.error('[custom-metric-cards GET]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const cards = parseJtCustomMetricCardsFromSettingsValue(data?.value);
        return NextResponse.json({ cards });
    } catch (e) {
        console.error('[custom-metric-cards GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = (await req.json()) as { cards?: unknown };
        const cards = sanitizeJtCustomMetricCards(body.cards);
        const { error } = await supabaseAdmin.from('settings').upsert(
            {
                key: JT_CUSTOM_METRIC_SETTINGS_KEY,
                value: JSON.stringify(cards),
            },
            { onConflict: 'key' },
        );
        if (error) {
            console.error('[custom-metric-cards PUT]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true, cards });
    } catch (e) {
        console.error('[custom-metric-cards PUT]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
