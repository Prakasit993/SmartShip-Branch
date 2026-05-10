import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { JT_RETURN_ACKNOWLEDGEMENTS_TABLE } from '@/lib/jtReturnAcknowledgements';
import { applyBookingDateRangeFilters } from '@/lib/jtShipmentsBookingDateFilter';
import { parseJtMoneyText } from '@/lib/jtMoneyText';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PAGE_SIZE = 1000;
const MONTH_RE = /^\d{4}-\d{2}$/;
const EXCLUDED_RETURN_SIGN_BRANCH_NAME = '04Lam Luk Ka067';
const EXCLUDED_RETURN_DELIVERY_STAFF_IDS = new Set(['604911501', '604911502', '604911503']);

type CalendarDayStats = {
    date: string;
    total: number;
    codPending: number;
    exceptions: number;
    returns: number;
};

function monthRange(month: string): { from: string; to: string } | null {
    if (!MONTH_RE.test(month)) return null;
    const [year, monthNo] = month.split('-').map(Number);
    if (!year || !monthNo || monthNo < 1 || monthNo > 12) return null;
    const from = `${year}-${String(monthNo).padStart(2, '0')}-01`;
    const to = new Date(year, monthNo, 0).toISOString().slice(0, 10);
    return { from, to };
}

function isPaidCodStatus(value: unknown): boolean {
    const status = String(value ?? '').trim().toLowerCase();
    return status.startsWith('ชำระ') || status === 'paid' || status === 'cod paid';
}

function hasMeaningfulReturnType(raw: unknown): boolean {
    const value = String(raw ?? '').trim();
    if (!value) return false;
    const upper = value.toUpperCase();
    return upper !== 'EMPTY' && upper !== 'NULL' && upper !== '-';
}

function isExcludedSignedReturn(row: {
    sign_branch_name: string | null;
    delivery_staff_id: string | null;
}): boolean {
    const signBranchName = String(row.sign_branch_name ?? '').trim();
    const deliveryStaffId = String(row.delivery_staff_id ?? '').trim();
    return (
        signBranchName === EXCLUDED_RETURN_SIGN_BRANCH_NAME ||
        EXCLUDED_RETURN_DELIVERY_STAFF_IDS.has(deliveryStaffId)
    );
}

function dayKeyFromBookingDate(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    const day = raw.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export async function GET(request: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', request);
        if (denied) return denied;

        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month') || '';
        const range = monthRange(month);
        if (!range) {
            return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
        }

        const { data: acknowledgements, error: ackError } = await supabaseAdmin
            .from(JT_RETURN_ACKNOWLEDGEMENTS_TABLE)
            .select('awb_number')
            .eq('status', 'active');
        if (ackError) {
            console.error('[jt-shipments/sla-calendar] return acknowledgements', ackError);
            return NextResponse.json({ error: ackError.message }, { status: 500 });
        }
        const acknowledgedReturnAwbs = new Set(
            ((acknowledgements || []) as Array<{ awb_number: string | null }>)
                .map((row) => String(row.awb_number ?? '').trim())
                .filter(Boolean),
        );

        const map = new Map<string, CalendarDayStats>();
        let offset = 0;

        for (;;) {
            let q = supabaseAdmin
                .from('jt_shipments')
                .select('awb_number,booking_date,cod_amount,cod_status,exception_reason,sign_branch_code,return_type,sign_branch_name,delivery_staff_id')
                .order('booking_date', { ascending: true, nullsFirst: false });
            q = applyBookingDateRangeFilters(q, range.from, range.to);
            const { data, error } = await q.range(offset, offset + PAGE_SIZE - 1);
            if (error) {
                console.error('[jt-shipments/sla-calendar] aggregate', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            const rows = (data || []) as Array<{
                awb_number: string | null;
                booking_date: string | null;
                cod_amount: unknown;
                cod_status: string | null;
                exception_reason: string | null;
                sign_branch_code: string | null;
                return_type: string | null;
                sign_branch_name: string | null;
                delivery_staff_id: string | null;
            }>;

            for (const row of rows) {
                const day = dayKeyFromBookingDate(row.booking_date);
                if (!day) continue;

                const current = map.get(day) ?? {
                    date: day,
                    total: 0,
                    codPending: 0,
                    exceptions: 0,
                    returns: 0,
                };
                const codAmount = parseJtMoneyText(row.cod_amount);
                const codPending = codAmount > 0 && !isPaidCodStatus(row.cod_status);
                const exceptionReason = String(row.exception_reason ?? '').trim();
                const exceptionOpen =
                    exceptionReason !== '' &&
                    exceptionReason.toLowerCase() !== 'null' &&
                    !String(row.sign_branch_code ?? '').trim();
                const awb = String(row.awb_number ?? '').trim();
                const returnOpen =
                    !acknowledgedReturnAwbs.has(awb) &&
                    !isExcludedSignedReturn(row) &&
                    hasMeaningfulReturnType(row.return_type);

                if (codPending) current.codPending += 1;
                if (exceptionOpen) current.exceptions += 1;
                if (returnOpen) current.returns += 1;
                current.total = current.codPending + current.exceptions + current.returns;
                map.set(day, current);
            }

            if (rows.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }

        const days = Array.from(map.values()).filter((day) => day.total > 0);
        return NextResponse.json({ month, days });
    } catch (e) {
        console.error('[jt-shipments/sla-calendar]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
