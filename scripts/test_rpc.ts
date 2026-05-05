import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { data, error } = await supabaseAdmin.rpc('jt_dashboard_fixed_totals', {
        p_date_from: '',
        p_date_to: ''
    });
    console.log('Error:', error);
    console.log('Data:', data);
}

main();
