import { supabaseAdmin } from '@/lib/supabaseAdmin';
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                        💰 ส่วนลดซื้อเยอะ
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        จัดการส่วนลดเมื่อซื้อครบจำนวนที่กำหนด
                    </p>
                </div>
                <a
                    href="/admin/bulk-discounts/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition text-sm"
                >
                    + เพิ่มส่วนลดใหม่
                </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
