import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { deleteCategory } from './actions';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
    // We can use the public client for reading if RLS allows public read.
    // Implementation Plan said: "Public read categories ... using (true)".
    // So 'supabase' (anon) is fine for fetching list.
    const { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        return <div className="text-red-500">Error loading categories: {error.message}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Categories</h1>
                <Link
                    href="/admin/categories/new"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                    + Add Category
                </Link>
            </div>

            <div className="bg-white dark:bg-zinc-900 shadow rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Sort</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Slug</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-zinc-200 dark:divide-zinc-800">
                        {categories?.map((category) => (
                            <tr key={category.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">{category.sort_order}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{category.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">{category.slug}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {category.is_active ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Active
                                        </span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                            Inactive
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link href={`/admin/categories/${category.id}`} className="text-blue-600 hover:text-blue-900 mr-4">
                                        Edit
                                    </Link>
                                    {/* Delete button (client component or form) */}
                                    <form action={deleteCategory.bind(null, category.id)} className="inline">
                                        <button type="submit" className="text-red-600 hover:text-red-900" onClick={() => !confirm('Are you sure?') && event?.preventDefault()}>Delete</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {categories?.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-zinc-500">No categories found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
