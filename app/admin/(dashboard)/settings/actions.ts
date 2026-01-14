'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';

export async function updateSettings(formData: FormData) {
    const data: Record<string, string> = {};

    // Iterate over all entries
    for (const [key, value] of Array.from(formData.entries())) {
        if (typeof value === 'string') {
            if (key === 'hero_images') {
                // Split by newline and filter empty lines
                const images = value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                data[key] = JSON.stringify(images); // Store as JSON string directly here, so next loop handles it lightly
                // WAIT: The next loop stringifies AGAIN.
                // Current logic: 
                // for (const [key, value] of Object.entries(data)) { ... update({ value: JSON.stringify(value) }) }
                // If I set data[key] to a JSON string here, it will get double stringified: "[\"url\"]"
                // So I should pass the ARRAY? No `data` is Record<string, string>.
                // I need to modify the LOOP to not stringify if it's already stringified or handle it differently.
                // OR simpler: Just store the raw string in `data` but formatted properly?
                // No, the DB value expects JSON string if we want structure.

                // Let's modify the loop logic in the file instead to be smarter or just special case here.
                // Actually, if I change data[key] to be the ARRAY, typescript complains Record<string, string>.
                // Let's change the generic loop to NOT JSON.stringify blindly if it detects special keys? 
                // Or better: Let's just handle `hero_images` SEPARATELY and delete it from `data` so the loop doesn't process it.
            } else {
                data[key] = value;
            }
        }
    }

    // Handle hero_images separately
    const heroImages = formData.get('hero_images') as string;
    if (heroImages) {
        const images = heroImages.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const { data: existing } = await supabaseAdmin.from('settings').select('*').eq('key', 'hero_images').single();
        if (existing) {
            await supabaseAdmin.from('settings').update({ value: JSON.stringify(images) }).eq('key', 'hero_images');
        } else {
            await supabaseAdmin.from('settings').insert({ key: 'hero_images', value: JSON.stringify(images) });
        }
        // prevent generic loop from overwriting with raw string
        delete data['hero_images'];
    }

    // Upsert each key
    for (const [key, value] of Object.entries(data)) {
        // Check if exists
        const { data: existing } = await supabaseAdmin.from('settings').select('*').eq('key', key).single();

        if (existing) {
            await supabaseAdmin.from('settings').update({ value: JSON.stringify(value) }).eq('key', key);
        } else {
            await supabaseAdmin.from('settings').insert({ key, value: JSON.stringify(value) });
        }
    }

    revalidatePath('/admin/settings');
    revalidatePath('/'); // Update home
    revalidatePath('/contact'); // Update contact page
}
