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
    const [searchField, setSearchField] = useState('all');
    const [searchFieldInput, setSearchFieldInput] = useState('all');
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
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (search) {
            params.set('search', search);
            params.set('search_field', searchField);
        }
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

    const handleDeleteAll = async () => {
        const params = new URLSearchParams({ delete_all: 'true' });
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);

        const res = await fetch(`/api/admin/jt-shipments?${params.toString()}`, { method: 'DELETE' });
        if (res.ok) { 
            showToast(dateFrom || dateTo ? '🗑️ ลบข้อมูลตามวันที่เลือกแล้ว' : '🗑️ ลบข้อมูลทั้งหมดแล้ว'); 
            setConfirmDeleteAll(false); 
            setPage(1);
            fetchData(); 
            fetch('/api/admin/jt-shipments?page=1&limit=1').then(r => r.json()).then(j => setTotalCount(j.count || 0));
        }
        else { const j = await res.json(); alert('Error: ' + j.error); }
    };

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-20 text-zinc-100">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-2xl font-medium text-sm animate-bounce flex items-center gap-2">
                    <span>{toast}</span>
                </div>
            )}

            {/* Page Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                        <span className="p-2.5 bg-blue-500/10 text-blue-500 rounded-2xl">📦</span>
                        J&T Shipments
                    </h1>
                    <p className="text-zinc-400 mt-2 text-sm">จัดการข้อมูลการจัดส่งและนำเข้าข้อมูลจากระบบ J&T Express</p>
                </div>
                <div className="flex gap-2 flex-wrap w-full md:w-auto">
                    <button onClick={() => setConfirmDeleteAll(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-bold transition shadow-sm border border-red-500/20 hover:border-red-500">
                        {dateFrom || dateTo ? '🗑️ ลบตามวันที่' : '🗑️ ลบทั้งหมด'}
                    </button>
                    <button onClick={() => setShowImport(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition shadow-sm">
                        📥 Import Excel
                    </button>
                    <button onClick={() => setModal({ mode: 'add' })}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm">
                        ➕ เพิ่มรายการ
                    </button>
                </div>
            </div>

            {/* KPI Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/60 p-5 rounded-3xl flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <span className="text-sm font-medium text-zinc-400">รายการทั้งหมดในระบบ</span>
                    <div className="text-3xl font-black text-white mt-1">{totalCount.toLocaleString()} <span className="text-sm font-medium text-zinc-500">รายการ</span></div>
                </div>
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/60 p-5 rounded-3xl flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <span className="text-sm font-medium text-zinc-400">ผลลัพธ์การค้นหาปัจจุบัน</span>
                    <div className="text-3xl font-black text-white mt-1">{count.toLocaleString()} <span className="text-sm font-medium text-zinc-500">รายการ</span></div>
                </div>
                <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/60 p-5 rounded-3xl flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-400">ซ่อน AWB ที่ซ้ำกัน</span>
                        <div className={`w-12 h-6 rounded-full flex items-center transition-colors px-1 cursor-pointer ${hideDuplicateAwb ? 'bg-amber-500' : 'bg-zinc-700'}`} onClick={() => setHideDuplicateAwb(v => !v)}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${hideDuplicateAwb ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                    <div className="text-sm font-medium text-zinc-500 mt-2">
                        {hideDuplicateAwb ? 'ระบบกำลังซ่อนรายการ AWB ที่ซ้ำกันในหน้านี้' : 'แสดงรายการที่ซ้ำกันทั้งหมด'}
                    </div>
                </div>
            </div>

            {/* Unified Data Card */}
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl shadow-xl overflow-hidden backdrop-blur-sm flex flex-col">
                
                {/* Toolbar (Search & Filters) */}
                <div className="p-4 border-b border-zinc-800/60 bg-zinc-900/60 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between">
                    {/* Left: Search & Date */}
                    <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto">
                        <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-2xl p-1 overflow-hidden focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                            <select value={searchFieldInput} onChange={(e) => setSearchFieldInput(e.target.value)}
                                className="bg-transparent text-zinc-300 text-sm px-3 py-2 outline-none border-r border-zinc-800/50 font-medium">
                                <option value="all">ค้นหาทั้งหมด</option>
                                <option value="awb_number">AWB Number</option>
                                <option value="sender_name">ผู้ส่ง</option>
                                <option value="receiver_name">ผู้รับ</option>
                                <option value="sender_phone">เบอร์ผู้ส่ง</option>
                                <option value="receiver_phone">เบอร์ผู้รับ</option>
                            </select>
                            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setSearchField(searchFieldInput); setPage(1); } }}
                                placeholder="🔍 ค้นหา..."
                                className="bg-transparent text-sm text-white px-4 py-2 outline-none min-w-[200px]" />
                        </div>
                        <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-2xl p-1 overflow-hidden">
                            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                                className="bg-transparent text-zinc-300 text-sm px-3 py-2 outline-none [color-scheme:dark]" />
                            <div className="flex items-center justify-center px-2 border-l border-r border-zinc-800/50 text-zinc-600">→</div>
                            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                                className="bg-transparent text-zinc-300 text-sm px-3 py-2 outline-none [color-scheme:dark]" />
                        </div>
                        <button onClick={() => { setSearch(searchInput); setSearchField(searchFieldInput); setPage(1); }}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold transition shadow-sm">
                            ค้นหา
                        </button>
                        {hasFilters && (
                            <button onClick={() => { setSearch(''); setSearchInput(''); setSearchField('all'); setSearchFieldInput('all'); setDateFrom(''); setDateTo(''); setPage(1); }}
                                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition">
                                ล้าง
                            </button>
                        )}
                    </div>

                    {/* Right: View Controls */}
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-2xl p-1">
                            <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
                                className="bg-transparent text-zinc-300 text-sm px-3 py-2 outline-none border-r border-zinc-800/50 font-medium">
                                <option value="booking_date">วันที่จอง</option>
                                <option value="awb_number">AWB Number</option>
                                <option value="shipping_fee">ค่าส่ง</option>
                            </select>
                            <button onClick={() => { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); setPage(1); }}
                                className="px-3 py-2 text-zinc-300 text-sm font-medium hover:text-white transition">
                                {sortOrder === 'desc' ? '⬇️' : '⬆️'}
                            </button>
                        </div>
                        <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-2xl p-1">
                            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                                className="bg-transparent text-zinc-300 text-sm px-3 py-2 outline-none font-medium cursor-pointer">
                                <option value={20}>20 แถว</option>
                                <option value={50}>50 แถว</option>
                                <option value={100}>100 แถว</option>
                            </select>
                        </div>
                        <button onClick={() => setCompactView(v => !v)}
                            className={`p-2.5 rounded-xl text-sm border transition shadow-sm ${compactView ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-zinc-950/50 text-zinc-400 border-zinc-800 hover:text-zinc-200'}`}
                            title="สลับมุมมองแบบกระชับ">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                        </button>
                    </div>
                </div>

                {/* Table Area */}
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead>
                            <tr className="bg-zinc-950/80 border-b border-zinc-800/80 text-zinc-400 uppercase tracking-wider text-xs">
                                <th className="px-5 py-4 font-semibold">AWB Number</th>
                                <th className="px-5 py-4 font-semibold">วันที่จอง</th>
                                <th className="px-5 py-4 font-semibold">ผู้ส่ง</th>
                                {!compactView && <th className="px-5 py-4 font-semibold">เบอร์ผู้ส่ง</th>}
                                <th className="px-5 py-4 font-semibold">ผู้รับ</th>
                                {!compactView && <th className="px-5 py-4 font-semibold">เบอร์ผู้รับ</th>}
                                <th className="px-5 py-4 font-semibold text-right">ค่าส่ง</th>
                                <th className="px-5 py-4 font-semibold text-center">จัดการ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({ length: compactView ? 6 : 8 }).map((_, j) => (
                                            <td key={j} className="px-5 py-4">
                                                <div className="h-5 bg-zinc-800/50 rounded-lg animate-pulse" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : visibleShipments.length === 0 ? (
                                <tr>
                                    <td colSpan={compactView ? 6 : 8} className="px-5 py-24 text-center">
                                        <div className="inline-flex flex-col items-center justify-center text-zinc-500">
                                            <span className="text-4xl mb-3 opacity-50">📂</span>
                                            <p className="font-medium">ไม่พบข้อมูลการจัดส่ง</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : visibleShipments.map((s, i) => (
                                <tr key={s.id || i} className="hover:bg-zinc-800/30 transition-colors group">
                                    <td className="px-5 py-3.5">
                                        <div className="font-mono text-sm font-bold text-blue-400/90 bg-blue-500/10 px-2.5 py-1 rounded-md inline-block border border-blue-500/20 shadow-sm tracking-wide">{s.awb_number || '-'}</div>
                                    </td>
                                    <td className="px-5 py-3.5 text-zinc-400 text-xs">
                                        {s.booking_date ? new Date(s.booking_date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="font-medium text-zinc-200 max-w-[160px] truncate" title={s.sender_name}>{s.sender_name || '-'}</div>
                                    </td>
                                    {!compactView && <td className="px-5 py-3.5 text-zinc-500 font-mono text-xs">{s.sender_phone || '-'}</td>}
                                    <td className="px-5 py-3.5">
                                        <div className="font-medium text-zinc-200 max-w-[160px] truncate" title={s.receiver_name}>{s.receiver_name || '-'}</div>
                                    </td>
                                    {!compactView && <td className="px-5 py-3.5 text-zinc-500 font-mono text-xs">{s.receiver_phone || '-'}</td>}
                                    <td className="px-5 py-3.5 text-right">
                                        {s.shipping_fee != null
                                            ? <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${Number(s.shipping_fee) > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'}`}>฿{Number(s.shipping_fee).toLocaleString()}</span>
                                            : '-'}
                                    </td>
                                    <td className="px-5 py-3.5 text-center">
                                        <div className="flex items-center justify-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setModal({ mode: 'edit', data: s })}
                                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-blue-600 hover:text-white text-zinc-400 transition shadow-sm"
                                                title="แก้ไข"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                                            <button onClick={() => setDeleteId(s.id ?? null)}
                                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-600 hover:text-white text-zinc-400 transition shadow-sm"
                                                title="ลบ"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 0 && (
                    <div className="px-5 py-4 border-t border-zinc-800/60 bg-zinc-900/60 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-zinc-400 font-medium">
                            แสดง {Math.min((page - 1) * pageSize + 1, count)} ถึง {Math.min(page * pageSize, count)} จาก <span className="text-zinc-200">{count.toLocaleString()}</span> รายการ
                        </p>
                        <div className="flex gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 rounded-xl text-sm font-medium transition text-zinc-300 shadow-sm">
                                ก่อนหน้า
                            </button>
                            <div className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-bold text-zinc-300 shadow-inner">
                                {page} / {totalPages}
                            </div>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 rounded-xl text-sm font-medium transition text-zinc-300 shadow-sm">
                                ถัดไป
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

            {/* Delete All Confirm */}
            {confirmDeleteAll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirmDeleteAll(false)}>
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-2">⚠️</div>
                        <p className="text-xl font-black text-center text-red-600">
                            {dateFrom || dateTo ? 'ลบข้อมูลตามวันที่?' : 'ลบข้อมูลทั้งหมด?'}
                        </p>
                        <p className="text-sm text-zinc-500 text-center">
                            {dateFrom || dateTo ? (
                                <>คุณกำลังจะลบข้อมูล J&T Shipments <b>ตั้งแต่วันที่ {dateFrom || 'เริ่มต้น'} ถึง {dateTo || 'ล่าสุด'}</b> ข้อมูลนี้จะไม่สามารถกู้คืนได้ ยืนยันหรือไม่?</>
                            ) : (
                                <>คุณกำลังจะลบข้อมูล J&T Shipments <b>ทั้งหมดในระบบ</b> ข้อมูลนี้จะไม่สามารถกู้คืนได้ ยืนยันหรือไม่?</>
                            )}
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setConfirmDeleteAll(false)}
                                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">ยกเลิก</button>
                            <button onClick={handleDeleteAll}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition shadow-sm">
                                {dateFrom || dateTo ? 'ลบข้อมูลเลย' : 'ลบทั้งหมดเลย'}
                            </button>
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
