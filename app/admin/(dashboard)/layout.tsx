import { cookies } from 'next/headers';
import AdminSidebar from './AdminSidebar';
import AdminClientWrapper from './AdminClientWrapper';
import { AdminGlobalDate } from '../components/AdminGlobalDate';
import AdminBottomNav from '../components/AdminBottomNav';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = cookies();
    const store = await cookieStore;
    const roleCookie = store.get('admin_role')?.value;
    const adminSession = store.get('admin_session')?.value;
    const role = roleCookie || (adminSession === 'admin' || adminSession === 'true' ? 'admin' : 'staff');

    return (
        <AdminClientWrapper>
            <div className="flex min-h-[100dvh] min-h-screen bg-gradient-to-b from-[#050913] via-[#070c18] to-[#090f1f] text-zinc-100">
                <AdminSidebar role={role} />

                <div className="flex flex-1 flex-col min-w-0 min-h-0 md:ml-64 transition-all duration-300">
                    <div className="hidden md:flex sticky top-0 z-30 shrink-0 items-center justify-end gap-3 border-b border-zinc-800/80 bg-[#070c18]/95 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
                        <AdminGlobalDate className="text-right text-sm font-medium text-zinc-100" />
                    </div>
                    <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 pt-[5.75rem] sm:p-4 sm:pt-[5.75rem] md:p-6 md:pt-6 lg:p-8 lg:pt-8 pb-6 md:pb-10">
                        <div className="mx-auto w-full max-w-[1600px] min-w-0">{children}</div>
                    </main>
                </div>

                <AdminBottomNav />
            </div>
        </AdminClientWrapper>
    );
}
