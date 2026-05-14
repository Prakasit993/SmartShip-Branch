import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseJtChannelPriorityFromSettingValue } from '@/lib/jtChannelSettings';
import { applyBookingDateRangeFilters } from '@/lib/jtShipmentsBookingDateFilter';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT, RATE_LIMIT_MUTATE, RATE_LIMIT_BULK } from '@/lib/rateLimit';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escape PostgreSQL ilike wildcard characters so user input is treated literally. */
function escapeIlike(input: string): string {
    return input.replace(/([%_\\])/g, '\\$1');
}

/** Map Supabase/Postgres error codes to user-friendly messages (hide internals). */
function safeErrorMessage(error: { code?: string; message: string }): string {
    if (error.code === '23505') return 'ข้อมูลซ้ำ — AWB Number นี้มีอยู่แล้ว';
    if (error.code === '23503') return 'ข้อมูลอ้างอิงไม่ถูกต้อง';
    if (error.code === '22P02') return 'รูปแบบข้อมูลไม่ถูกต้อง';
    return 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้ง';
}

/** Return the appropriate HTTP status for a Supabase error. */
function safeErrorStatus(error: { code?: string }): number {
    if (error.code === '23505') return 409;
    return 500;
}

const AWB_PATTERN = /^[A-Za-z0-9]{4,30}$/;

function validateAwbNumber(awb: unknown): string | null {
    if (typeof awb !== 'string') return null;
    const trimmed = awb.trim();
    if (!trimmed || !AWB_PATTERN.test(trimmed)) return null;
    return trimmed;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_SHIPPING_FEE = 1_000_000;

// ── GET: list with pagination + search | count_only + date range ─────────────

export async function GET(req: Request) {
    try {
        const rateLimited = applyRateLimit(req, 'jt-shipments:GET', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
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
                return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
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
            const safeSearch = escapeIlike(search);
            if (searchField !== 'all' && validFields.includes(searchField)) {
                query = query.ilike(searchField, `%${safeSearch}%`);
            } else {
                query = query.or(
                    validFields.map(f => `${f}.ilike.%${safeSearch}%`).join(',')
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
            return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
        }

        const channelFieldPriority = parseJtChannelPriorityFromSettingValue(prioRes.data?.value);

        return NextResponse.json({ data, count, page, limit, channelFieldPriority });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ── POST: create single shipment ─────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const rateLimited = applyRateLimit(req, 'jt-shipments:POST', RATE_LIMIT_MUTATE);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = await req.json();
        const { awb_number, booking_date, sender_name, sender_phone, receiver_name, receiver_phone, shipping_fee, platform } = body;

        const trimmedAwb = validateAwbNumber(awb_number);
        if (!trimmedAwb) {
            return NextResponse.json(
                { error: 'AWB Number ต้องเป็นตัวอักษร/ตัวเลข 4-30 ตัว' },
                { status: 400 },
            );
        }

        const fee = shipping_fee != null ? Number(shipping_fee) : 0;
        if (!Number.isFinite(fee) || fee < 0 || fee > MAX_SHIPPING_FEE) {
            return NextResponse.json(
                { error: `shipping_fee ต้องอยู่ระหว่าง 0-${MAX_SHIPPING_FEE.toLocaleString()}` },
                { status: 400 },
            );
        }

        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .insert({
                awb_number: trimmedAwb,
                booking_date: booking_date || null,
                sender_name: sender_name?.trim() || null,
                sender_phone: sender_phone?.trim() || null,
                receiver_name: receiver_name?.trim() || null,
                receiver_phone: receiver_phone?.trim() || null,
                shipping_fee: fee,
                platform: typeof platform === 'string' && platform.trim() ? platform.trim() : null,
            })
            .select()
            .single();

        if (error) {
            console.error('[api/admin/jt-shipments][POST]', error);
            return NextResponse.json({ error: safeErrorMessage(error) }, { status: safeErrorStatus(error) });
        }
        return NextResponse.json({ success: true, data });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ── PUT: update shipment by id (partial update — only sent fields are changed) ──

export async function PUT(req: Request) {
    try {
        const rateLimited = applyRateLimit(req, 'jt-shipments:PUT', RATE_LIMIT_MUTATE);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = await req.json();
        const { id } = body;

        if (!id || (typeof id === 'string' && !UUID_RE.test(id))) {
            return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 });
        }

        // Build partial update payload — only include fields explicitly sent in the body
        const updatePayload: Record<string, unknown> = {};

        if (body.awb_number !== undefined) {
            const trimmedAwb = validateAwbNumber(body.awb_number);
            if (!trimmedAwb) {
                return NextResponse.json(
                    { error: 'AWB Number ต้องเป็นตัวอักษร/ตัวเลข 4-30 ตัว' },
                    { status: 400 },
                );
            }
            updatePayload.awb_number = trimmedAwb;
        }
        if (body.booking_date !== undefined) {
            updatePayload.booking_date = body.booking_date || null;
        }
        if (body.sender_name !== undefined) {
            updatePayload.sender_name = body.sender_name?.trim() || null;
        }
        if (body.sender_phone !== undefined) {
            updatePayload.sender_phone = body.sender_phone?.trim() || null;
        }
        if (body.receiver_name !== undefined) {
            updatePayload.receiver_name = body.receiver_name?.trim() || null;
        }
        if (body.receiver_phone !== undefined) {
            updatePayload.receiver_phone = body.receiver_phone?.trim() || null;
        }
        if (body.shipping_fee !== undefined) {
            const fee = Number(body.shipping_fee);
            if (!Number.isFinite(fee) || fee < 0 || fee > MAX_SHIPPING_FEE) {
                return NextResponse.json(
                    { error: `shipping_fee ต้องอยู่ระหว่าง 0-${MAX_SHIPPING_FEE.toLocaleString()}` },
                    { status: 400 },
                );
            }
            updatePayload.shipping_fee = fee;
        }
        if (body.platform !== undefined) {
            updatePayload.platform =
                typeof body.platform === 'string' && body.platform.trim() ? body.platform.trim() : null;
        }

        if (Object.keys(updatePayload).length === 0) {
            return NextResponse.json({ error: 'ไม่มีข้อมูลที่ต้องอัปเดต' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('[api/admin/jt-shipments][PUT]', error);
            return NextResponse.json({ error: safeErrorMessage(error) }, { status: safeErrorStatus(error) });
        }
        return NextResponse.json({ success: true, data });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ── DELETE: delete shipment by id or all ─────────────────────────────────────

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const deleteAll = searchParams.get('delete_all') === 'true';

        // Mass delete gets stricter rate limiting than single-item delete
        const rateLimited = applyRateLimit(
            req,
            deleteAll ? 'jt-shipments:DELETE-ALL' : 'jt-shipments:DELETE',
            deleteAll ? RATE_LIMIT_BULK : RATE_LIMIT_MUTATE,
        );
        if (rateLimited) return rateLimited;
        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');

        // Mass delete requires admin-only + explicit confirmation token
        const denied = await requireAdminApiAuth(
            deleteAll ? 'admin-only' : 'admin-or-staff',
            req,
        );
        if (denied) return denied;

        if (deleteAll) {
            const confirmToken = searchParams.get('confirm');
            if (confirmToken !== 'DELETE_ALL_CONFIRMED') {
                return NextResponse.json(
                    { error: 'ต้องส่ง confirm=DELETE_ALL_CONFIRMED เพื่อยืนยันการลบทั้งหมด' },
                    { status: 400 },
                );
            }

            console.warn(
                `[AUDIT][jt-shipments] Mass delete triggered. dateFrom=${dateFrom ?? 'all'}, dateTo=${dateTo ?? 'all'}`,
            );

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
            if (error) {
                console.error('[api/admin/jt-shipments][DELETE all]', error);
                return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        if (!UUID_RE.test(id)) {
            return NextResponse.json({ error: 'ID ไม่ถูกต้อง' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('jt_shipments')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[api/admin/jt-shipments][DELETE]', error);
            return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
        }
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
