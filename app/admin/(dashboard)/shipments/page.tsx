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

export default function JTShipmentsPage() {
    const [pageSize, setPageSize] = useState(20);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [count, setCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'booking_date' | 'awb_number' | 'sender_name' | 'receiver_name' | 'shipping_fee'>('booking_date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [compactView, setCompactView] = useState(false);
    const [hideDuplicateAwb, setHideDuplicateAwb] = useState(true);

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
        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (search) params.set('search', search);
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        params.set('sort_by', sortBy);
        params.set('sort_order', sortOrder);

        const res = await fetch(`/api/admin/jt-shipments?${params}`);
        const json = await res.json();
        setShipments(json.data || []);
        setCount(json.count || 0);
        setLoading(false);
    }, [page, pageSize, search, dateFrom, dateTo, sortBy, sortOrder]);

    // Total count once
    useEffect(() => {
        fetch('/api/admin/jt-shipments?page=1&limit=1')
            .then(r => r.json())
            .then(j => setTotalCount(j.count || 0));
    }, []);

    const totalPages = Math.ceil(count / pageSize);
    const visibleShipments = hideDuplicateAwb
        ? shipments.filter((item, index, arr) => arr.findIndex(s => s.awb_number === item.awb_number) === index)
        : shipments;
    const hasFilters = Boolean(search || dateFrom || dateTo);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (totalPages > 0 && page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const handleDelete = async (id: string | number) => {
        const res = await fetch(`/api/admin/jt-shipments?id=${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('🗑️ ลบรายการแล้ว'); setDeleteId(null); fetchData(); }
        else { const j = await res.json(); alert('Error: ' + j.error); }
    };

    return (
        <div className="space-y-5 max-w-7xl mx-auto pb-20 text-zinc-100">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg font-medium text-sm animate-bounce">
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="rounded-2xl border border-zinc-800 bg-[#0a1326]/95 p-4 md:p-5 flex items-center justify-between flex-wrap gap-3 shadow-sm">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">🚚 J&T Shipments</h1>
                    <div className="text-zinc-500 text-xs md:text-sm mt-2 flex items-center flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold">
                            ทั้งหมด {totalCount.toLocaleString()}
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold">
                            ผลลัพธ์ {count.toLocaleString()}
                        </span>
                        {hideDuplicateAwb && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-semibold">
                                ซ่อน AWB ซ้ำ
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition shadow-sm">
                        📥 Import Excel
                    </button>
                    <button onClick={() => setModal({ mode: 'add' })}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm">
                        ➕ เพิ่มรายการ
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="bg-[#0a1326]/95 rounded-2xl p-4 border border-zinc-800 flex flex-wrap gap-3 shadow-sm">
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
                    placeholder="🔍 ค้นหา AWB, ผู้ส่ง, ผู้รับ..."
                    className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="self-center text-zinc-400 text-sm">ถึง</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => { setSearch(searchInput); setPage(1); }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition">ค้นหา</button>
                {hasFilters && (
                    <button onClick={() => { setSearch(''); setSearchInput(''); setDateFrom(''); setDateTo(''); setPage(1); }}
                        className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-medium transition">
                        ล้าง
                    </button>
                )}
            </div>

            {/* View Controls */}
            <div className="bg-[#0a1326]/95 rounded-2xl p-4 border border-zinc-800 flex flex-wrap gap-3 items-center shadow-sm">
                <div className="flex items-center gap-2">
                    <label className="text-xs md:text-sm font-medium text-zinc-500">เรียงตาม</label>
                    <select
                        value={sortBy}
                        onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
                        className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
                    >
                        <option value="booking_date">วันที่จอง</option>
                        <option value="awb_number">AWB</option>
                        <option value="sender_name">ชื่อผู้ส่ง</option>
                        <option value="receiver_name">ชื่อผู้รับ</option>
                        <option value="shipping_fee">ค่าส่ง</option>
                    </select>
                </div>

                <button
                    onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setPage(1); }}
                    className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm font-medium hover:bg-zinc-800"
                >
                    {sortOrder === 'desc' ? 'มาก -> น้อย' : 'น้อย -> มาก'}
                </button>

                <div className="flex items-center gap-2">
                    <label className="text-sm text-zinc-500">ต่อหน้า</label>
                    <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-sm"
                    >
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>

                <button
                    onClick={() => setCompactView(v => !v)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${compactView
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-zinc-900 border-zinc-700'}`}
                >
                    {compactView ? 'โหมดกระชับ: เปิด' : 'โหมดกระชับ: ปิด'}
                </button>

                <button
                    onClick={() => setHideDuplicateAwb(v => !v)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${hideDuplicateAwb
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-zinc-900 border-zinc-700'}`}
                >
                    {hideDuplicateAwb ? 'ซ่อน AWB ซ้ำ: เปิด' : 'ซ่อน AWB ซ้ำ: ปิด'}
                </button>
            </div>

            {/* Table */}
            <div className="bg-[#0a1326]/95 rounded-2xl border border-zinc-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-zinc-900/80 border-b border-zinc-800">
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">AWB Number</th>
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">วันที่จอง</th>
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">ผู้ส่ง</th>
                                {!compactView && <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">เบอร์ผู้ส่ง</th>}
                                <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">ผู้รับ</th>
                                {!compactView && <th className="text-left px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">เบอร์ผู้รับ</th>}
                                <th className="text-right px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">ค่าส่ง</th>
                                <th className="text-center px-4 py-3 font-semibold text-zinc-500 whitespace-nowrap">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: compactView ? 6 : 8 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <div className="h-4 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : visibleShipments.length === 0 ? (
                                <tr><td colSpan={compactView ? 6 : 8} className="px-4 py-12 text-center text-zinc-400">ไม่พบข้อมูล</td></tr>
                            ) : visibleShipments.map((s, i) => (
                                <tr key={s.id || i} className="hover:bg-zinc-800/40 even:bg-zinc-900/40 transition group">
                                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{s.awb_number || '-'}</td>
                                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                                        {s.booking_date ? new Date(s.booking_date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                    </td>
                                    <td className="px-4 py-3 font-medium max-w-[140px] truncate">{s.sender_name || '-'}</td>
                                    {!compactView && <td className="px-4 py-3 text-zinc-500 font-mono text-xs whitespace-nowrap">{s.sender_phone || '-'}</td>}
                                    <td className="px-4 py-3 font-medium max-w-[140px] truncate">{s.receiver_name || '-'}</td>
                                    {!compactView && <td className="px-4 py-3 text-zinc-500 font-mono text-xs whitespace-nowrap">{s.receiver_phone || '-'}</td>}
                                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                                        {s.shipping_fee != null
                                            ? <span className={`inline-flex px-2 py-1 rounded-lg text-xs ${Number(s.shipping_fee) > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'text-zinc-400'}`}>฿{Number(s.shipping_fee).toLocaleString()}</span>
                                            : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-1 opacity-100 md:opacity-70 md:group-hover:opacity-100 transition">
                                            <button onClick={() => setModal({ mode: 'edit', data: s })}
                                                className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition text-xs font-bold shadow-sm"
                                                title="แก้ไข">✏️</button>
                                            <button onClick={() => setDeleteId(s.id ?? null)}
                                                className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-800/50 transition text-xs font-bold shadow-sm"
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
                            หน้า {page}/{totalPages} — {Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} จาก {count.toLocaleString()}
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
