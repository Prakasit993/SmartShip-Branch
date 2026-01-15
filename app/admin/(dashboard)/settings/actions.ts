'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateSettings(formData: FormData) {
    try {
        const data: Record<string, string> = {};

        // Iterate over all entries
        for (const [key, value] of Array.from(formData.entries())) {
            if (typeof value === 'string') {
                if (key === 'hero_images') {
                    // Skip - handled separately below
                } else {
                    data[key] = value;
                }
            }
        }

        // Handle hero_images separately
        const heroImages = formData.get('hero_images') as string;
        if (heroImages) {
            const images = heroImages.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            const { error: heroError } = await supabaseAdmin
                .from('settings')
                .upsert({ key: 'hero_images', value: JSON.stringify(images) }, { onConflict: 'key' });

            if (heroError) {
                console.error('Error saving hero_images:', heroError);
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

        revalidatePath('/admin/settings');
        revalidatePath('/');
        revalidatePath('/contact');

    } catch (error) {
        console.error('updateSettings error:', error);
        redirect('/admin/settings?error=1');
    }

    redirect('/admin/settings?saved=1');
}
