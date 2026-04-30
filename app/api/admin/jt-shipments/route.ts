import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: list with pagination + search
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const dateFrom = searchParams.get('date_from') || '';
        const dateTo = searchParams.get('date_to') || '';
        const offset = (page - 1) * limit;

        let query = supabaseAdmin
            .from('jt_shipments')
            .select('*', { count: 'exact' })
            .order('booking_date', { ascending: false })
            .range(offset, offset + limit - 1);

        if (search) {
            query = query.or(
                `awb_number.ilike.%${search}%,sender_name.ilike.%${search}%,receiver_name.ilike.%${search}%`
            );
        }
        if (dateFrom) query = query.gte('booking_date', dateFrom);
        if (dateTo) query = query.lte('booking_date', dateTo + 'T23:59:59');

        const { data, count, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        return NextResponse.json({ data, count, page, limit });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: create single shipment
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { awb_number, booking_date, sender_name, sender_phone, receiver_name, receiver_phone, shipping_fee } = body;

        if (!awb_number) {
            return NextResponse.json({ error: 'AWB Number is required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .insert({
                awb_number: awb_number.trim(),
                booking_date: booking_date || null,
                sender_name: sender_name?.trim() || null,
                sender_phone: sender_phone?.trim() || null,
                receiver_name: receiver_name?.trim() || null,
                receiver_phone: receiver_phone?.trim() || null,
                shipping_fee: shipping_fee != null ? Number(shipping_fee) : 0,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PUT: update shipment by id
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, awb_number, booking_date, sender_name, sender_phone, receiver_name, receiver_phone, shipping_fee } = body;

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .update({
                awb_number: awb_number?.trim(),
                booking_date: booking_date || null,
                sender_name: sender_name?.trim() || null,
                sender_phone: sender_phone?.trim() || null,
                receiver_name: receiver_name?.trim() || null,
                receiver_phone: receiver_phone?.trim() || null,
                shipping_fee: shipping_fee != null ? Number(shipping_fee) : 0,
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true, data });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE: delete shipment by id
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { error } = await supabaseAdmin
            .from('jt_shipments')
            .delete()
            .eq('id', id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
