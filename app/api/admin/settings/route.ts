import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const data: Record<string, string> = {};

        // Iterate over all entries
        for (const [key, value] of Array.from(formData.entries())) {
            if (typeof value === 'string') {
                if (key === 'hero_images') {
                    // Handle hero_images separately - store as JSON array
                    const images = value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                    const { error } = await supabaseAdmin
                        .from('settings')
                        .upsert({ key: 'hero_images', value: JSON.stringify(images) }, { onConflict: 'key' });

                    if (error) {
                        console.error('Error saving hero_images:', error);
                    }
                } else {
                    data[key] = value;
                }
            }
        }

        // Upsert each key
        for (const [key, value] of Object.entries(data)) {
            const { error } = await supabaseAdmin
                .from('settings')
                .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });

            if (error) {
                console.error(`Error saving ${key}:`, error);
            }
        }

        // Revalidate paths
        revalidatePath('/admin/settings');
        revalidatePath('/');
        revalidatePath('/contact');

        // Redirect back with success
        return NextResponse.redirect(new URL('/admin/settings?saved=1', request.url));
    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.redirect(new URL('/admin/settings?error=1', request.url));
    }
}
