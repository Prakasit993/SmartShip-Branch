'use client';

import { useCallback, useEffect, useState } from 'react';
import ImportModal from './ImportModal';
import ShipmentModal from './ShipmentModal';

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

const PAGE_SIZE = 50;

export default function JTShipmentsPage() {
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [count, setCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [loading, setLoading] = useState(true);

    const [modal, setModal] = useState<null | { mode: 'add' | 'edit'; data?: Shipment }>(null);
    const [showImport, setShowImport] = useState(false);
    const [deleteId, setDeleteId] = useState<string | number | null>(null);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (search) params.set('search', search);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);

        const res = await fetch(`/api/admin/jt-shipments?${params}`);
        const json = await res.json();
        setShipments(json.data || []);
        setCount(json.count || 0);
        setLoading(false);
    }, [page, search, dateFrom, dateTo]);

    // Total count once
    useEffect(() => {
        fetch('/api/admin/jt-shipments?page=1&limit=1')
            .then(r => r.json())
            .then(j => setTotalCount(j.count || 0));
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async (id: string | number) => {
        const res = await fetch(`/api/admin/jt-shipments?id=${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('🗑️ ลบรายการแล้ว'); setDeleteId(null); fetchData(); }
        else { const j = await res.json(); alert('Error: ' + j.error); }
    };

    const totalPages = Math.ceil(count / PAGE_SIZE);

    return (
        <div className="space-y-5 max-w-7xl mx-auto pb-20">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg font-medium text-sm animate-bounce">
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">🚚 J&T Shipments</h1>
                    <p className="text-zinc-500 text-sm mt-1">รวม <span className="font-bold text-blue-600">{totalCount.toLocaleString()}</span> รายการ</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition">
                        📥 Import Excel
                    </button>
                    <button onClick={() => setModal({ mode: 'add' })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition">
                        ➕ เพิ่มรายการ
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-3">
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
                    placeholder="🔍 ค้นหา AWB, ผู้ส่ง, ผู้รับ..."
                    className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="self-center text-zinc-400 text-sm">ถึง</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => { setSearch(searchInput); setPage(1); }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition">ค้นหา</button>
                {(search || dateFrom || dateTo) && (
                    <button onClick={() => { setSearch(''); setSearchInput(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                        className="px-4 py-2.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium transition">
                        ล้าง
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">AWB Number</th>
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">วันที่จอง</th>
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">ผู้ส่ง</th>
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">เบอร์ผู้ส่ง</th>
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">ผู้รับ</th>
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">เบอร์ผู้รับ</th>
                                <th className="text-right px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">ค่าส่ง</th>
                                <th className="text-center px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: 8 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : shipments.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
                            ) : shipments.map((s, i) => (
                                <tr key={s.id || i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition group">
                                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{s.awb_number || '-'}</td>
                                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                                        {s.booking_date ? new Date(s.booking_date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                    </td>
                                    <td className="px-4 py-3 font-medium max-w-[140px] truncate">{s.sender_name || '-'}</td>
                                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs whitespace-nowrap">{s.sender_phone || '-'}</td>
                                    <td className="px-4 py-3 font-medium max-w-[140px] truncate">{s.receiver_name || '-'}</td>
                                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs whitespace-nowrap">{s.receiver_phone || '-'}</td>
                                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                                        {s.shipping_fee != null
                                            ? <span className={Number(s.shipping_fee) > 0 ? 'text-green-600' : 'text-zinc-400'}>฿{Number(s.shipping_fee).toLocaleString()}</span>
                                            : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                            <button onClick={() => setModal({ mode: 'edit', data: s })}
                                                className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition text-xs font-bold"
                                                title="แก้ไข">✏️</button>
                                            <button onClick={() => setDeleteId(s.id ?? null)}
                                                className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-800/50 transition text-xs font-bold"
                                                title="ลบ">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                        <p className="text-sm text-zinc-500">
                            หน้า {page}/{totalPages} — {Math.min((page - 1) * PAGE_SIZE + 1, count)}–{Math.min(page * PAGE_SIZE, count)} จาก {count.toLocaleString()}
                        </p>
                        <div className="flex gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-medium disabled:opacity-40 transition">
                                ← ก่อนหน้า
                            </button>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition">
                                ถัดไป →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirm */}
            {deleteId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setDeleteId(null)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
                        <p className="text-lg font-bold">🗑️ ยืนยันการลบ?</p>
                        <p className="text-sm text-zinc-500">รายการนี้จะถูกลบถาวร ไม่สามารถกู้คืนได้</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteId(null)}
                                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">ยกเลิก</button>
                            <button onClick={() => deleteId !== null && handleDelete(deleteId)}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition">ลบเลย</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {modal && (
                <ShipmentModal
                    mode={modal.mode}
                    data={modal.data}
                    onClose={() => setModal(null)}
                    onSaved={() => {
                        setModal(null);
                        showToast(modal.mode === 'add' ? '✅ เพิ่มรายการแล้ว' : '✅ บันทึกแล้ว');
                        fetchData();
                        fetch('/api/admin/jt-shipments?page=1&limit=1').then(r => r.json()).then(j => setTotalCount(j.count || 0));
                    }}
                />
            )}
            {showImport && (
                <ImportModal
                    onClose={() => setShowImport(false)}
                    onImported={(result) => {
                        showToast(`✅ Import สำเร็จ ${result.inserted.toLocaleString()} แถว`);
                        fetchData();
                        fetch('/api/admin/jt-shipments?page=1&limit=1').then(r => r.json()).then(j => setTotalCount(j.count || 0));
                    }}
                />
            )}
        </div>
    );
}
