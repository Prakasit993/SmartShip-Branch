'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Stats {
    total: number;
    today: number;
    week: number;
    month: number;
    totalFee: number;
    avgFee: number;
    maxFee: number;
    recent: { awb_number: string; booking_date: string; sender_name: string; receiver_name: string; shipping_fee: number }[];
    topSenders: { name: string; count: number }[];
    topReceivers: { name: string; count: number }[];
    daily30: { date: string; count: number }[];
}

export default function JTDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAllTop, setShowAllTop] = useState(false);

    useEffect(() => {
        fetch('/api/admin/jt-shipments/stats')
            .then(r => r.json())
            .then(d => { setStats(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const maxDaily = stats ? Math.max(...stats.daily30.map(d => d.count), 1) : 1;
    const maxSender = stats?.topSenders[0]?.count || 1;
    const maxReceiver = stats?.topReceivers[0]?.count || 1;
    const topLimit = showAllTop ? 10 : 5;
    const senderRows = stats?.topSenders.slice(0, topLimit) || [];
    const receiverRows = stats?.topReceivers.slice(0, topLimit) || [];
    const recentRows = stats?.recent.slice(0, 5) || [];

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="space-y-3 w-full max-w-2xl">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20 text-zinc-100">
            {/* Header */}
            <div className="rounded-2xl border border-zinc-800 bg-[#0a1326]/95 p-4 md:p-5 flex items-center justify-between flex-wrap gap-3 shadow-sm">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black tracking-tight">🚚 J&T Dashboard</h1>
                    <p className="text-zinc-500 text-sm mt-1">ภาพรวมข้อมูลการจัดส่งทั้งหมด (ย่อให้ดูเฉพาะที่จำเป็น)</p>
                </div>
                <Link href="/admin/shipments"
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-sm">
                    📋 จัดการข้อมูล →
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="รายการทั้งหมด" value={(stats?.total || 0).toLocaleString()} icon="📦" color="from-blue-500 to-blue-700" sub="รายการ" />
                <StatCard label="วันนี้" value={(stats?.today || 0).toLocaleString()} icon="📅" color="from-green-500 to-emerald-600" sub="รายการ" />
                <StatCard label="สัปดาห์นี้" value={(stats?.week || 0).toLocaleString()} icon="📈" color="from-purple-500 to-violet-600" sub="7 วัน" />
                <StatCard label="เดือนนี้" value={(stats?.month || 0).toLocaleString()} icon="🗓️" color="from-orange-500 to-amber-600" sub="รายการ" />
            </div>

            {/* Fee Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FeeCard label="ค่าส่งรวมทั้งหมด" value={`฿${(stats?.totalFee || 0).toLocaleString()}`} icon="💰" color="text-green-600" />
                <FeeCard label="ค่าส่งเฉลี่ย/รายการ" value={`฿${(stats?.avgFee || 0).toLocaleString()}`} icon="📊" color="text-blue-600" />
                <FeeCard label="ค่าส่งสูงสุด" value={`฿${(stats?.maxFee || 0).toLocaleString()}`} icon="🏆" color="text-orange-600" />
            </div>

            {/* Daily Chart + Top Senders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Bar Chart */}
                <div className="bg-[#0a1326]/95 rounded-2xl p-6 border border-zinc-800 shadow-sm">
                    <h2 className="text-base font-bold mb-4 flex items-center gap-2">📈 จำนวนรายการ 30 วันล่าสุด</h2>
                    <div className="flex items-end gap-0.5 h-36 overflow-x-auto pb-1">
                        {stats?.daily30.map((d, i) => {
                            const height = Math.max((d.count / maxDaily) * 100, d.count > 0 ? 4 : 1);
                            const isToday = d.date === new Date().toISOString().slice(0, 10);
                            return (
                                <div key={i} className="flex-1 min-w-[6px] flex flex-col items-center gap-0.5 group relative">
                                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                        {d.date.slice(5)}: {d.count}
                                    </div>
                                    <div
                                        className={`w-full rounded-t transition-all ${isToday ? 'bg-blue-500' : 'bg-blue-200 dark:bg-blue-900 group-hover:bg-blue-400 dark:group-hover:bg-blue-700'}`}
                                        style={{ height: `${height}%` }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-zinc-400">
                        <span>{stats?.daily30[0]?.date.slice(5)}</span>
                        <span className="text-blue-500 font-bold">วันนี้</span>
                    </div>
                </div>

                {/* Top Senders */}
                <div className="bg-[#0a1326]/95 rounded-2xl p-6 border border-zinc-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold flex items-center gap-2">👤 Top {topLimit} ผู้ส่งบ่อยสุด</h2>
                        <button
                            onClick={() => setShowAllTop(v => !v)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        >
                            {showAllTop ? 'ดูย่อ' : 'ดูเพิ่ม'}
                        </button>
                    </div>
                    <div className="space-y-2">
                        {senderRows.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                                <span className={`w-5 text-xs font-bold ${i < 3 ? 'text-yellow-500' : 'text-zinc-400'}`}>{i + 1}</span>
                                <span className="flex-1 text-sm truncate font-medium">{s.name || 'ไม่ระบุ'}</span>
                                <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-300 rounded-full"
                                        style={{ width: `${(s.count / maxSender) * 100}%` }} />
                                </div>
                                <span className="text-xs font-bold text-zinc-500 w-8 text-right">{s.count}</span>
                            </div>
                        ))}
                        {!senderRows.length && <p className="text-zinc-400 text-sm">ไม่มีข้อมูล</p>}
                    </div>
                </div>
            </div>

            {/* Top Receivers + Fields Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Receivers */}
                <div className="bg-[#0a1326]/95 rounded-2xl p-6 border border-zinc-800 shadow-sm">
                    <h2 className="text-base font-bold mb-4 flex items-center gap-2">📬 Top {topLimit} ผู้รับบ่อยสุด</h2>
                    <div className="space-y-2">
                        {receiverRows.map((r, i) => (
                            <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                                <span className={`w-5 text-xs font-bold ${i < 3 ? 'text-yellow-500' : 'text-zinc-400'}`}>{i + 1}</span>
                                <span className="flex-1 text-sm truncate font-medium">{r.name || 'ไม่ระบุ'}</span>
                                <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-purple-500 to-purple-300 rounded-full"
                                        style={{ width: `${(r.count / maxReceiver) * 100}%` }} />
                                </div>
                                <span className="text-xs font-bold text-zinc-500 w-8 text-right">{r.count}</span>
                            </div>
                        ))}
                        {!receiverRows.length && <p className="text-zinc-400 text-sm">ไม่มีข้อมูล</p>}
                    </div>
                </div>

                {/* Quick Scope */}
                <div className="bg-[#0a1326]/95 rounded-2xl p-6 border border-zinc-800 shadow-sm">
                    <h2 className="text-base font-bold mb-4 flex items-center gap-2">🎯 มุมมองข้อมูลที่แนะนำ</h2>
                    <div className="space-y-3 text-sm">
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                            <p className="font-medium">แดชบอร์ดนี้แสดงเฉพาะข้อมูลสรุปที่สำคัญ</p>
                            <p className="text-zinc-500 mt-1">Top ผู้ส่ง/ผู้รับ ใช้ค่าเริ่มต้น 5 รายการ เพื่อลดความหนาแน่นของจอ</p>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                            <p className="font-medium">ข้อมูลเชิงลึกเพิ่มเติม</p>
                            <p className="text-zinc-500 mt-1">ไปที่หน้า "J&T Shipments" เพื่อค้นหา, เรียงลำดับ, และจัดการรายการแบบละเอียด</p>
                        </div>
                        <div className="pt-2">
                            <Link
                                href="/admin/shipments"
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                            >
                                เปิดหน้าจัดการรายการ ->
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Shipments */}
            <div className="bg-[#0a1326]/95 rounded-2xl border border-zinc-800 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-base font-bold flex items-center gap-2">📋 รายการล่าสุด 5 รายการ</h2>
                    <Link href="/admin/shipments" className="text-sm text-blue-600 font-medium hover:underline">ดูทั้งหมด →</Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-zinc-900/80">
                                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs">AWB</th>
                                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs">วันที่</th>
                                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs">ผู้ส่ง</th>
                                <th className="text-left px-4 py-2.5 font-semibold text-zinc-500 text-xs">ผู้รับ</th>
                                <th className="text-right px-4 py-2.5 font-semibold text-zinc-500 text-xs">ค่าส่ง</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {recentRows.map((r, i) => (
                                <tr key={i} className="hover:bg-zinc-800/40 even:bg-zinc-900/40 transition">
                                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-blue-600">{r.awb_number}</td>
                                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                                        {r.booking_date ? new Date(r.booking_date).toLocaleDateString('th-TH') : '-'}
                                    </td>
                                    <td className="px-4 py-2.5 max-w-[120px] truncate font-medium">{r.sender_name || '-'}</td>
                                    <td className="px-4 py-2.5 max-w-[120px] truncate text-zinc-600 dark:text-zinc-400">{r.receiver_name || '-'}</td>
                                    <td className="px-4 py-2.5 text-right font-bold">
                                        <span className={Number(r.shipping_fee) > 0 ? 'text-green-600' : 'text-zinc-400'}>
                                            ฿{Number(r.shipping_fee).toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!recentRows.length && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">ไม่มีข้อมูลล่าสุด</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: string; sub: string }) {
    return (
        <div className="relative overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className={`absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br ${color} rounded-full opacity-10`} />
            <p className="text-2xl mb-2">{icon}</p>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-black mt-1">{value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
        </div>
    );
}

function FeeCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 flex items-center gap-4 shadow-sm">
            <span className="text-3xl">{icon}</span>
            <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">{label}</p>
                <p className={`text-xl font-black ${color}`}>{value}</p>
            </div>
        </div>
    );
}
