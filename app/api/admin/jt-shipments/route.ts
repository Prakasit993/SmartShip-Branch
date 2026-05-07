import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseJtChannelPriorityFromSettingValue } from '@/lib/jtChannelSettings';
import { applyBookingDateRangeFilters } from '@/lib/jtShipmentsBookingDateFilter';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

// GET: list with pagination + search | count_only + date range
export async function GET(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff');
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const countOnly =
            searchParams.get('count_only') === 'true' || searchParams.get('count_only') === '1';
        const dateFrom = searchParams.get('date_from') || '';
        const dateTo = searchParams.get('date_to') || '';

        if (countOnly) {
            let q = supabaseAdmin.from('jt_shipments').select('awb_number', { count: 'exact', head: true });
            q = applyBookingDateRangeFilters(q, dateFrom, dateTo);
            const { count, error } = await q;
            if (error) {
                console.error('[api/admin/jt-shipments][GET count_only]', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({
                count: count ?? 0,
                date_from: dateFrom.trim() || null,
                date_to: dateTo.trim() || null,
            });
        }

        const page = parseInt(searchParams.get('page') || '1');
        const requestedLimit = parseInt(searchParams.get('limit') || '20');
        const limit = Number.isNaN(requestedLimit) ? 20 : Math.min(Math.max(requestedLimit, 5), 100);
        const search = searchParams.get('search') || '';
        const searchField = searchParams.get('search_field') || 'all';
        const sortByParam = searchParams.get('sort_by') || 'booking_date';
        const sortOrderParam = searchParams.get('sort_order') || 'desc';
        const offset = (page - 1) * limit;
        const allowedSortFields = new Set([
            'booking_date',
            'awb_number',
            'sender_name',
            'receiver_name',
            'shipping_fee',
        ]);
        const sortBy = allowedSortFields.has(sortByParam) ? sortByParam : 'booking_date';
        const ascending = sortOrderParam === 'asc';

        let query = supabaseAdmin
            .from('jt_shipments')
            .select('*', { count: 'exact' })
            .order(sortBy, { ascending })
            .order('awb_number', { ascending: true })
            .range(offset, offset + limit - 1);

        if (search) {
            const validFields = ['awb_number', 'sender_name', 'receiver_name', 'sender_phone', 'receiver_phone'];
            if (searchField !== 'all' && validFields.includes(searchField)) {
                query = query.ilike(searchField, `%${search}%`);
            } else {
                query = query.or(
                    `awb_number.ilike.%${search}%,sender_name.ilike.%${search}%,receiver_name.ilike.%${search}%,sender_phone.ilike.%${search}%,receiver_phone.ilike.%${search}%`
                );
            }
        }
        query = applyBookingDateRangeFilters(query, dateFrom, dateTo);

        const [listRes, prioRes] = await Promise.all([
            query,
            supabaseAdmin.from('settings').select('value').eq('key', 'jt_channel_field_priority').maybeSingle(),
        ]);
        const { data, count, error } = listRes;
        if (error) {
            console.error('[api/admin/jt-shipments][GET]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const channelFieldPriority = parseJtChannelPriorityFromSettingValue(prioRes.data?.value);

        return NextResponse.json({ data, count, page, limit, channelFieldPriority });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: create single shipment
export async function POST(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = await req.json();
        const { awb_number, booking_date, sender_name, sender_phone, receiver_name, receiver_phone, shipping_fee, platform } = body;

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
                platform: typeof platform === 'string' && platform.trim() ? platform.trim() : null,
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
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = await req.json();
        const { id, awb_number, booking_date, sender_name, sender_phone, receiver_name, receiver_phone, shipping_fee, platform } = body;

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
                platform: typeof platform === 'string' && platform.trim() ? platform.trim() : null,
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

// DELETE: delete shipment by id or all
export async function DELETE(req: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const deleteAll = searchParams.get('delete_all') === 'true';
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');

        if (deleteAll) {
            let query = supabaseAdmin.from('jt_shipments').delete();

            query = applyBookingDateRangeFilters(
                query,
                dateFrom || '',
                dateTo || '',
            );

            // If no dates provided, we must use a dummy filter to delete all in Supabase JS
            if (!dateFrom && !dateTo) {
                query = query.not('id', 'is', null);
            }

            const { error } = await query;
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            return NextResponse.json({ success: true });
        }

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
