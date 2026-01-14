'use client';

import { createCategory } from '../actions';

export default function NewCategoryPage() {
    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Add New Category</h1>

            <form action={createCategory} className="space-y-6 bg-white dark:bg-zinc-900 p-6 rounded-lg shadow border border-zinc-200 dark:border-zinc-800">
                <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                        name="name"
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                        placeholder="e.g. Snack Boxes"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Slug</label>
                    <input
                        name="slug"
                        required
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                        placeholder="e.g. snack-boxes"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Sort Order</label>
                    <input
                        name="sort_order"
                        type="number"
                        defaultValue={0}
                        className="w-full px-4 py-2 border rounded-md dark:bg-black dark:border-zinc-700"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Create Category
                    </button>
                </div>
            </form>
        </div>
    );
}
