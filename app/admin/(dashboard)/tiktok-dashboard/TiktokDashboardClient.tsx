'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, InboxIcon } from 'lucide-react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { TiktokN8nUpload } from './TiktokN8nUpload';

type Row = Record<string, unknown>;

type FetchState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ok'; data: Row[]; total: number };

const PAGE_SIZE = 50;

function formatCellValue(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'ใช่' : 'ไม่';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

function isCurrencyKey(key: string): boolean {
    const k = key.toLowerCase();
    return k.includes('amount') || k.includes('price') || k.includes('fee') || k.includes('revenue') || k.includes('cost');
}

function isDateKey(key: string): boolean {
    const k = key.toLowerCase();
    return k.includes('_at') || k.includes('date') || k.includes('time');
}

function formatDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function columnHeader(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const HIDDEN_COLUMNS = new Set(['created_at', 'updated_at']);
const PRIORITY_COLUMNS = ['awb_number', 'booking_date', 'sender_name', 'receiver_name', 'receiver_phone', 'product_name', 'shipping_fee', 'cod_amount', 'cod_status', 'issue_status'];

function sortColumns(keys: string[]): string[] {
    const priority = PRIORITY_COLUMNS.filter((k) => keys.includes(k));
    const rest = keys.filter((k) => !PRIORITY_COLUMNS.includes(k) && !HIDDEN_COLUMNS.has(k));
    const hidden = keys.filter((k) => HIDDEN_COLUMNS.has(k));
    return [...priority, ...rest, ...hidden];
}

export function TiktokDashboardClient() {
    const [state, setState] = useState<FetchState>({ status: 'idle' });
    const [page, setPage] = useState(1);
    const [columns, setColumns] = useState<string[]>([]);

    const load = useCallback(async (p: number) => {
        setState({ status: 'loading' });
        try {
            const res = await fetch(`/api/admin/tiktok-shipments?page=${p}&limit=${PAGE_SIZE}`, {
                credentials: 'include',
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                setState({ status: 'error', message: (j as { error?: string }).error ?? `HTTP ${res.status}` });
                return;
            }
            const json = await res.json() as { data: Row[]; total: number };
            if (json.data.length > 0) {
                setColumns(sortColumns(Object.keys(json.data[0])));
            }
            setState({ status: 'ok', data: json.data, total: json.total });
        } catch (e) {
            setState({ status: 'error', message: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' });
        }
    }, []);

    useEffect(() => {
        load(page);
    }, [load, page]);

    const totalPages = state.status === 'ok' ? Math.max(1, Math.ceil(state.total / PAGE_SIZE)) : 1;

    const handleUploadSuccess = () => {
        setPage(1);
        load(1);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="relative">
                <AdminPageHeader
                    className="pr-24"
                    title="TikTok Shop"
                    description="ข้อมูลการจัดส่งจาก TikTok Shop — นำเข้าจากไฟล์ Excel หรือ CSV ผ่านปุ่มอัปโหลด"
                    tone="dark"
                    meta={
                        <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30">
                            TikTok · ขนส่ง
                        </span>
                    }
                />
                <div className="absolute right-0 top-0 z-10 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => load(page)}
                        title="รีเฟรชข้อมูล"
                        aria-label="รีเฟรชข้อมูล"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                    >
                        <RefreshCw className={`h-4 w-4 ${state.status === 'loading' ? 'animate-spin' : ''}`} aria-hidden />
                    </button>
                    <TiktokN8nUpload onUploadSuccess={handleUploadSuccess} />
                </div>
            </div>

            {/* Summary bar */}
            {state.status === 'ok' && (
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/45 p-4 ring-1 ring-white/[0.03]">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">ทั้งหมด</span>
                        <span className="text-2xl font-black text-white tabular-nums">{state.total.toLocaleString('th-TH')}</span>
                        <span className="text-xs text-slate-500">รายการ</span>
                    </div>
                    <div className="h-10 w-px bg-slate-800" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">หน้าที่</span>
                        <span className="text-2xl font-black text-white tabular-nums">{page} / {totalPages}</span>
                        <span className="text-xs text-slate-500">หน้าละ {PAGE_SIZE} รายการ</span>
                    </div>
                </div>
            )}

            {/* Content */}
            {state.status === 'loading' && (
                <div className="flex items-center justify-center rounded-2xl border border-slate-800/70 bg-slate-900/45 p-16">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                        <RefreshCw className="h-8 w-8 animate-spin" aria-hidden />
                        <p className="text-sm">กำลังโหลดข้อมูล…</p>
                    </div>
                </div>
            )}

            {state.status === 'error' && (
                <div className="rounded-2xl border border-red-900/50 bg-red-950/20 p-6 text-center">
                    <p className="font-semibold text-red-300">โหลดข้อมูลไม่สำเร็จ</p>
                    <p className="mt-1 text-sm text-red-400/80">{state.message}</p>
                    <button
                        type="button"
                        onClick={() => load(page)}
                        className="mt-4 rounded-xl bg-red-600/20 px-4 py-2 text-sm font-medium text-red-300 ring-1 ring-red-500/30 hover:bg-red-600/30"
                    >
                        ลองใหม่
                    </button>
                </div>
            )}

            {state.status === 'ok' && state.data.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20">
                        <InboxIcon className="h-8 w-8" aria-hidden />
                    </div>
                    <div className="space-y-1">
                        <p className="text-base font-semibold text-slate-200">ยังไม่มีข้อมูล TikTok Shop</p>
                        <p className="text-sm text-slate-500">กดปุ่ม <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/25">📊 xlsx</span> มุมขวาบน เพื่อนำเข้าไฟล์ Excel หรือ CSV</p>
                    </div>
                </div>
            )}

            {state.status === 'ok' && state.data.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/45 ring-1 ring-white/[0.03]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800/80">
                                    <th className="w-10 shrink-0 py-3 pl-4 pr-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500">#</th>
                                    {columns.map((col) => (
                                        <th
                                            key={col}
                                            className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500"
                                        >
                                            {columnHeader(col)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {state.data.map((row, i) => (
                                    <tr
                                        key={i}
                                        className="border-b border-slate-800/40 transition hover:bg-slate-800/30"
                                    >
                                        <td className="py-2.5 pl-4 pr-2 text-xs text-slate-600 tabular-nums">
                                            {(page - 1) * PAGE_SIZE + i + 1}
                                        </td>
                                        {columns.map((col) => {
                                            const v = row[col];
                                            const display = isDateKey(col) ? formatDate(v) : formatCellValue(v);
                                            const isCurrency = isCurrencyKey(col) && v !== null && v !== undefined;
                                            return (
                                                <td
                                                    key={col}
                                                    className={`max-w-[240px] truncate px-3 py-2.5 ${
                                                        isCurrency
                                                            ? 'text-right font-mono text-emerald-300 tabular-nums'
                                                            : 'text-slate-300'
                                                    }`}
                                                    title={formatCellValue(v)}
                                                >
                                                    {isCurrency
                                                        ? Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                        : display}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-800/70 px-4 py-3">
                            <p className="text-xs text-slate-500">
                                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, state.total)} จาก {state.total.toLocaleString('th-TH')} รายการ
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                    aria-label="หน้าก่อนหน้า"
                                >
                                    <ChevronLeft className="h-4 w-4" aria-hidden />
                                </button>
                                <span className="min-w-[5rem] text-center text-xs text-slate-400">
                                    หน้า {page} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                    aria-label="หน้าถัดไป"
                                >
                                    <ChevronRight className="h-4 w-4" aria-hidden />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
