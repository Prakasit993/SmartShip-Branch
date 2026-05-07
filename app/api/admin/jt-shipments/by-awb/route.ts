import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

export async function GET(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff');
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const awb = (searchParams.get('awb') || '').trim();
        if (!awb) {
            return NextResponse.json({ error: 'awb is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select('*')
            .eq('awb_number', awb)
            .order('booking_date', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลพัสดุนี้' }, { status: 404 });
        }

        return NextResponse.json({ data });
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
