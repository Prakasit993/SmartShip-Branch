import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';
import { applyRateLimit, RATE_LIMIT_BULK } from '@/lib/rateLimit';

type RpcRow = { column_name: string; data_type: string };

const FALLBACK_COLUMNS: RpcRow[] = [
    { column_name: 'awb_number', data_type: 'text' },
    { column_name: 'booking_date', data_type: 'timestamp with time zone' },
    { column_name: 'sender_name', data_type: 'text' },
    { column_name: 'sender_phone', data_type: 'text' },
    { column_name: 'receiver_name', data_type: 'text' },
    { column_name: 'receiver_phone', data_type: 'text' },
    { column_name: 'shipping_fee', data_type: 'numeric' },
    { column_name: 'platform', data_type: 'text' },
];

const SKIP_FROM_FILE = new Set(['id']);

const MAX_IMPORT_ROWS = 10_000;

function coerceValue(colName: string, raw: string, dataType: string): unknown {
    const s = String(raw ?? '').trim();
    if (s === '') return null;
    const dt = (dataType || 'text').toLowerCase();
    if (
        dt.includes('numeric') ||
        dt.includes('double') ||
        dt.includes('real') ||
        dt.includes('integer') ||
        dt.includes('bigint') ||
        dt.includes('smallint')
    ) {
        const n = parseFloat(s.replace(/,/g, ''));
        return Number.isNaN(n) ? null : n;
    }
    if (dt === 'boolean') {
        const low = s.toLowerCase();
        if (['true', '1', 'yes', 'y', 'ใช่'].includes(low)) return true;
        if (['false', '0', 'no', 'n', 'ไม่'].includes(low)) return false;
        return null;
    }
    return s;
}

/** ตัด BOM และช่องว่างหัวคอลัมน์จาก Excel */
function normalizeHeaderKey(k: string): string {
    return k.replace(/^\uFEFF/, '').toLowerCase().trim().replace(/\s+/g, '_');
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
    const r: Record<string, string> = {};
    Object.entries(row).forEach(([k, v]) => {
        const key = normalizeHeaderKey(k);
        if (!key) return;
        r[key] = String(v ?? '').trim();
    });
    return r;
}

/** รายงาน J&T / Marketplace: คอลัมน์ชื่อลูกค้าเป็นรหัสช่องทาง */
function looksLikePlatformMarketplaceCode(s: string): boolean {
    const t = s.trim();
    if (!t) return false;
    if (/\b(SHOPEE|LAZADA|TIKTOK|FACEBOOK|LINE|TOKOPEDIA|SHOP_|TIKTOK_|LAZADA_)/i.test(t)) return true;
    if (/_REVERSE$/i.test(t)) return true;
    return false;
}

async function loadColumnMeta(): Promise<RpcRow[]> {
    const { data, error } = await supabaseAdmin.rpc('jt_shipments_import_columns');
    if (!error && Array.isArray(data) && data.length > 0) {
        return data as RpcRow[];
    }
    return FALLBACK_COLUMNS;
}

export async function POST(req: Request) {
    try {
        const rateLimited = applyRateLimit(req, 'jt-shipments:import', RATE_LIMIT_BULK);
        if (rateLimited) return rateLimited;

        const denied = await requireAdminApiAuth('admin-or-staff', req);
        if (denied) return denied;

        const body = await req.json();
        const { rows } = body as { rows: Record<string, string>[] };

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: 'No data provided' }, { status: 400 });
        }

        if (rows.length > MAX_IMPORT_ROWS) {
            return NextResponse.json(
                { error: `ข้อมูลมากเกินไป: ${rows.length} แถว (สูงสุด ${MAX_IMPORT_ROWS.toLocaleString()})` },
                { status: 413 },
            );
        }

        const colMeta = await loadColumnMeta();
        const typeByName = new Map(colMeta.map((c) => [c.column_name, c.data_type]));
        const allowed = new Set(colMeta.map((c) => c.column_name));

        const mapped = rows
            .map((row) => {
                const r = normalizeRow(row);

                const out: Record<string, unknown> = {};
                for (const key of Object.keys(r)) {
                    if (!allowed.has(key) || SKIP_FROM_FILE.has(key)) continue;
                    out[key] = coerceValue(key, r[key], typeByName.get(key) || 'text');
                }

                const awb =
                    r['awb_number'] ||
                    r['awb'] ||
                    r['tracking'] ||
                    r['หมายเลข'] ||
                    r['หมายเลข_awb'] ||
                    r['หมายเลข_tracking'] ||
                    r['เลขพัสดุ'] ||
                    r['tracking_no'] ||
                    (out.awb_number != null ? String(out.awb_number) : '');

                const booking =
                    r['booking_date'] ||
                    r['date'] ||
                    r['วันที่'] ||
                    r['เวลาที่ส่งพัสดุ'] ||
                    r['วันที่จอง'] ||
                    r['วันที่ทำรายการ'] ||
                    r['วันเวลาที่จัดส่ง'] ||
                    (out.booking_date != null ? String(out.booking_date) : '') ||
                    null;

                let sender =
                    r['sender_name'] ||
                    r['sender'] ||
                    r['ผู้ส่ง'] ||
                    r['ชื่อผู้ส่ง'] ||
                    r['ชื่อลูกค้า'] ||
                    r['ชื่อร้านค้า'] ||
                    r['ชื่อร้าน'] ||
                    r['shop_name'] ||
                    (out.sender_name != null ? String(out.sender_name) : '') ||
                    null;

                let senderPhone =
                    r['sender_phone'] ||
                    r['sender_tel'] ||
                    r['mobile_sender'] ||
                    r['tel_sender'] ||
                    r['เบอร์ผู้ส่ง'] ||
                    r['เบอร์โทรผู้ส่ง'] ||
                    r['โทรผู้ส่ง'] ||
                    r['โทรศัพท์ผู้ส่ง'] ||
                    r['หมายเลขโทรศัพท์ผู้ส่ง'] ||
                    r['หมายเลขผู้ส่ง'] ||
                    (out.sender_phone != null ? String(out.sender_phone) : '') ||
                    null;

                const receiver =
                    r['receiver_name'] ||
                    r['receiver'] ||
                    r['ผู้รับ'] ||
                    r['ชื่อผู้รับ'] ||
                    r['ชื่อผู้รับปลายทาง'] ||
                    (out.receiver_name != null ? String(out.receiver_name) : '') ||
                    null;

                const receiverPhone =
                    r['receiver_phone'] ||
                    r['receiver_tel'] ||
                    r['mobile_receiver'] ||
                    r['tel_receiver'] ||
                    r['เบอร์ผู้รับ'] ||
                    r['เบอร์โทรผู้รับ'] ||
                    r['โทรผู้รับ'] ||
                    r['โทรศัพท์ผู้รับ'] ||
                    r['หมายเลขโทรศัพท์ผู้รับ'] ||
                    r['หมายเลขผู้รับ'] ||
                    (out.receiver_phone != null ? String(out.receiver_phone) : '') ||
                    null;

                /** ค่าขนส่ง — หลายไฟล์ J&T ใช้ชื่อคอลัมน์ไม่ตรงกัน */
                const feeRaw =
                    r['shipping_fee'] ||
                    r['total_shipping_fee'] ||
                    r['fee'] ||
                    r['ค่าส่ง'] ||
                    r['ค่าขนส่ง'] ||
                    r['ค่าบริการจัดส่ง'] ||
                    r['ค่าจัดส่ง'] ||
                    r['ค่าจัดส่งรวม'] ||
                    r['รวมค่าขนส่ง'] ||
                    r['ราคาค่าส่ง'] ||
                    r['ราคา'] ||
                    (out.shipping_fee != null ? String(out.shipping_fee) : '') ||
                    (out.total_shipping_fee != null ? String(out.total_shipping_fee) : '');
                const shipping_fee = feeRaw ? parseFloat(String(feeRaw).replace(/,/g, '')) || 0 : 0;

                let platform =
                    r['platform'] ||
                    r['order_source'] ||
                    r['แพลตฟอร์ม'] ||
                    r['channel'] ||
                    r['marketplace'] ||
                    r['ช่องทาง'] ||
                    r['ตลาด'] ||
                    r['sales_channel'] ||
                    (out.platform != null ? String(out.platform) : '') ||
                    null;

                /** รายงานบางแบบใส่รหัส Marketplace ในคอลัมน์ "ชื่อลูกค้า" */
                if (sender && looksLikePlatformMarketplaceCode(sender)) {
                    if (!platform?.trim()) platform = sender.trim();
                    const altSender =
                        r['ชื่อผู้ส่งจริง'] ||
                        r['ชื่อผู้ส่ง'] ||
                        r['ผู้ส่ง'] ||
                        r['ชื่อร้าน'] ||
                        r['ชื่อร้านค้า'] ||
                        '';
                    sender = altSender.trim() ? altSender.trim() : null;
                }

                const bookingCoerced =
                    booking != null && String(booking).trim() !== ''
                        ? coerceValue(
                              'booking_date',
                              String(booking),
                              typeByName.get('booking_date') || 'timestamp with time zone',
                          )
                        : null;

                if (allowed.has('awb_number')) out.awb_number = awb.trim();
                if (allowed.has('booking_date')) out.booking_date = bookingCoerced;
                if (allowed.has('sender_name')) out.sender_name = sender?.trim() || null;
                if (allowed.has('sender_phone')) out.sender_phone = senderPhone?.trim() || null;
                if (allowed.has('receiver_name')) out.receiver_name = receiver?.trim() || null;
                if (allowed.has('receiver_phone')) out.receiver_phone = receiverPhone?.trim() || null;
                if (allowed.has('shipping_fee')) out.shipping_fee = shipping_fee;
                if (allowed.has('platform')) out.platform = platform?.trim() || null;

                return out;
            })
            .filter((r) => r.awb_number && String(r.awb_number).trim().length > 0);

        if (mapped.length === 0) {
            return NextResponse.json({ error: 'No valid rows found (awb_number is required)' }, { status: 400 });
        }

        const CHUNK = 500;
        let inserted = 0;
        let skipped = 0;

        for (let i = 0; i < mapped.length; i += CHUNK) {
            const chunk = mapped.slice(i, i + CHUNK);
            const { data, error } = await supabaseAdmin
                .from('jt_shipments')
                .upsert(chunk, { onConflict: 'awb_number', ignoreDuplicates: false })
                .select('awb_number');

            if (error) {
                console.error('Upsert error at chunk', i, error);
                skipped += chunk.length;
            } else {
                inserted += data?.length || 0;
            }
        }

        return NextResponse.json({
            success: true,
            total: rows.length,
            inserted,
            skipped,
            columnsRecognized: colMeta.length,
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
