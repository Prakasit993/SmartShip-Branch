import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const denied = await requireAdminApiAuth('admin-only', request);
    if (denied) return denied;

    const { data: logs } = await supabaseAdmin
        .from('admin_login_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    return NextResponse.json(logs || []);
}
