import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_DEFAULT } from '@/lib/rateLimit';

/**
 * GET /api/admin/customer-profile/list
 *
 * รายชื่อลูกค้าทั้งหมดจาก public.customers พร้อมจำนวนพัสดุที่จับคู่ได้
 * จาก jt_shipments.sender_name (ตรงเป๊ะ trim เทียบ trim) — ใช้เป็นหน้า list
 * ของแดชบอร์ด /admin/customer-profile (แยก VIP / ทั่วไป จาก vip_code).
 *
 * Response 200:
 * {
 *   vip:     CustomerRow[],   // customers ที่มี vip_code (ไม่ว่าง)
 *   general: CustomerRow[],   // customers ที่ไม่มี vip_code
 *   total:   { vip: number; general: number; matched_senders: number }
 * }
 *
 * CustomerRow = { id, name, phone, vip_code, shipment_count }
 */

type CustomerRow = {
    id: string;
    name: string | null;
    phone: string | null;
    vip_code: string | null;
    shipment_count: number;
};

const SENDER_PAGE_SIZE = 1000;
const SENDER_MAX_PAGES = 20;

function normalizeName(input: unknown): string {
    if (typeof input !== 'string') return '';
    return input.trim().toLowerCase();
}

function isVipCode(v: unknown): boolean {
    if (typeof v !== 'string') return false;
    const t = v.trim();
    if (!t) return false;
    if (t.toUpperCase() === 'NULL') return false;
    return true;
}

/** Fetch all customers — table is expected small (<10k). */
async function fetchAllCustomers() {
    const { data, error } = await supabaseAdmin
        .from('customers')
        .select('id, name, phone, vip_code')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
        id: string;
        name: string | null;
        phone: string | null;
        vip_code: string | null;
    }>;
}

/**
 * Aggregate sender_name → count from jt_shipments via paged projection.
 * One column only (sender_name) so payload stays light. Stops on empty page
 * or when SENDER_MAX_PAGES reached.
 */
async function buildSenderNameCountMap(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (let page = 0; page < SENDER_MAX_PAGES; page += 1) {
        const from = page * SENDER_PAGE_SIZE;
        const to = from + SENDER_PAGE_SIZE - 1;
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .select('sender_name')
            .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) break;
        for (const row of data) {
            const key = normalizeName((row as { sender_name: string | null }).sender_name);
            if (!key) continue;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        if (data.length < SENDER_PAGE_SIZE) break;
    }
    return counts;
}

export async function GET(req: Request) {
    try {
        const rateLimited = applyRateLimit(req, 'customer-profile:list', RATE_LIMIT_DEFAULT);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const [customers, senderCounts] = await Promise.all([
            fetchAllCustomers(),
            buildSenderNameCountMap(),
        ]);

        const rows: CustomerRow[] = customers.map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            vip_code: c.vip_code,
            shipment_count: senderCounts.get(normalizeName(c.name)) ?? 0,
        }));

        const vip = rows
            .filter((r) => isVipCode(r.vip_code))
            .sort((a, b) => b.shipment_count - a.shipment_count);
        const general = rows
            .filter((r) => !isVipCode(r.vip_code))
            .sort((a, b) => b.shipment_count - a.shipment_count);

        return NextResponse.json({
            vip,
            general,
            total: {
                vip: vip.length,
                general: general.length,
                matched_senders: senderCounts.size,
            },
        });
    } catch (e) {
        console.error('[api/admin/customer-profile/list][GET]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
