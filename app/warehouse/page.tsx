import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WarehouseUploadClient } from './WarehouseUploadClient';

export const dynamic = 'force-dynamic';

export default async function WarehousePage() {
    const cookieStore = await cookies();
    const adminSession = cookieStore.get('admin_session')?.value;
    const adminRole = cookieStore.get('admin_role')?.value;

    if (!adminSession && !adminRole) {
        redirect('/admin/login');
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#050913] via-[#070c18] to-[#090f1f] text-zinc-100">
            <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-16">

                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 ring-1 ring-amber-500/25 text-2xl">
                            📦
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                                คลังสินค้า
                            </h1>
                            <p className="text-sm text-zinc-500">นำเข้าข้อมูลจากไฟล์ Excel หรือ CSV</p>
                        </div>
                    </div>
                </div>

                {/* Upload card */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/[0.04]">
                    <div className="mb-6">
                        <h2 className="text-base font-semibold text-white">อัปโหลดไฟล์</h2>
                        <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                            การเชื่อมต่อกับระบบนำเข้ากำหนดไว้ที่เซิร์ฟเวอร์แล้ว — ไม่ต้องวางลิงก์หรือรหัสลับในหน้านี้
                        </p>
                    </div>
                    <WarehouseUploadClient />
                </div>

                {/* Back link */}
                <div className="mt-8 text-center">
                    <Link
                        href="/admin/stock"
                        className="text-sm text-zinc-600 transition hover:text-zinc-400"
                    >
                        ← กลับหน้าคลังสินค้า
                    </Link>
                </div>

            </div>
        </div>
    );
}
