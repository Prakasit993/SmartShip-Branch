'use client';

interface Shipment {
    id?: string | number;
    awb_number?: string;
    booking_date?: string;
    sender_name?: string;
    sender_phone?: string;
    receiver_name?: string;
    receiver_phone?: string;
    shipping_fee?: number;
}

interface Props {
    mode: 'add' | 'edit';
    data?: Shipment;
    onClose: () => void;
    onSaved: () => void;
}

export default function ShipmentModal({ mode, data, onClose, onSaved }: Props) {
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const body: Record<string, string | number | null> = {
            awb_number: String(fd.get('awb_number') || '').trim(),
            booking_date: String(fd.get('booking_date') || '') || null,
            sender_name: String(fd.get('sender_name') || '').trim() || null,
            sender_phone: String(fd.get('sender_phone') || '').trim() || null,
            receiver_name: String(fd.get('receiver_name') || '').trim() || null,
            receiver_phone: String(fd.get('receiver_phone') || '').trim() || null,
            shipping_fee: parseFloat(String(fd.get('shipping_fee') || '0')) || 0,
        };
        if (mode === 'edit' && data?.id) body.id = String(data.id);

        const res = await fetch('/api/admin/jt-shipments', {
            method: mode === 'edit' ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) { alert('Error: ' + json.error); return; }
        onSaved();
    }

    const dtValue = data?.booking_date
        ? data.booking_date.slice(0, 16)
        : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
            <div
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black">
                        {mode === 'add' ? '➕ เพิ่มรายการใหม่' : '✏️ แก้ไขรายการ'}
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-xl">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">AWB Number *</label>
                            <input name="awb_number" required defaultValue={data?.awb_number || ''} placeholder="เช่น 650258240181"
                                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">วันที่จอง</label>
                            <input name="booking_date" type="datetime-local" defaultValue={dtValue}
                                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">ชื่อผู้ส่ง</label>
                            <input name="sender_name" defaultValue={data?.sender_name || ''} placeholder="ชื่อ-นามสกุล"
                                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">เบอร์ผู้ส่ง</label>
                            <input name="sender_phone" defaultValue={data?.sender_phone || ''} placeholder="0xx-xxx-xxxx"
                                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">ชื่อผู้รับ</label>
                            <input name="receiver_name" defaultValue={data?.receiver_name || ''} placeholder="ชื่อ-นามสกุล"
                                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">เบอร์ผู้รับ</label>
                            <input name="receiver_phone" defaultValue={data?.receiver_phone || ''} placeholder="0xx-xxx-xxxx"
                                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-zinc-500 mb-1">ค่าส่ง (บาท)</label>
                            <input name="shipping_fee" type="number" step="0.01" defaultValue={data?.shipping_fee ?? 0}
                                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                            ยกเลิก
                        </button>
                        <button type="submit"
                            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition">
                            {mode === 'add' ? 'เพิ่มรายการ' : 'บันทึก'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
