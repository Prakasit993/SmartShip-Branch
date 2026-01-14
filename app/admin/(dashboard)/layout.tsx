import { cookies } from 'next/headers';
import Link from 'next/link';
import AdminSidebar from './AdminSidebar';
import AdminClientWrapper from './AdminClientWrapper';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = cookies();
    const role = (await cookieStore).get('admin_session')?.value || 'staff';

    return (
        <AdminClientWrapper>
            <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
                {/* Sidebar */}
                <AdminSidebar role={role} />

                {/* Main Content */}
                <div className="flex-1 flex flex-col md:ml-64 transition-all duration-300">
                    <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
        </AdminClientWrapper>
    );
}
