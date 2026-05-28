'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Package, CheckCircle2, Clock, AlertTriangle, FileWarning, Phone, MapPin } from 'lucide-react';

type StaffInfo = {
    delivery_staff_id: string;
    delivery_staff_name: string | null;
    delivery_staff_position: string | null;
    delivery_staff_phone: string | null;
    delivery_branch_code: string;
    delivery_branch_name: string | null;
};

type Counts = {
    total: number;
    delivered: number;
    pending: number;
    stuck: number;
    problem: number;
};

type CodBreakdown = {
    total: number;
    pending_total: number;
    low_count: number;
    mid_count: number;
    high_count: number;
    very_high_count: number;
};

type PendingParcel = {
    awb_number: string;
    cod_amount: string | null;
    cod_num: number;
    receiver_name: string | null;
    receiver_phone: string | null;
    receiver_address: string | null;
    stuck_flag: string | null;
    stuck_reason: string | null;
    problem_reason: string | null;
    arrived_branch_time: string | null;
};

type DetailResponse = {
    staff: StaffInfo;
    counts: Counts;
    cod: CodBreakdown;
    pending_parcels: PendingParcel[];
};

type Props = {
    open: boolean;
    branchCode: string;
    staffId: string;
    staffNameFallback: string | null;
    onClose: () => void;
};

function formatNumber(n: number): string {
    return n.toLocaleString('th-TH');
}

function formatCurrency(n: number): string {
    return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function StaffDetailModal({ open, branchCode, staffId, staffNameFallback, onClose }: Props) {
    const [data, setData] = useState<DetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setLoading(true);
        setError(null);
        setData(null);

        const url = `/api/admin/jt-warehouse/staff-detail?branch=${encodeURIComponent(branchCode)}&staff=${encodeURIComponent(staffId)}`;
        fetch(url, { credentials: 'include' })
            .then(async (res) => {
                const json = await res.json();
                if (cancelled) return;
                if (!res.ok) {
                    setError(typeof json?.error === 'string' ? json.error : 'โหลดข้อมูลไม่สำเร็จ');
                    return;
                }
                setData(json as DetailResponse);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, branchCode, staffId]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    if (!open) return null;

    const staffName = data?.staff?.delivery_staff_name ?? staffNameFallback ?? '—';

    return (
        <div className="fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="jt-staff-detail-title">
            <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                aria-label="ปิด"
                onClick={onClose}
            />
            <aside className="relative z-[1] flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-800/80 bg-slate-950 shadow-2xl shadow-black/40">
                {/* Header */}
                <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/80 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                            {staffId}
                        </p>
                        <h2 id="jt-staff-detail-title" className="mt-0.5 truncate text-lg font-bold text-white">
                            {staffName}
                        </h2>
                        {data?.staff?.delivery_staff_position ? (
                            <p className="mt-0.5 text-xs text-slate-400">{data.staff.delivery_staff_position}</p>
                        ) : null}
                        {data?.staff?.delivery_staff_phone ? (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                                <Phone className="h-3 w-3" aria-hidden />
                                {data.staff.delivery_staff_phone}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                        aria-label="ปิดหน้าต่าง"
                    >
                        <X className="h-5 w-5" aria-hidden />
                    </button>
                </header>

                {/* Body */}
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin text-amber-400" aria-hidden />
                            กำลังโหลด…
                        </div>
                    ) : error ? (
                        <div className="flex gap-2 rounded-xl border border-red-900/60 bg-red-950/35 px-3 py-2.5 text-sm text-red-200">
                            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
                            <div>
                                <p className="font-semibold">โหลดข้อมูลไม่สำเร็จ</p>
                                <p className="mt-1 text-xs text-red-100/90">{error}</p>
                            </div>
                        </div>
                    ) : data ? (
                        <div className="space-y-5">
                            {/* Counts */}
                            <section>
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">สรุปยอด</h3>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                    <CountCard icon={<Package className="h-3.5 w-3.5" aria-hidden />} label="ทั้งหมด" value={data.counts.total} tone="default" />
                                    <CountCard icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />} label="ปิดแล้ว" value={data.counts.delivered} tone="success" />
                                    <CountCard icon={<Clock className="h-3.5 w-3.5" aria-hidden />} label="ค้าง" value={data.counts.pending} tone="warn" />
                                    <CountCard icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />} label="ตกค้าง" value={data.counts.stuck} tone="danger" />
                                    <CountCard icon={<FileWarning className="h-3.5 w-3.5" aria-hidden />} label="ปัญหา" value={data.counts.problem} tone="danger" />
                                </div>
                            </section>

                            {/* COD breakdown */}
                            <section>
                                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    COD ค้างเก็บ
                                </h3>
                                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-500">COD รวมที่ยังไม่ปิด</p>
                                            <p className="mt-1 font-mono text-2xl font-black text-amber-300">
                                                ฿{formatCurrency(data.cod.pending_total)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase text-slate-500">COD รวมทั้งหมด</p>
                                            <p className="mt-1 font-mono text-sm text-slate-300">
                                                ฿{formatCurrency(data.cod.total)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <CodBucket label="< ฿1,000" count={data.cod.low_count} tone="muted" />
                                        <CodBucket label="฿1k–2k" count={data.cod.mid_count} tone="amber" />
                                        <CodBucket label="฿2k–5k" count={data.cod.high_count} tone="orange" />
                                        <CodBucket label="> ฿5,000" count={data.cod.very_high_count} tone="red" />
                                    </div>
                                </div>
                            </section>

                            {/* Pending parcels */}
                            <section>
                                <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    <span>พัสดุค้าง (top {data.pending_parcels.length})</span>
                                    <span className="text-[10px] normal-case text-slate-600">เรียงตาม COD สูงสุด</span>
                                </h3>
                                {data.pending_parcels.length === 0 ? (
                                    <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
                                        🎉 ไม่มีพัสดุค้าง
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {data.pending_parcels.map((p) => (
                                            <li key={p.awb_number} className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate font-mono text-xs text-amber-300">{p.awb_number}</p>
                                                        <p className="mt-0.5 truncate text-sm font-medium text-slate-100">
                                                            {p.receiver_name || '— ไม่มีชื่อผู้รับ —'}
                                                        </p>
                                                        {p.receiver_phone ? (
                                                            <p className="mt-0.5 text-xs text-slate-500">{p.receiver_phone}</p>
                                                        ) : null}
                                                        {p.receiver_address ? (
                                                            <p className="mt-1 flex items-start gap-1 text-xs text-slate-400">
                                                                <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                                                                <span className="line-clamp-2">{p.receiver_address}</span>
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        {p.cod_num > 0 ? (
                                                            <p className={`font-mono text-sm font-bold tabular-nums ${p.cod_num >= 5000 ? 'text-red-300' : p.cod_num >= 2000 ? 'text-orange-300' : p.cod_num >= 1000 ? 'text-amber-300' : 'text-slate-300'}`}>
                                                                ฿{formatNumber(p.cod_num)}
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs text-slate-600">— ไม่มี COD —</p>
                                                        )}
                                                        <div className="mt-1 flex flex-wrap justify-end gap-1">
                                                            {p.stuck_flag === 'Y' ? (
                                                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-300 ring-1 ring-red-500/35">
                                                                    ตกค้าง
                                                                </span>
                                                            ) : null}
                                                            {p.problem_reason ? (
                                                                <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-orange-300 ring-1 ring-orange-500/35">
                                                                    มีปัญหา
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                                {p.stuck_reason ? (
                                                    <p className="mt-2 rounded-lg bg-red-950/40 px-2 py-1 text-[11px] text-red-200/90">
                                                        เหตุตกค้าง: {p.stuck_reason}
                                                    </p>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>
                    ) : null}
                </div>
            </aside>
        </div>
    );
}

function CountCard({
    icon, label, value, tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    tone: 'default' | 'success' | 'warn' | 'danger';
}) {
    const colorClass =
        tone === 'success' ? 'text-emerald-300' :
        tone === 'warn' ? 'text-amber-300' :
        tone === 'danger' ? 'text-red-300' :
        'text-slate-200';

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                {icon}
                {label}
            </div>
            <div className={`mt-1 font-mono text-lg font-bold tabular-nums ${colorClass}`}>
                {formatNumber(value)}
            </div>
        </div>
    );
}

function CodBucket({ label, count, tone }: { label: string; count: number; tone: 'muted' | 'amber' | 'orange' | 'red' }) {
    const colorClass =
        tone === 'red' ? 'text-red-300' :
        tone === 'orange' ? 'text-orange-300' :
        tone === 'amber' ? 'text-amber-300' :
        'text-slate-400';
    return (
        <div className="rounded-lg bg-slate-950/40 px-2 py-1.5 text-center">
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className={`mt-0.5 font-mono text-base font-bold tabular-nums ${colorClass}`}>{formatNumber(count)}</p>
        </div>
    );
}
