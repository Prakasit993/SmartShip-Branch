import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { deleteBundle } from './actions';

export const dynamic = 'force-dynamic';

export default async function BundlesPage() {
    const { data: bundles, error } = await supabase
        .from('bundles')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });

    if (error) {
        return <div className="text-red-500">Error loading bundles: {error.message}</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Bundles</h1>
                <Link
                    href="/admin/bundles/new"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                    + Add Bundle
                </Link>
            </div>

            <div className="bg-white dark:bg-zinc-900 shadow rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-zinc-200 dark:divide-zinc-800">
                        {bundles?.map((bundle) => (
                            <tr key={bundle.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{bundle.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500 capitalize">{bundle.type}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">฿{bundle.price}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
                                    {/* @ts-ignore: join handling */}
                                    {bundle.categories?.name || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {bundle.is_active ? (
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
                                    <Link href={`/admin/bundles/${bundle.id}`} className="text-blue-600 hover:text-blue-900 mr-4">
                                        Edit
                                    </Link>
                                    <form action={deleteBundle.bind(null, bundle.id)} className="inline">
                                        <button type="submit" className="text-red-600 hover:text-red-900">Delete</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {bundles?.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-center text-zinc-500">No bundles found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
