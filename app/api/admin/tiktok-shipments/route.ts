import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get('page') ?? 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)));
    const offset = (page - 1) * limit;
    const dateFrom = searchParams.get('date_from')?.trim() || null;
    const dateTo = searchParams.get('date_to')?.trim() || null;

    try {
        let query = supabaseAdmin
            .from('tiktok_shipments')
            .select('*', { count: 'exact' });

        if (dateFrom) query = query.gte('created_at', dateFrom);
        if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, count, error } = await query;
        if (error) throw error;

        return NextResponse.json({
            data: data ?? [],
            total: count ?? 0,
            page,
            limit,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[tiktok-shipments]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
