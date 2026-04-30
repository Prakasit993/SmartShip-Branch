import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/admin/jt-shipments/n8n-sync
 *
 * เรียกจาก n8n "HTTP Request" node หลัง "Split in Batches"
 * n8n จะส่งข้อมูลมาเป็น batch ละ 500 แถว (ตั้งใน Split in Batches node)
 *
 * Body ที่ n8n ส่งมาได้ 2 รูปแบบ:
 *   1. { rows: [...] }         ← กำหนด field name ใน n8n เอง
 *   2. [...] (array โดยตรง)   ← ถ้าส่ง body เป็น array
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Support both { rows: [...] } and [...] directly
        const rawRows: Record<string, unknown>[] = Array.isArray(body)
            ? body
            : Array.isArray(body?.rows)
                ? body.rows
                : body?.items ?? [];

        if (!rawRows.length) {
            return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
        }

        // Normalize column names (case-insensitive, trim whitespace)
        const rows = rawRows.map((row) => {
            const r: Record<string, string> = {};
            Object.entries(row).forEach(([k, v]) => {
                r[k.toLowerCase().trim().replace(/\s+/g, '_')] = String(v ?? '').trim();
            });

            // Map common J&T Excel column names
            return {
                awb_number:
                    r['awb_number'] || r['awb no'] || r['awb no.'] || r['tracking_no'] ||
                    r['หมายเลขพัสดุ'] || r['เลข awb'] || '',
                booking_date:
                    r['booking_date'] || r['booking date'] || r['วันที่จอง'] || r['วันที่'] || null,
                sender_name:
                    r['sender_name'] || r['sender name'] || r['ชื่อผู้ส่ง'] || r['ผู้ส่ง'] || null,
                sender_phone:
                    r['sender_phone'] || r['sender phone'] || r['เบอร์ผู้ส่ง'] || r['โทรผู้ส่ง'] || null,
                receiver_name:
                    r['receiver_name'] || r['receiver name'] || r['ชื่อผู้รับ'] || r['ผู้รับ'] || null,
                receiver_phone:
                    r['receiver_phone'] || r['receiver phone'] || r['เบอร์ผู้รับ'] || r['โทรผู้รับ'] || null,
                shipping_fee:
                    parseFloat(r['shipping_fee'] || r['shipping fee'] || r['ค่าส่ง'] || r['ราคา'] || '0') || 0,
            };
        }).filter(r => r.awb_number.length > 0);

        if (!rows.length) {
            return NextResponse.json({
                success: true,
                message: 'No valid rows (awb_number missing)',
                inserted: 0,
                skipped: rawRows.length,
            });
        }

        // Upsert batch (onConflict awb_number = update)
        const { data, error } = await supabaseAdmin
            .from('jt_shipments')
            .upsert(rows, { onConflict: 'awb_number', ignoreDuplicates: false })
            .select('awb_number');

        if (error) {
            console.error('[n8n-sync] Upsert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            batch_size: rawRows.length,
            inserted: data?.length || 0,
            skipped: rawRows.length - rows.length,
        });

    } catch (e) {
        console.error('[n8n-sync] Error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
