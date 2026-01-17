import { supabaseAdmin } from '@app/lib/supabaseAdmin';
import Link from 'next/link';
import { deleteBundle } from './actions';
import ToastListener from '@app/admin/components/ToastListener';

export const dynamic = 'force-dynamic';

export default async function BundlesPage() {
    const { data: bundles, error } = await supabaseAdmin
        .from('bundles')
        .select('*, categories(name)')
        .order('created_at', { ascending: false });

    if (error) {
        return <div className="text-red-500">❌ เกิดข้อผิดพลาด: {error.message}</div>;
    }

    return (
        <div className="space-y-6 pb-20">
            <ToastListener />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">🛒️ ชุดสินค้า (Bundles)</h1>
                    <p className="text-zinc-500 text-sm">จัดการชุดสินค้าที่แสดงในร้าน</p>
                </div>
                <Link
                    href="/admin/bundles/new"
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium"
                >
                    ➕ เพิ่มชุดสินค้า
                </Link>
            </div>

            <div className="bg-white dark:bg-zinc-900 shadow rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ชื่อ</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">ประเภท</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">ราคา</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">หมวดหมู่</th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">สถานะ</th>
                            <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-black divide-y divide-zinc-200 dark:divide-zinc-800">
                        {bundles?.map((bundle) => (
                            <tr key={bundle.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">{bundle.name}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-zinc-500 capitalize hidden sm:table-cell">
                                    {bundle.type === 'fixed' ? '📦 แบบตายตัว' : '⚙️ แบบปรับแต่ง'}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-bold">฿{bundle.price?.toLocaleString()}</td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-zinc-500 hidden sm:table-cell">
                                    {/* @ts-ignore: join handling */}
                                    {bundle.categories?.name || '-'}
                                </td>
                                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm">
                                    {bundle.is_active ? (
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
                                    <Link href={`/admin/bundles/${bundle.id}`} className="text-blue-600 hover:text-blue-900">
                                        ✏️ แก้ไข
                                    </Link>
                                    <form action={deleteBundle.bind(null, bundle.id)} className="inline">
                                        <button type="submit" className="text-red-600 hover:text-red-900">🗑️ ลบ</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                        {bundles?.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                                    📭 ยังไม่มีชุดสินค้า
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
