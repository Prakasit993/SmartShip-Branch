import { cookies } from 'next/headers';
import Link from 'next/link';
import AdminSidebar from './AdminSidebar';
import AdminClientWrapper from './AdminClientWrapper';
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
            <div className="flex min-h-screen bg-gradient-to-b from-[#050913] via-[#070c18] to-[#090f1f] text-zinc-100">
                {/* Sidebar - Desktop */}
                <AdminSidebar role={role} />

                {/* Main Content */}
                <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300">
                    <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 pb-24 md:pb-8 overflow-y-auto">
                        {children}
                    </main>
                </div>

                {/* Bottom Navigation - Mobile */}
                <AdminBottomNav />
            </div>
        </AdminClientWrapper>
    );
}
