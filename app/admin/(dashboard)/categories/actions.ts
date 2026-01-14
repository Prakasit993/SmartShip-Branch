'use server';

import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function createCategory(formData: FormData) {
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const sort_order = parseInt(formData.get('sort_order') as string) || 0;

    // Basic validation
    if (!name || !slug) {
        return { error: 'Name and Slug are required' };
    }

    const { error } = await supabaseAdmin
        .from('categories')
        .insert({ name, slug, sort_order, is_active: true });

    if (error) {
        console.error('Error creating category:', error);
        return { error: error.message };
    }

    revalidatePath('/admin/categories');
    redirect('/admin/categories');
}

export async function updateCategory(id: number, formData: FormData) {
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const sort_order = parseInt(formData.get('sort_order') as string) || 0;
    const is_active = formData.get('is_active') === 'on';

    const { error } = await supabaseAdmin
        .from('categories')
        .update({ name, slug, sort_order, is_active })
        .eq('id', id);

    if (error) {
        console.error('Error updating category:', error);
        throw new Error(error.message);
    }

    revalidatePath('/admin/categories');
    redirect('/admin/categories');
}

export async function deleteCategory(id: number) {
    const { error } = await supabaseAdmin
        .from('categories')
        .delete()
        .eq('id', id);

    if (error) return { error: error.message };
    revalidatePath('/admin/categories');
}
