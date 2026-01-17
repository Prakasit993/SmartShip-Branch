import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';
import { deleteCategory } from './actions';
import ToastListener from '@app/admin/components/ToastListener';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
    const { data: categories, error } = await supabaseAdmin
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error) {
        return <div className="text-red-500">❌ เกิดข้อผิดพลาด: {error.message}</div>;
    }

    return (
        <div className="space-y-6 pb-20">
            <ToastListener />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">📂 หมวดหมู่</h1>
                    <p className="text-zinc-500 text-sm">จัดการหมวดหมู่สินค้า</p>
                </div>
                <Link
                    href="/admin/categories/new"
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
                >
                    ➕ เพิ่มหมวดหมู่
                </Link>
            </div>

            <div className="bg-white dark:bg-zinc-900 shadow rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ลำดับ</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ชื่อ</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Slug</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">สถานะ</th>
                            <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-zinc-200 dark:divide-zinc-800">
                        {categories?.map((category) => (
                            <tr key={category.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-center">
                                    <span className="w-8 h-8 inline-flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-full font-bold">
                                        {category.sort_order}
                                    </span>
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">{category.name}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-zinc-500 hidden sm:table-cell">{category.slug}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                                    {category.is_active ? (
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                            ✅ ใช้งาน
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                            ⛔ ปิด
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <Link href={`/admin/categories/${category.id}`} className="text-blue-600 hover:text-blue-900">
                                        ✏️ แก้ไข
                                    </Link>
                                    <form action={deleteCategory.bind(null, category.id)} className="inline">
                                        <button type="submit" className="text-red-600 hover:text-red-900">🗑️ ลบ</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {categories?.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                    📭 ยังไม่มีหมวดหมู่
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
