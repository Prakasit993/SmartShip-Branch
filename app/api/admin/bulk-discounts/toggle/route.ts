import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
    try {
        const { id } = await request.json();

        // Get current status
        const { data: current } = await supabaseAdmin
            .from('bulk_discounts')
            .select('is_active')
            .eq('id', id)
            .single();

        // Toggle the status
        const { error } = await supabaseAdmin
            .from('bulk_discounts')
            .update({ is_active: !current?.is_active })
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to toggle discount' }, { status: 500 });
    }
}
