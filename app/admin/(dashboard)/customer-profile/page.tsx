import type { Metadata } from 'next';
import { CustomerProfileListClient } from './CustomerProfileListClient';

export const metadata: Metadata = {
    title: 'โปรไฟล์ลูกค้า — SmartShip Admin',
    description: 'รายชื่อลูกค้าทั้งหมด แยก VIP / ทั่วไป พร้อมจำนวนพัสดุที่ส่งผ่าน J&T',
};

export const dynamic = 'force-dynamic';

export default function CustomerProfilePage() {
    return <CustomerProfileListClient />;
}
