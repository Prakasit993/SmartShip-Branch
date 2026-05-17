import type { Metadata } from 'next';
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
    return <CustomerProfileDetailClient id={id} />;
}
