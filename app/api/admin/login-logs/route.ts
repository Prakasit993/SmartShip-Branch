import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    const { data: logs } = await supabaseAdmin
        .from('admin_login_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    return NextResponse.json(logs || []);
}
