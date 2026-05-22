import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';
import { JT_RETURN_ACKNOWLEDGEMENTS_TABLE, type JtAckKind } from '@/lib/jtReturnAcknowledgements';

/**
 * GET /api/admin/customer-profile/[id]/overdue?type=overdue3|overdue7|issue
 *
 * ดึง shipment จริงสำหรับ KPI drill-down:
 *   overdue3 — ยังไม่ปิดงาน AND booking_date < วันนี้ - 3 วัน
 *   overdue7 — ยังไม่ปิดงาน AND booking_date < วันนี้ - 7 วัน
 *   issue    — return_type มีค่า (ไม่ใช่ EMPTY/NULL/-)
 *
 * Logic ตาม business rules ใน project_jt_shipments_business_rules.md
 *
 * ตัด AWB ที่แอดมินรับทราบและซ่อนไว้ออก (active ack):
 *   overdue3/overdue7 → kind='overdue'   issue → kind='return'
 * และคืน `hidden` list สำหรับ UI ดึงกลับ
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TYPES = ['overdue3', 'overdue7', 'issue'] as const;
type PanelType = (typeof VALID_TYPES)[number];

/** kind ของ ack ที่ใช้ตัดออกในแต่ละ panel */
function ackKindFor(type: PanelType): JtAckKind {
    return type === 'issue' ? 'return' : 'overdue';
}

type AckRow = {
    awb_number: string | null;
    reason: string | null;
    acknowledged_at: string | null;
    acknowledged_by: string | null;
};

/** ดึง active ack ของ kind ที่ระบุ → คืน Set(awb) + hidden list (ล่าสุดก่อน) */
async function fetchActiveAcks(kind: JtAckKind): Promise<{
    hiddenSet: Set<string>;
    hidden: Array<{ awb_number: string; reason: string; acknowledged_at: string; acknowledged_by: string }>;
}> {
    const { data, error } = await supabaseAdmin
        .from(JT_RETURN_ACKNOWLEDGEMENTS_TABLE)
        .select('awb_number,reason,acknowledged_at,acknowledged_by')
        .eq('kind', kind)
        .eq('status', 'active');
    if (error) {
        console.warn('[customer-profile/overdue] ack fetch failed:', error);
        return { hiddenSet: new Set(), hidden: [] };
    }
    const safe = (v: unknown) => String(v ?? '').trim();
    const rows = (data ?? []) as AckRow[];
    const hiddenSet = new Set<string>(rows.map((r) => safe(r.awb_number)).filter(Boolean));
    const hidden = rows
        .map((r) => ({
            awb_number: safe(r.awb_number) || '-',
            reason: safe(r.reason) || '-',
            acknowledged_at: safe(r.acknowledged_at) || '-',
            acknowledged_by: safe(r.acknowledged_by) || '-',
        }))
        .sort((a, b) => b.acknowledged_at.localeCompare(a.acknowledged_at));
    return { hiddenSet, hidden };
}

async function resolveSenderName(rawId: string): Promise<string | null> {
    if (UUID_RE.test(rawId)) {
        const { data } = await supabaseAdmin
            .from('customers')
            .select('name')
            .eq('id', rawId)
            .maybeSingle();
        return data?.name?.trim() ?? null;
    }
    try {
        return decodeURIComponent(rawId).trim() || null;
    } catch {
        return null;
    }
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const rateLimited = applyRateLimit(req, 'customer-profile:overdue', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const { id: rawId } = await context.params;
        const url = new URL(req.url);
        const type = url.searchParams.get('type') as PanelType | null;

        if (!type || !VALID_TYPES.includes(type)) {
            return NextResponse.json({ error: 'type ไม่ถูกต้อง (ต้องเป็น overdue3 | overdue7 | issue)' }, { status: 400 });
        }

        const senderName = await resolveSenderName(rawId);
        if (!senderName) {
            return NextResponse.json({ shipments: [] });
        }

        if (type === 'overdue3' || type === 'overdue7') {
            const days = type === 'overdue7' ? 7 : 3;
            const cutoff = new Date();
            cutoff.setUTCDate(cutoff.getUTCDate() - days);
            const cutoffDate = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD

            const { data, error } = await supabaseAdmin
                .from('jt_shipments')
                .select('awb_number, booking_date')
                .ilike('sender_name', senderName)
                // ยังไม่ปิดงาน: signer_name ว่าง/null/'NULL' ตาม business rules
                .or('signer_name.is.null,signer_name.eq.,signer_name.ilike.NULL')
                .not('booking_date', 'is', null)
                .lt('booking_date', cutoffDate)
                .order('booking_date', { ascending: true })
                .limit(100);

            if (error) {
                console.error('[customer-profile/overdue] overdue query:', error);
                return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 });
            }

            const todayMs = Date.UTC(
                new Date().getUTCFullYear(),
                new Date().getUTCMonth(),
                new Date().getUTCDate(),
            );
            const all = (data ?? []).map((s) => ({
                awb_number: s.awb_number as string | null,
                booking_date: s.booking_date as string | null,
                days_overdue: s.booking_date
                    ? Math.floor((todayMs - Date.parse(s.booking_date)) / 86_400_000)
                    : null,
            }));

            // แยก visible / hidden ด้วย ack (kind='overdue'), hidden เฉพาะของลูกค้านี้
            const { hiddenSet, hidden } = await fetchActiveAcks(ackKindFor(type));
            const hiddenByAwb = new Map(hidden.map((h) => [h.awb_number, h]));
            const shipments = all.filter((s) => !(s.awb_number && hiddenSet.has(s.awb_number)));
            const hiddenForCustomer = all
                .filter((s) => s.awb_number && hiddenSet.has(s.awb_number))
                .map((s) => ({
                    awb_number: s.awb_number,
                    booking_date: s.booking_date,
                    days_overdue: s.days_overdue,
                    reason: hiddenByAwb.get(s.awb_number ?? '')?.reason ?? '-',
                    acknowledged_at: hiddenByAwb.get(s.awb_number ?? '')?.acknowledged_at ?? '-',
                }));

            return NextResponse.json({ shipments, hidden: hiddenForCustomer });
        }

        // type === 'issue'
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select('awb_number, booking_date, return_type')
            .ilike('sender_name', senderName)
            .not('return_type', 'is', null)
            .not('return_type', 'eq', '')
            .not('return_type', 'ilike', 'EMPTY')
            .not('return_type', 'ilike', 'NULL')
            .not('return_type', 'eq', '-')
            .order('booking_date', { ascending: false })
            .limit(100);

        if (error) {
            console.error('[customer-profile/overdue] issue query:', error);
            return NextResponse.json({ error: 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 });
        }

        // แยก visible / hidden ด้วย ack (kind='return' — ใช้ร่วมกับการ์ดตีกลับ)
        const all = (data ?? []) as Array<{ awb_number: string | null; booking_date: string | null; return_type: string | null }>;
        const { hiddenSet, hidden } = await fetchActiveAcks(ackKindFor('issue'));
        const hiddenByAwb = new Map(hidden.map((h) => [h.awb_number, h]));
        const shipments = all.filter((s) => !(s.awb_number && hiddenSet.has(s.awb_number)));
        const hiddenForCustomer = all
            .filter((s) => s.awb_number && hiddenSet.has(s.awb_number))
            .map((s) => ({
                awb_number: s.awb_number,
                booking_date: s.booking_date,
                return_type: s.return_type,
                reason: hiddenByAwb.get(s.awb_number ?? '')?.reason ?? '-',
                acknowledged_at: hiddenByAwb.get(s.awb_number ?? '')?.acknowledged_at ?? '-',
            }));

        return NextResponse.json({ shipments, hidden: hiddenForCustomer });
    } catch (e) {
        console.error('[api/admin/customer-profile/[id]/overdue][GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
