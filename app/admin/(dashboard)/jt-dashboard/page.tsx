import type { Metadata } from 'next';
import { JtDashboardPageClient } from './JtDashboardPageClient';

export const metadata: Metadata = {
    title: 'แดชบอร์ดขนส่ง J&T',
    description: 'สรุปพัสดุ ยอด COD และสถิติจากรายงาน JMS — SmartShip Admin',
};

export default function JtDashboardPage() {
    return <JtDashboardPageClient />;
}
