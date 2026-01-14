import { supabase } from '@/lib/supabaseClient';
import { updateCategory } from '../actions';
import { notFound } from 'next/navigation';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    // Fetch category
    const { data: category, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !category) {
        notFound();
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Edit Category</h1>

            <form action={updateCategory.bind(null, category.id)} className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-lg shadow border border-zinc-200 dark:border-zinc-800">
                <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                        name="name"
                        defaultValue={category.name}
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Slug</label>
                    <input
                        name="slug"
                        defaultValue={category.slug}
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Sort Order</label>
                    <input
                        name="sort_order"
                        type="number"
                        defaultValue={category.sort_order}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        name="is_active"
                        type="checkbox"
                        defaultChecked={category.is_active}
                        id="is_active"
                    />
                    <label htmlFor="is_active">Active</label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => window.history.back()} // Note: this is client-side only effectively if JS on, but okay for MVP admin
                        className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Update Category
                    </button>
                </div>
            </form>
        </div>
    );
}
