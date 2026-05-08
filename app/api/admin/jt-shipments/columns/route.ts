import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApiAuth } from '@/lib/adminApiAuth';

type RpcRow = { column_name: string; data_type: string };

/** GET — รายชื่อคอลัมน์จริงของตาราง jt_shipments (ใช้เช็คกับไฟล์ Import) */
export async function GET(request: Request) {
    try {
        const denied = await requireAdminApiAuth('admin-or-staff', request);
        if (denied) return denied;

        const { data, error } = await supabaseAdmin.rpc('jt_shipments_import_columns');

        if (error) {
            console.error('[jt_shipments columns]', error);
            return NextResponse.json(
                {
                    error: error.message,
                    hint: 'รัน migration database/db/migrations/20260503_jt_shipments_columns_rpc.sql ใน Supabase SQL Editor',
                    columns: [] as RpcRow[],
                },
                { status: 200 }
            );
        }

        const columns = (data || []) as RpcRow[];
        return NextResponse.json({
            table: 'jt_shipments',
            count: columns.length,
            columns,
            /** ชื่อฟิลด์อย่างเดียว — ใช้เทียบกับหัวคอลัมน์ใน Excel (หลัง normalize เป็น snake_case) */
            names: columns.map((c) => c.column_name),
        });
    } catch (e) {
        console.error('[jt_shipments columns]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
