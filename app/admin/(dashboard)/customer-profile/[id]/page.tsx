import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CustomerProfileDetailClient } from './CustomerProfileDetailClient';

export const metadata: Metadata = {
    title: 'รายละเอียดลูกค้า — SmartShip Admin',
    description: 'KPI พัสดุ น้ำหนักถูกปรับ COD และรายการพัสดุของลูกค้ารายคน',
};

export const dynamic = 'force-dynamic';

export default async function CustomerProfileDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const store = await cookies();
    const roleCookie = store.get('admin_role')?.value;
    const adminSession = store.get('admin_session')?.value;
    const isAdmin =
        roleCookie === 'admin' || adminSession === 'admin' || adminSession === 'true';

    return <CustomerProfileDetailClient id={id} isAdmin={isAdmin} />;
}
