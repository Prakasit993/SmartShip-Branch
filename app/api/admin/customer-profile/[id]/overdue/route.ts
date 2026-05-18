import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/customer-profile/[id]/overdue?type=overdue3|overdue7|issue
 *
 * ดึง shipment จริงสำหรับ KPI drill-down:
 *   overdue3 — ยังไม่ปิดงาน AND booking_date < วันนี้ - 3 วัน
 *   overdue7 — ยังไม่ปิดงาน AND booking_date < วันนี้ - 7 วัน
 *   issue    — return_type มีค่า (ไม่ใช่ EMPTY/NULL/-)
 *
 * Logic ตาม business rules ใน project_jt_shipments_business_rules.md
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TYPES = ['overdue3', 'overdue7', 'issue'] as const;
type PanelType = (typeof VALID_TYPES)[number];

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
            const shipments = (data ?? []).map((s) => ({
                awb_number: s.awb_number as string | null,
                booking_date: s.booking_date as string | null,
                days_overdue: s.booking_date
                    ? Math.floor((todayMs - Date.parse(s.booking_date)) / 86_400_000)
                    : null,
            }));

            return NextResponse.json({ shipments });
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

        return NextResponse.json({ shipments: data ?? [] });
    } catch (e) {
        console.error('[api/admin/customer-profile/[id]/overdue][GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
