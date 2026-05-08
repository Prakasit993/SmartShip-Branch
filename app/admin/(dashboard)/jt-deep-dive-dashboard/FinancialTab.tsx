'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Calculator, Database, RefreshCw, TrendingUp } from 'lucide-react';

type FinancialSummary = {
    date_from: string;
    date_to: string;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    shipmentCount: number;
};

type FinancialSummaryState =
    | { status: 'loading'; data: FinancialSummary | null; error: null }
    | { status: 'success'; data: FinancialSummary; error: null }
    | { status: 'error'; data: FinancialSummary | null; error: string };

function toYmd(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(d: Date, days: number): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + days);
    return next;
}

function formatThb(value: number): string {
    return value.toLocaleString('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 2,
    });
}

function formatCount(value: number): string {
    return `${value.toLocaleString('th-TH')} ชิ้น`;
}

export function FinancialTab() {
    const initialRange = useMemo(() => {
        const today = new Date();
        return {
            from: toYmd(addDays(today, -29)),
            to: toYmd(today),
        };
    }, []);
    const [dateFrom, setDateFrom] = useState(initialRange.from);
    const [dateTo, setDateTo] = useState(initialRange.to);
    const [appliedRange, setAppliedRange] = useState(initialRange);
    const [state, setState] = useState<FinancialSummaryState>({
        status: 'loading',
        data: null,
        error: null,
    });

    const loadSummary = useCallback(async (range: { from: string; to: string }, signal?: AbortSignal) => {
        setState((prev) => ({ status: 'loading', data: prev.data, error: null }));

        const params = new URLSearchParams();
        params.set('date_from', range.from);
        params.set('date_to', range.to);
        const res = await fetch(`/api/admin/jt-shipments/financial-summary?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal,
        });
        const json = (await res.json()) as Partial<FinancialSummary> & { error?: string };
        if (!res.ok) {
            throw new Error(json.error || 'โหลดสรุปกำไรไม่สำเร็จ');
        }

        setState({
            status: 'success',
            data: {
                date_from: String(json.date_from || range.from),
                date_to: String(json.date_to || range.to),
                totalRevenue: Number(json.totalRevenue) || 0,
                totalCost: Number(json.totalCost) || 0,
                totalProfit: Number(json.totalProfit) || 0,
                shipmentCount: Number(json.shipmentCount) || 0,
            },
            error: null,
        });
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        loadSummary(appliedRange, controller.signal).catch((e: unknown) => {
            if ((e as { name?: string }).name === 'AbortError') return;
            setState((prev) => ({
                status: 'error',
                data: prev.data,
                error: e instanceof Error ? e.message : 'โหลดสรุปกำไรไม่สำเร็จ',
            }));
        });
        return () => controller.abort();
    }, [appliedRange, loadSummary]);

    const data = state.data;
    const isLoading = state.status === 'loading';
    const canApply = dateFrom.trim() !== '' && dateTo.trim() !== '' && dateFrom <= dateTo;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <label className="space-y-1 text-xs font-medium text-slate-400">
                    <span>วันที่เริ่มต้น</span>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/20 focus:border-sky-500 focus:ring-2"
                    />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-400">
                    <span>วันที่สิ้นสุด</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/20 focus:border-sky-500 focus:ring-2"
                    />
                </label>
                <button
                    type="button"
                    disabled={!canApply || isLoading}
                    onClick={() => setAppliedRange({ from: dateFrom, to: dateTo })}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
                    ใช้ช่วงนี้
                </button>
                <p className="text-xs text-slate-500">
                    อ้างอิง `booking_date` และจับคู่ต้นทุนจาก `shipping_cost_master`
                </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <FinancialMetricCard
                    label="ยอดขายค่าขนส่ง"
                    value={data ? formatThb(data.totalRevenue) : isLoading ? 'กำลังโหลด...' : '-'}
                    hint="รวมค่าขนส่งหลังแปลง shipping_fee เป็นตัวเลข"
                    icon={<TrendingUp className="h-5 w-5" aria-hidden />}
                />
                <FinancialMetricCard
                    label="ต้นทุนรวม"
                    value={data ? formatThb(data.totalCost) : isLoading ? 'กำลังโหลด...' : '-'}
                    hint="จับคู่ราคาขายกับต้นทุนจาก shipping_cost_master"
                    icon={<Database className="h-5 w-5" aria-hidden />}
                />
                <FinancialMetricCard
                    label="กำไรรวม"
                    value={data ? formatThb(data.totalProfit) : isLoading ? 'กำลังโหลด...' : '-'}
                    hint="กำไร = ค่าขนส่ง - ต้นทุน"
                    icon={<Calculator className="h-5 w-5" aria-hidden />}
                />
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-white">
                            วิเคราะห์กำไรค่าขนส่ง
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">
                            สรุปจากช่วง {appliedRange.from} ถึง {appliedRange.to}
                            {data ? ` รวม ${formatCount(data.shipmentCount)}` : ''}
                        </p>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                        Financial
                    </span>
                </div>

                {state.status === 'error' ? (
                    <div className="mt-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <div>
                            <p className="font-semibold">โหลดข้อมูล financial ไม่สำเร็จ</p>
                            <p className="mt-1 text-rose-200/80">{state.error}</p>
                        </div>
                    </div>
                ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm text-slate-500">
                        API พร้อมแล้วสำหรับขยายต่อเป็นกราฟกำไรรายวัน ตารางราคาขายที่ยังไม่มีต้นทุน และรายละเอียดแยกตามช่วงวันที่
                    </div>
                )}
            </section>
        </div>
    );
}

function FinancialMetricCard({
    label,
    value,
    hint,
    icon,
}: {
    label: string;
    value: string;
    hint: string;
    icon: ReactNode;
}) {
    return (
        <article className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/75 to-slate-950/80 p-3 ring-1 ring-white/[0.03]">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
                {icon}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-white">{value}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>
        </article>
    );
}
