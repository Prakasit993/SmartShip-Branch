import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { data: returnTypes, error: rtErr } = await supabaseAdmin
        .from('jt_shipments')
        .select('return_type, exception_reason, latest_scan_type')
        .limit(20);
    console.log("Return Types:", returnTypes, "Err:", rtErr);

    const { count: nullCount } = await supabaseAdmin.from('jt_shipments').select('awb_number', { count: 'exact', head: true }).or('return_type.eq.NULL,return_type.is.null');
    const { count: totalCount } = await supabaseAdmin.from('jt_shipments').select('awb_number', { count: 'exact', head: true });
    
    console.log("Total:", totalCount, "Null/NULL count:", nullCount);
}

main();
