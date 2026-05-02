import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { rows } = body as { rows: Record<string, string>[] };

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: 'No data provided' }, { status: 400 });
        }

        // Map CSV columns → DB columns (flexible header matching)
        const mapped = rows.map((row) => {
            // Normalize keys: lowercase + trim
            const r: Record<string, string> = {};
            Object.entries(row).forEach(([k, v]) => {
                r[k.toLowerCase().trim().replace(/\s+/g, '_')] = String(v ?? '').trim();
            });

            return {
                awb_number: r['awb_number'] || r['awb'] || r['tracking'] || r['หมายเลข'] || r['หมายเลข_awb'] || r['หมายเลข_tracking'] || '',
                booking_date: r['booking_date'] || r['date'] || r['วันที่'] || r['เวลาที่ส่งพัสดุ'] || r['วันที่จอง'] || null,
                sender_name: r['sender_name'] || r['sender'] || r['ผู้ส่ง'] || r['ชื่อลูกค้า'] || r['ชื่อผู้ส่ง'] || null,
                sender_phone: r['sender_phone'] || r['sender_tel'] || r['เบอร์ผู้ส่ง'] || r['เบอร์โทรผู้ส่ง'] || null,
                receiver_name: r['receiver_name'] || r['receiver'] || r['ผู้รับ'] || r['ชื่อผู้รับ'] || null,
                receiver_phone: r['receiver_phone'] || r['receiver_tel'] || r['เบอร์ผู้รับ'] || r['เบอร์โทรผู้รับ'] || null,
                shipping_fee: parseFloat(r['shipping_fee'] || r['fee'] || r['ค่าส่ง'] || r['ราคา'] || '0') || 0,
            };
        }).filter(r => r.awb_number); // skip rows without AWB

        if (mapped.length === 0) {
            return NextResponse.json({ error: 'No valid rows found (awb_number is required)' }, { status: 400 });
        }

        // Batch upsert in chunks of 500
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
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
