import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import BulkDiscountList from './BulkDiscountList';

export const dynamic = 'force-dynamic';

interface BulkDiscount {
    id: number;
    name: string;
    description: string | null;
    min_quantity: number;
    discount_type: 'percentage' | 'fixed_per_item' | 'fixed_total';
    discount_value: number;
    applies_to: 'all' | 'category' | 'bundle';
    target_id: number | null;
    is_active: boolean;
    starts_at: string | null;
    expires_at: string | null;
    created_at: string;
}

export default async function BulkDiscountsPage() {
    const { data: discounts, error } = await supabaseAdmin
        .from('bulk_discounts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching bulk discounts:', error);
    }

    const activeCount = discounts?.filter(d => d.is_active).length || 0;

    return (
        <div className="space-y-6 pb-20">
            <AdminPageHeader
                title="ส่วนลดซื้อเยอะ"
                description="จัดการส่วนลดเมื่อซื้อครบจำนวนที่กำหนด"
                titleLeft={<span aria-hidden>💰</span>}
                actions={
                    <Link
                        href="/admin/bulk-discounts/new"
                        title="ไปหน้าสร้างส่วนลดซื้อเยอะใหม่"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-sm shadow-sm"
                    >
                        + เพิ่มส่วนลดใหม่
                    </Link>
                }
            />

            {/* Stats */}
            <div
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
                role="region"
                aria-label="สรุปจำนวนส่วนลดซื้อเยอะ"
            >
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        {discounts?.length || 0}
                    </div>
                    <div className="text-sm text-zinc-500">ทั้งหมด</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="text-2xl font-bold text-green-600">
                        {activeCount}
                    </div>
                    <div className="text-sm text-zinc-500">เปิดใช้งาน</div>
                </div>
            </div>

            {/* Discount List */}
            <BulkDiscountList discounts={(discounts as BulkDiscount[]) || []} />
        </div>
    );
}
