import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    let offset = 0;
    let sum = 0;
    for(;;) {
        const { data, error } = await supabaseAdmin.from('jt_shipments').select('total_shipping_fee').range(offset, offset + 1000);
        if (error || !data) break;
        for (const row of data) {
            const val = parseFloat(row.total_shipping_fee);
            if (!isNaN(val)) sum += val;
        }
        if (data.length < 1000) break;
        offset += 1001;
    }
    console.log('Sum via JS:', sum);
}
main();
