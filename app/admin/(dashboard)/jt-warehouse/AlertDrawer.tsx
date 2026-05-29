'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, MapPin, User, Clock, AlertTriangle, FileWarning } from 'lucide-react';

export type AlertKind = 'pending' | 'stuck' | 'problem';

type Parcel = {
    awb_number: string;
    cod_amount: string | null;
    cod_num: number;
    delivery_staff_id: string | null;
    delivery_staff_name: string | null;
    receiver_name: string | null;
    receiver_phone: string | null;
    receiver_address: string | null;
    stuck_flag: string | null;
    stuck_reason: string | null;
    problem_time: string | null;
    problem_reason: string | null;
    arrived_branch_time: string | null;
};

type AlertResponse = {
    kind: AlertKind;
    total: number;
    cod_sum: number;
    parcels: Parcel[];
};

const KIND_META: Record<AlertKind, { title: string; icon: React.ReactNode; ringClass: string; bgClass: string; textClass: string }> = {
    pending: {
        title: 'ยังไม่ปิดงาน',
        icon: <Clock className="h-5 w-5" aria-hidden />,
        ringClass: 'ring-amber-500/40',
        bgClass: 'bg-amber-500/10',
        textClass: 'text-amber-300',
    },
    stuck: {
        title: 'ตกค้าง',
        icon: <AlertTriangle className="h-5 w-5" aria-hidden />,
        ringClass: 'ring-red-500/40',
        bgClass: 'bg-red-500/10',
        textClass: 'text-red-300',
    },
    problem: {
        title: 'มีปัญหา',
        icon: <FileWarning className="h-5 w-5" aria-hidden />,
        ringClass: 'ring-orange-500/40',
        bgClass: 'bg-orange-500/10',
        textClass: 'text-orange-300',
    },
};

type Props = {
    open: boolean;
    branchCode: string;
    kind: AlertKind | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    onClose: () => void;
};

function formatNumber(n: number): string {
    return n.toLocaleString('th-TH');
}

function formatCurrency(n: number): string {
    return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AlertDrawer({ open, branchCode, kind, dateFrom, dateTo, onClose }: Props) {
    const [data, setData] = useState<AlertResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !kind) return;

        let cancelled = false;
        setLoading(true);
        setError(null);
        setData(null);

        const params = new URLSearchParams({ branch: branchCode, kind });
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
        const url = `/api/admin/jt-warehouse/alert-list?${params.toString()}`;

        fetch(url, { credentials: 'include' })
            .then(async (res) => {
                const json = await res.json();
                if (cancelled) return;
                if (!res.ok) {
                    setError(typeof json?.error === 'string' ? json.error : 'โหลดข้อมูลไม่สำเร็จ');
                    return;
                }
                setData(json as AlertResponse);
            })
            .catch((e) => {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [open, kind, branchCode, dateFrom, dateTo]);

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

    if (!open || !kind) return null;

    const meta = KIND_META[kind];

    return (
        <div className="fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="alert-drawer-title">
            <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                aria-label="ปิด"
                onClick={onClose}
            />
            <aside className={`relative z-[1] flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-800/80 bg-slate-950 shadow-2xl shadow-black/40 ring-1 ${meta.ringClass}`}>
                <header className={`flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/80 px-5 py-4 ${meta.bgClass}`}>
                    <div className="flex min-w-0 items-start gap-3">
                        <div className={`shrink-0 ${meta.textClass}`}>{meta.icon}</div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Alert — {meta.title}
                            </p>
                            <h2 id="alert-drawer-title" className={`mt-0.5 text-lg font-bold ${meta.textClass}`}>
                                {data ? `${formatNumber(data.total)} พัสดุ` : 'กำลังโหลด…'}
                            </h2>
                            {data && data.cod_sum > 0 ? (
                                <p className="mt-0.5 font-mono text-xs text-slate-400">
                                    COD รวม ฿{formatCurrency(data.cod_sum)}
                                </p>
                            ) : null}
                        </div>
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
                        data.parcels.length === 0 ? (
                            <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
                                🎉 ไม่มีพัสดุ
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {data.parcels.map((p) => (
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
                                                {p.delivery_staff_name || p.delivery_staff_id ? (
                                                    <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-slate-800/60 px-1.5 py-0.5 text-[10px] text-slate-300">
                                                        <User className="h-3 w-3" aria-hidden />
                                                        {p.delivery_staff_name || '—'}
                                                        {p.delivery_staff_id ? (
                                                            <span className="font-mono text-slate-500">·{p.delivery_staff_id.slice(-4)}</span>
                                                        ) : null}
                                                    </p>
                                                ) : (
                                                    <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/30">
                                                        ⚠ ยังไม่ assign พนักงาน
                                                    </p>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                {p.cod_num > 0 ? (
                                                    <p className="font-mono text-sm font-bold tabular-nums text-slate-300">
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
                                        {p.problem_reason ? (
                                            <p className="mt-2 rounded-lg bg-orange-950/40 px-2 py-1 text-[11px] text-orange-200/90">
                                                ปัญหา: {p.problem_reason}
                                            </p>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )
                    ) : null}
                </div>
            </aside>
        </div>
    );
}
