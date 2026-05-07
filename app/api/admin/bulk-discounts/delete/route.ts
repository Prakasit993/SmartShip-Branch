import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

export async function POST(request: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-only', request);
        if (denied) return denied;

        const { id } = await request.json();

        const { error } = await supabaseAdmin
            .from('bulk_discounts')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to delete discount' }, { status: 500 });
    }
}
