
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedImages() {
    console.log('Seeding images for Test Product...');

    const image_urls = [
        'https://placehold.co/600x400/252f3f/white?text=Main+Angle',
        'https://placehold.co/600x400/252f3f/white?text=Side+View',
        'https://placehold.co/600x400/252f3f/white?text=Top+View',
        'https://placehold.co/600x400/252f3f/white?text=Inside',
        'https://placehold.co/600x400/252f3f/white?text=Dimension'
    ];

    const { data, error } = await supabase
        .from('products')
        .update({ image_urls: image_urls })
        .eq('name', 'Test Product (สินค้าทดสอบ)')
        .select();

    if (error) {
        console.error('Error updating product:', error);
    } else {
        console.log('Success! Updated product images:', data);
    }
}

seedImages();
