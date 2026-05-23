import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { TIKTOK_RETURN_ACKNOWLEDGEMENTS_TABLE } from '@/lib/tiktokReturnAcknowledgements';
import { parseBookingWindow } from '@/lib/bookingDateWindow';

/**
 * GET /api/admin/tiktok-shipments/issues
 *
 * "ติดตามปัญหา" ของ TikTok Shop — มิเรอร์ logic จาก jt-shipments/dashboard
 * (ไม่มีต้นทุน — ตรวจสอบเท่านั้น).
 *
 * ตัวกรองวันที่ (optional): ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD (inclusive)
 *   กรองตาม booking_date — dashboard ส่งหน้าต่าง 14 วันมา (ช่วยลดการสแกนตารางด้วย).
 *   ไม่ส่ง = สแกนทั้งตาราง (เดิม).
 *
 * คืน:
 *   - exceptionCount + topExceptionCases  : sign_branch_code IS NULL และมี exception_reason
 *   - returnCount + topReturnTypeCases    : return_type มีความหมาย (ตัด ack + branch/staff ที่กันไว้)
 *   - returnHiddenCases                   : ack kind='return' ที่ active (สำหรับ "ดูที่ซ่อนไว้")
 *
 * รวมเป็น pagination pass เดียวเพื่อความเร็ว (แทนที่จะวน 2 รอบเหมือน jt).
 */

const AGG_PAGE = 1000;
const MAX_AGG_ITERATIONS = 200;
const TOP_CASE_N = 100;

// J&T-specific exclusions — มิเรอร์จาก jt dashboard (คอลัมน์เหมือนกัน เพราะมาจาก export เดียวกัน)
const EXCLUDED_RETURN_SIGN_BRANCH_NAME = '04Lam Luk Ka067';
const EXCLUDED_RETURN_DELIVERY_STAFF_IDS = new Set(['604911501', '604911502', '604911503']);

function hasMeaningfulReturnType(raw: unknown): boolean {
    const v = String(raw ?? '').trim();
    if (!v) return false;
    const upper = v.toUpperCase();
    return upper !== 'EMPTY' && upper !== 'NULL' && upper !== '-';
}

function isExcludedSignedReturn(signBranchName: unknown, deliveryStaffId: unknown): boolean {
    return (
        String(signBranchName ?? '').trim() === EXCLUDED_RETURN_SIGN_BRANCH_NAME ||
        EXCLUDED_RETURN_DELIVERY_STAFF_IDS.has(String(deliveryStaffId ?? '').trim())
    );
}

const safe = (v: unknown) => String(v ?? '-').trim() || '-';

type ShipmentRow = {
    awb_number: string | null;
    sender_name: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
    exception_reason: string | null;
    issue_registered_time: string | null;
    return_type: string | null;
    return_branch_name: string | null;
    sign_branch_code: string | null;
    sign_branch_name: string | null;
    delivery_staff_id: string | null;
};

export async function GET(request: NextRequest) {
    const t0 = performance.now();
    const denied = await requireAdminApiAuth('admin-or-staff', request);
    if (denied) return denied;

    const { from: dateFrom, toExclusive: dateToExclusive } = parseBookingWindow(request.url);

    try {
        // active acks (kind='return') → ตัดออกจาก count/list + ใช้ทำ "ดูที่ซ่อนไว้"
        const { data: ackRows, error: ackErr } = await supabaseAdmin
            .from(TIKTOK_RETURN_ACKNOWLEDGEMENTS_TABLE)
            .select('awb_number,reason,acknowledged_at,acknowledged_by')
            .eq('kind', 'return')
            .eq('status', 'active');
        if (ackErr) {
            console.warn('[tiktok-shipments/issues] ack fetch failed:', ackErr.message);
        }
        type AckRow = {
            awb_number: string | null;
            reason: string | null;
            acknowledged_at: string | null;
            acknowledged_by: string | null;
        };
        const acknowledgedReturnAwbs = new Set<string>(
            ((ackRows ?? []) as AckRow[])
                .map((r) => String(r.awb_number ?? '').trim())
                .filter(Boolean),
        );

        let exceptionCount = 0;
        let returnCount = 0;
        const reasonMap: Record<string, number> = {};
        const topExceptionCases: Array<{
            awb_number: string;
            sender_name: string;
            receiver_name: string;
            receiver_phone: string;
            exception_reason: string;
            issue_registered_time: string;
        }> = [];
        const topReturnTypeCases: Array<{
            awb_number: string;
            sender_name: string;
            receiver_name: string;
            receiver_phone: string;
            exception_reason: string;
            return_branch_name: string;
            issue_registered_time: string;
        }> = [];

        let offset = 0;
        let iterations = 0;
        for (;;) {
            iterations++;
            if (iterations > MAX_AGG_ITERATIONS) {
                console.warn(`[tiktok-shipments/issues] capped at ${MAX_AGG_ITERATIONS * AGG_PAGE} rows`);
                break;
            }
            let pageQuery = supabaseAdmin
                .from('tiktok_shipments')
                .select(
                    'awb_number,sender_name,receiver_name,receiver_phone,exception_reason,issue_registered_time,return_type,return_branch_name,sign_branch_code,sign_branch_name,delivery_staff_id',
                )
                .order('booking_date', { ascending: false, nullsFirst: false })
                .range(offset, offset + AGG_PAGE - 1);
            if (dateFrom) pageQuery = pageQuery.gte('booking_date', dateFrom);
            if (dateToExclusive) pageQuery = pageQuery.lt('booking_date', dateToExclusive);
            const { data, error } = await pageQuery;
            if (error) {
                console.error('[tiktok-shipments/issues] aggregate', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            const rows = (data ?? []) as ShipmentRow[];
            for (const row of rows) {
                const awb = String(row.awb_number ?? '').trim();

                // ── พัสดุมีปัญหา (exception) — sign_branch_code IS NULL + มี exception_reason ──
                const reason = String(row.exception_reason ?? '').trim();
                const reasonMeaningful = reason !== '' && reason.toLowerCase() !== 'null';
                if (row.sign_branch_code == null && reasonMeaningful) {
                    exceptionCount += 1;
                    reasonMap[reason] = (reasonMap[reason] || 0) + 1;
                    if (topExceptionCases.length < TOP_CASE_N) {
                        topExceptionCases.push({
                            awb_number: safe(row.awb_number),
                            sender_name: safe(row.sender_name),
                            receiver_name: safe(row.receiver_name),
                            receiver_phone: safe(row.receiver_phone),
                            exception_reason: reason,
                            issue_registered_time: safe(row.issue_registered_time),
                        });
                    }
                }

                // ── พัสดุถูกตีกลับ (return) — return_type มีความหมาย, ตัด ack + branch/staff ที่กันไว้ ──
                if (awb && acknowledgedReturnAwbs.has(awb)) continue;
                if (isExcludedSignedReturn(row.sign_branch_name, row.delivery_staff_id)) continue;
                if (!hasMeaningfulReturnType(row.return_type)) continue;
                returnCount += 1;
                if (topReturnTypeCases.length < TOP_CASE_N) {
                    topReturnTypeCases.push({
                        awb_number: safe(row.awb_number),
                        sender_name: safe(row.sender_name),
                        receiver_name: safe(row.receiver_name),
                        receiver_phone: safe(row.receiver_phone),
                        exception_reason: safe(row.exception_reason),
                        return_branch_name: safe(row.return_branch_name),
                        issue_registered_time: safe(row.issue_registered_time),
                    });
                }
            }
            if (rows.length < AGG_PAGE) break;
            offset += AGG_PAGE;
        }

        const topExceptionReasons = Object.entries(reasonMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([reason, count]) => ({ reason, count }));

        const returnHiddenCases = ((ackRows ?? []) as AckRow[])
            .map((r) => ({
                awb_number: safe(r.awb_number),
                reason: safe(r.reason),
                acknowledged_at: safe(r.acknowledged_at),
                acknowledged_by: safe(r.acknowledged_by),
            }))
            .sort((a, b) => b.acknowledged_at.localeCompare(a.acknowledged_at));

        return NextResponse.json({
            exceptionCount,
            returnCount,
            topExceptionReasons,
            topExceptionCases,
            topReturnTypeCases,
            returnHiddenCases,
            _elapsed_ms: Math.round(performance.now() - t0),
        });
    } catch (e) {
        console.error('[tiktok-shipments/issues]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
