'use client';

import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Download,
    Eye,
    EyeOff,
    FileSpreadsheet,
    GitCompareArrows,
    Loader2,
    RefreshCw,
    Upload,
    X,
} from 'lucide-react';
import {
    toYmd,
    addDays,
    addMonths,
    formatThb,
} from '@/lib/jtDashboardDateUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type DailyReconciliationRow = {
    transactionDate: string;
    // ฝั่งระบบประเมิน
    systemBaseShipping: number;
    systemRemoteAreaFee: number;
    systemCodFee: number;
    systemOtherFee: number;
    systemInsuranceFee: number;
    systemReturnFee: number;
    systemTotalCost: number;
    // ฝั่ง J&T เรียกเก็บ
    statementShippingCost: number;
    statementAdjustmentCost: number;
    statementRemoteAreaFee: number;
    statementOtherFees: number;
    statementTotalCost: number;
    chargeBreakdown: Record<string, number>;
    diff: number;
};

type ImportState =
    | { status: 'idle' }
    | { status: 'uploading' }
    | { status: 'success'; result: ImportResult }
    | { status: 'error'; error: string };

type ImportResult = {
    ok: boolean;
    filename: string;
    statement_period: string | null;
    total_parsed: number;
    imported: number;
    skipped: number;
    parseErrors: string[];
    insertErrors: string[];
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReconciliationTab() {
    const today = useMemo(() => toYmd(new Date()), []);
    const defaultFrom = useMemo(() => toYmd(addDays(new Date(), -9)), []);

    const [dateFrom, setDateFrom] = useState(defaultFrom);
    const [dateTo, setDateTo] = useState(today);
    const [appliedRange, setAppliedRange] = useState({ from: defaultFrom, to: today });
    const [dailyData, setDailyData] = useState<DailyReconciliationRow[]>([]);
    const [dailyLoadState, setDailyLoadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [dailyError, setDailyError] = useState<string | null>(null);
    const [showDaily, setShowDaily] = useState(false);
    const [activePreset, setActivePreset] = useState<string>('custom');

    const canApply = YMD.test(dateFrom) && YMD.test(dateTo) && dateFrom <= dateTo;
    const rangeDays = canApply ? daysBetween(dateFrom, dateTo) : 0;
    const isLoading = dailyLoadState === 'loading';

    const loadDaily = useCallback(async (range: { from: string; to: string }, signal?: AbortSignal) => {
        setDailyLoadState('loading');
        setDailyError(null);
        try {
            const params = new URLSearchParams({ date_from: range.from, date_to: range.to });
            const res = await fetch(`/api/admin/jt-partner-statement/reconciliation/daily?${params}`, {
                credentials: 'same-origin',
                signal,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลรายวันไม่สำเร็จ');
            setDailyData(json.data ?? []);
            setDailyLoadState('success');
        } catch (e) {
            if ((e as { name?: string }).name === 'AbortError') return;
            setDailyError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ');
            setDailyLoadState('error');
        }
    }, []);

    useEffect(() => {
        if (!showDaily) return;
        const ctrl = new AbortController();
        loadDaily(appliedRange, ctrl.signal);
        return () => ctrl.abort();
    }, [appliedRange, loadDaily, showDaily]);

    const applyRange = () => {
        if (!canApply) return;
        setAppliedRange({ from: dateFrom, to: dateTo });
    };

    const onManualDate = (which: 'from' | 'to', value: string) => {
        setActivePreset('custom');
        if (which === 'from') setDateFrom(value);
        else setDateTo(value);
    };

    // Quick presets
    const applyPreset = (key: string, days: number) => {
        const from = toYmd(addDays(new Date(), -(days - 1)));
        const to = toYmd(new Date());
        setActivePreset(key);
        setDateFrom(from);
        setDateTo(to);
        setAppliedRange({ from, to });
    };
    const applyLastMonth = () => {
        const from = toYmd(addMonths(new Date(), -1));
        const to = toYmd(new Date());
        setActivePreset('lastmonth');
        setDateFrom(from);
        setDateTo(to);
        setAppliedRange({ from, to });
    };

    return (
        <div className="space-y-4">
            {/* Import Panel */}
            <StatementImportPanel onImportSuccess={() => { if (showDaily) loadDaily(appliedRange); }} />

            {/* Date Range Controls */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        เลือกช่วงวันที่สำหรับกระทบยอด
                    </p>
                    {rangeDays > 0 && (
                        <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/25">
                            {rangeDays.toLocaleString('th-TH')} วัน
                        </span>
                    )}
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    {/* Presets */}
                    <div>
                        <span className="mb-1.5 block text-[11px] font-medium text-slate-500">ช่วงด่วน</span>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { key: '7d', label: '7 วัน', days: 7 },
                                { key: '30d', label: '30 วัน', days: 30 },
                                { key: '3m', label: '3 เดือน', days: 90 },
                            ].map((p) => {
                                const active = activePreset === p.key;
                                return (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => applyPreset(p.key, p.days)}
                                        disabled={isLoading}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                                            active
                                                ? 'border-sky-500/50 bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/25'
                                                : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:text-slate-100'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                onClick={applyLastMonth}
                                disabled={isLoading}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                                    activePreset === 'lastmonth'
                                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/25'
                                        : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:text-slate-100'
                                }`}
                            >
                                เดือนที่แล้ว
                            </button>
                        </div>
                    </div>

                    {/* Date inputs + load */}
                    <div className="flex flex-wrap items-end gap-2">
                        <div>
                            <label htmlFor="recon-date-from" className="mb-1.5 block text-[11px] font-medium text-slate-500">
                                ตั้งแต่
                            </label>
                            <input
                                id="recon-date-from"
                                type="date"
                                value={dateFrom}
                                max={dateTo || today}
                                onChange={(e) => onManualDate('from', e.target.value)}
                                className={`rounded-lg border bg-slate-900 px-3 py-2 text-sm text-white transition focus:outline-none ${
                                    activePreset === 'custom' ? 'border-sky-500/50' : 'border-slate-700 focus:border-sky-500'
                                }`}
                            />
                        </div>
                        <span className="pb-2.5 text-xs text-slate-500">ถึง</span>
                        <div>
                            <label htmlFor="recon-date-to" className="mb-1.5 block text-[11px] font-medium text-slate-500">
                                ถึงวันที่
                            </label>
                            <input
                                id="recon-date-to"
                                type="date"
                                value={dateTo}
                                min={dateFrom}
                                max={today}
                                onChange={(e) => onManualDate('to', e.target.value)}
                                className={`rounded-lg border bg-slate-900 px-3 py-2 text-sm text-white transition focus:outline-none ${
                                    activePreset === 'custom' ? 'border-sky-500/50' : 'border-slate-700 focus:border-sky-500'
                                }`}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={applyRange}
                            disabled={!canApply || isLoading}
                            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
                            โหลดข้อมูล
                        </button>
                    </div>
                </div>
            </div>

            {/* Daily View — ซ่อนไว้ก่อน กดเพื่อแสดง */}
            {!showDaily && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center">
                    <GitCompareArrows className="mx-auto mb-3 h-8 w-8 text-slate-600" aria-hidden />
                    <p className="mb-3 text-sm text-slate-400">ยอดสรุปรายวันถูกซ่อนไว้</p>
                    <button
                        type="button"
                        onClick={() => setShowDaily(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-400"
                    >
                        <Eye className="h-4 w-4" aria-hidden />
                        แสดงยอดสรุปรายวัน
                    </button>
                </div>
            )}

            {showDaily && (
                <>
                    {dailyLoadState !== 'error' && (
                        <DailySummaryCards rows={dailyData} isLoading={dailyLoadState === 'loading'} range={appliedRange} />
                    )}
                    <section className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                        <div className="mb-3 flex items-start justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold text-white">ยอดสรุปรายวัน</h2>
                                <p className="mt-0.5 text-xs text-slate-500">เปรียบเทียบต้นทุนรวมของแต่ละวัน</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDaily(false)}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                            >
                                <EyeOff className="h-3.5 w-3.5" aria-hidden />
                                ซ่อน
                            </button>
                        </div>
                        {dailyLoadState === 'error' ? (
                            <div className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                                <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
                                <div>
                                    <p className="font-semibold">โหลดข้อมูลรายวันไม่สำเร็จ</p>
                                    {dailyError && <p className="mt-1 text-rose-200/80">{dailyError}</p>}
                                    <p className="mt-1 text-xs text-rose-200/60">
                                        ตรวจสอบว่าสร้าง function <code className="font-mono">jt_reconciliation_daily_summary</code> ใน Supabase แล้ว (SQL Editor → วาง SQL ที่ให้ไว้ → Run)
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <DailyReconciliationTable rows={dailyData} isLoading={dailyLoadState === 'loading'} />
                        )}
                    </section>
                </>
            )}

        </div>
    );
}

// ─── Daily Summary Cards ────────────────────────────────────────────────────────

function DailySummaryCards({
    rows,
    isLoading,
    range,
}: {
    rows: DailyReconciliationRow[];
    isLoading: boolean;
    range: { from: string; to: string };
}) {
    const totals = useMemo(() => {
        let system = 0;
        let statement = 0;
        let diff = 0;
        let daysWithGap = 0;
        for (const r of rows) {
            system += r.systemTotalCost;
            statement += r.statementTotalCost;
            diff += r.diff;
            if (Math.abs(r.diff) >= 1) daysWithGap += 1;
        }
        const diffPct = system !== 0 ? (diff / system) * 100 : 0;
        return { system, statement, diff, diffPct, daysWithGap };
    }, [rows]);

    const hasData = rows.length > 0;
    const gapPositive = totals.diff >= 0;
    const dash = isLoading ? '…' : '-';

    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-300/80">ระบบประเมิน (รวม)</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">
                    {hasData ? formatThb(totals.system) : dash}
                </p>
                <p className="mt-0.5 text-[11px] text-sky-300/50">{range.from} – {range.to}</p>
            </div>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-300/80">J&T เรียกเก็บ (รวม)</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-white">
                    {hasData ? formatThb(totals.statement) : dash}
                </p>
                <p className="mt-0.5 text-[11px] text-purple-300/50">
                    {hasData ? `${totals.daysWithGap.toLocaleString('th-TH')} วันที่ยอดต่างกัน` : ''}
                </p>
            </div>

            <div className={`rounded-xl border p-3 ${gapPositive ? 'border-rose-500/25 bg-rose-500/[0.06]' : 'border-emerald-500/25 bg-emerald-500/[0.06]'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${gapPositive ? 'text-rose-300/80' : 'text-emerald-300/80'}`}>
                    ผลต่างรวม (J&T − ระบบ)
                </p>
                <p className={`mt-1 text-lg font-bold tabular-nums ${gapPositive ? 'text-rose-200' : 'text-emerald-200'}`}>
                    {hasData ? `${gapPositive ? '+' : ''}${formatThb(totals.diff)}` : dash}
                </p>
                <p className={`mt-0.5 text-[11px] ${gapPositive ? 'text-rose-300/50' : 'text-emerald-300/50'}`}>
                    {hasData
                        ? `${gapPositive ? '+' : ''}${totals.diffPct.toFixed(1)}% · ${gapPositive ? 'J&T เก็บเกิน' : 'J&T เก็บน้อยกว่า'}`
                        : ''}
                </p>
            </div>
        </div>
    );
}

// ─── Daily Reconciliation Table ────────────────────────────────────────────────

const DAILY_PAGE_SIZE = 10;

function DailyReconciliationTable({ rows, isLoading }: { rows: DailyReconciliationRow[]; isLoading: boolean }) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(0);

    // กลับไปหน้าแรกเมื่อข้อมูลเปลี่ยน (โหลดช่วงวันใหม่)
    useEffect(() => {
        setPage(0);
    }, [rows]);

    const toggle = (date: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });

    if (isLoading && rows.length === 0) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-slate-800/50" />
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-5 text-center text-sm text-slate-500">
                ไม่มีข้อมูลในช่วงวันที่นี้
            </div>
        );
    }

    let sumSystem = 0;
    let sumStatement = 0;
    let sumDiff = 0;
    rows.forEach((r) => {
        sumSystem += r.systemTotalCost;
        sumStatement += r.statementTotalCost;
        sumDiff += r.diff;
    });

    const totalPages = Math.max(1, Math.ceil(rows.length / DAILY_PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * DAILY_PAGE_SIZE;
    const pageRows = rows.slice(start, start + DAILY_PAGE_SIZE);

    return (
        <div className="space-y-3">
            <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
                <thead className="text-slate-500">
                    <tr className="border-b border-slate-800 bg-slate-900/30">
                        <th className="w-8 px-3 py-3" />
                        <th className="whitespace-nowrap px-3 py-3 font-semibold">วันที่</th>
                        <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-sky-300">ระบบประเมิน (รวม)</th>
                        <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-purple-300">J&T เรียกเก็บ (รวม)</th>
                        <th className="whitespace-nowrap px-3 py-3 text-right font-semibold text-white">ผลต่าง (J&amp;T - ระบบ)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50 text-slate-300">
                    {pageRows.map((row) => {
                        const gapPos = row.diff > 0;
                        const gapNeg = row.diff < 0;
                        const isOpen = expanded.has(row.transactionDate);
                        return (
                            <Fragment key={row.transactionDate}>
                                <tr
                                    className="cursor-pointer hover:bg-slate-900/50"
                                    onClick={() => toggle(row.transactionDate)}
                                >
                                    <td className="px-3 py-2.5 text-slate-500">
                                        <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-200">
                                        {row.transactionDate || '—'}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-sky-200">
                                        {row.systemTotalCost > 0 ? formatThb(row.systemTotalCost) : '—'}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-purple-200">
                                        {row.statementTotalCost !== 0 ? formatThb(row.statementTotalCost) : '—'}
                                    </td>
                                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums ${
                                        gapPos ? 'text-rose-300' : gapNeg ? 'text-emerald-300' : 'text-slate-500'
                                    }`}>
                                        {row.diff !== 0 ? `${gapPos ? '+' : ''}${formatThb(row.diff)}` : '—'}
                                    </td>
                                </tr>
                                {isOpen && (
                                    <tr className="bg-slate-950/60">
                                        <td colSpan={5} className="px-4 py-3">
                                            <DailyBreakdownDetail row={row} />
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
                <tfoot className="border-t-2 border-slate-800 bg-slate-900/60 font-semibold text-white">
                    <tr>
                        <td className="px-3 py-3" />
                        <td className="whitespace-nowrap px-3 py-3">รวมทั้งหมด</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-sky-300">{formatThb(sumSystem)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-purple-300">{formatThb(sumStatement)}</td>
                        <td className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${sumDiff > 0 ? 'text-rose-300' : sumDiff < 0 ? 'text-emerald-300' : 'text-white'}`}>
                            {sumDiff !== 0 ? `${sumDiff > 0 ? '+' : ''}${formatThb(sumDiff)}` : '0.00'}
                        </td>
                    </tr>
                </tfoot>
            </table>
            </div>

            {rows.length > DAILY_PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span>
                        แสดง {start + 1}–{Math.min(start + DAILY_PAGE_SIZE, rows.length)} จาก {rows.length.toLocaleString('th-TH')} วัน
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={safePage === 0}
                            className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            ก่อนหน้า
                        </button>
                        <span className="tabular-nums text-slate-300">หน้า {safePage + 1}/{totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={safePage >= totalPages - 1}
                            className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            ถัดไป
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Daily Breakdown (expandable detail) ────────────────────────────────────────

function DailyBreakdownDetail({ row }: { row: DailyReconciliationRow }) {
    const systemRows: Array<{ label: string; value: number }> = [
        { label: 'ค่าส่งฐาน', value: row.systemBaseShipping },
        { label: 'พื้นที่ห่างไกล', value: row.systemRemoteAreaFee },
        { label: 'COD fee', value: row.systemCodFee },
        { label: 'ค่าอื่นๆ', value: row.systemOtherFee },
        { label: 'ประกัน', value: row.systemInsuranceFee },
        { label: 'ตีกลับ', value: row.systemReturnFee },
    ];
    const statementRows: Array<{ label: string; value: number }> = [
        { label: 'ค่าส่ง', value: row.statementShippingCost },
        { label: 'ปรับปรุงต้นทุน', value: row.statementAdjustmentCost },
        { label: 'พื้นที่ห่างไกล', value: row.statementRemoteAreaFee },
        { label: 'อื่นๆ', value: row.statementOtherFees },
    ];

    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* ฝั่งระบบ */}
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sky-300/80">ระบบประเมิน</p>
                <dl className="space-y-1">
                    {systemRows.map((r) => (
                        <div key={r.label} className="flex justify-between gap-4 text-xs">
                            <dt className="text-slate-400">{r.label}</dt>
                            <dd className={`tabular-nums ${r.value !== 0 ? 'text-sky-200' : 'text-slate-600'}`}>
                                {r.value !== 0 ? formatThb(r.value) : '—'}
                            </dd>
                        </div>
                    ))}
                    <div className="mt-1 flex justify-between gap-4 border-t border-slate-800 pt-1.5 text-xs font-semibold">
                        <dt className="text-slate-300">รวม</dt>
                        <dd className="tabular-nums text-sky-300">{formatThb(row.systemTotalCost)}</dd>
                    </div>
                </dl>
            </div>

            {/* ฝั่ง J&T */}
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/[0.04] p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-purple-300/80">J&T เรียกเก็บจริง</p>
                <dl className="space-y-1">
                    {statementRows.map((r) => (
                        <div key={r.label} className="flex justify-between gap-4 text-xs">
                            <dt className="text-slate-400">{r.label}</dt>
                            <dd className={`tabular-nums ${r.value !== 0 ? 'text-purple-200' : 'text-slate-600'}`}>
                                {r.value !== 0 ? formatThb(r.value) : '—'}
                            </dd>
                        </div>
                    ))}
                    <div className="mt-1 flex justify-between gap-4 border-t border-slate-800 pt-1.5 text-xs font-semibold">
                        <dt className="text-slate-300">รวม</dt>
                        <dd className="tabular-nums text-purple-300">{formatThb(row.statementTotalCost)}</dd>
                    </div>
                </dl>

                {/* charge_type ดิบจาก statement */}
                {Object.keys(row.chargeBreakdown).length > 0 && (
                    <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-300">
                            ดู charge_type ดิบ ({Object.keys(row.chargeBreakdown).length})
                        </summary>
                        <ul className="mt-1 space-y-0.5">
                            {Object.entries(row.chargeBreakdown).map(([k, v]) => (
                                <li key={k} className="flex justify-between gap-4 text-[11px]">
                                    <span className="text-slate-500">{k}</span>
                                    <span className="tabular-nums text-slate-400">{formatThb(v as number)}</span>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
            </div>
        </div>
    );
}

// ─── Import Panel ─────────────────────────────────────────────────────────────

function StatementImportPanel({ onImportSuccess }: { onImportSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [importState, setImportState] = useState<ImportState>({ status: 'idle' });
    const [file, setFile] = useState<File | null>(null);
    const [period, setPeriod] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setFile(null);
        setPeriod('');
        setImportState({ status: 'idle' });
        if (inputRef.current) inputRef.current.value = '';
    };

    const downloadTemplate = () => {
        const headers = ['รหัสเงินสำรอง', 'หมายเลข AWB', 'รหัสสาขา', 'ประเภทย่อยของค่าใช้จ่าย', 'จำนวนเงิน', 'วันที่ทำธุรกรรม', 'หมายเหตุ'];
        const bom = '\uFEFF';
        const csv = bom + headers.map(h => `"${h}"`).join(',');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jt_statement_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const submit = async () => {
        if (!file) return;
        setImportState({ status: 'uploading' });

        const fd = new FormData();
        fd.append('file', file);
        if (period.trim()) fd.append('statement_period', period.trim());

        try {
            const res = await fetch('/api/admin/jt-partner-statement/import', {
                method: 'POST',
                body: fd,
                credentials: 'same-origin',
            });
            const json = (await res.json()) as ImportResult & { error?: string };
            if (!res.ok) {
                setImportState({ status: 'error', error: json.error ?? 'นำเข้าไม่สำเร็จ' });
                return;
            }
            setImportState({ status: 'success', result: json });
            onImportSuccess();
        } catch (e) {
            setImportState({ status: 'error', error: e instanceof Error ? e.message : 'เชื่อมต่อไม่สำเร็จ' });
        }
    };

    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-400" aria-hidden />
                        นำเข้า Statement จาก J&T
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                        รองรับไฟล์ Excel (.xlsx, .xls) หรือ CSV — ระบบจะดึงข้อมูลให้อัตโนมัติแม้จะมี Pivot Table ติดมา
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => { setOpen((v) => !v); }}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:border-emerald-500/50 hover:bg-emerald-500/20"
                >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    {open ? 'ปิด' : 'นำเข้าไฟล์'}
                </button>
            </div>

            {open && (
                <div className="mt-4 space-y-3">
                    {/* Period input */}
                    <div className="flex flex-wrap gap-3">
                        <div className="flex-1 space-y-1">
                            <label className="block text-xs font-medium text-slate-400" htmlFor="recon-period">
                                รอบ Statement (เช่น 2026-05) — ไม่บังคับ
                            </label>
                            <input
                                id="recon-period"
                                type="text"
                                placeholder="YYYY-MM"
                                value={period}
                                onChange={(e) => setPeriod(e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex-1 space-y-1">
                            <span className="block text-xs font-medium text-slate-400">ไฟล์ CSV</span>
                            <div className="flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2">
                                <input
                                    id="recon-file-input"
                                    ref={inputRef}
                                    type="file"
                                    accept=".csv,.txt,.xlsx,.xls"
                                    onChange={(e) => { setFile(e.target.files?.[0] ?? null); setImportState({ status: 'idle' }); }}
                                    disabled={importState.status === 'uploading'}
                                    className="sr-only"
                                />
                                <button
                                    type="button"
                                    onClick={() => inputRef.current?.click()}
                                    disabled={importState.status === 'uploading'}
                                    className="shrink-0 rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
                                >
                                    เลือกไฟล์…
                                </button>
                                <span className={`min-w-0 flex-1 truncate text-xs ${file ? 'text-slate-200' : 'text-slate-500'}`}>
                                    {file ? file.name : 'ยังไม่เลือก'}
                                </span>
                                {file && (
                                    <button type="button" onClick={reset} className="text-slate-500 hover:text-slate-300">
                                        <X className="h-4 w-4" aria-hidden />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={submit}
                            disabled={!file || importState.status === 'uploading'}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {importState.status === 'uploading' ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                                <Upload className="h-4 w-4" aria-hidden />
                            )}
                            นำเข้าข้อมูล
                        </button>
                        {importState.status !== 'idle' && importState.status !== 'uploading' && (
                            <button
                                type="button"
                                onClick={reset}
                                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900"
                            >
                                ล้าง
                            </button>
                        )}
                    </div>

                    {/* Import result */}
                    {importState.status === 'success' && (
                        <div className="flex gap-3 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-3 py-3 text-sm text-emerald-200">
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                            <div className="space-y-1">
                                <p className="font-semibold">นำเข้าสำเร็จ — {importState.result.filename}</p>
                                <p className="text-xs text-emerald-200/80">
                                    นำเข้า {importState.result.imported.toLocaleString('th-TH')} แถว
                                    {importState.result.skipped > 0 && ` · ข้ามซ้ำ ${importState.result.skipped.toLocaleString('th-TH')} แถว`}
                                    {importState.result.statement_period ? ` · รอบ ${importState.result.statement_period}` : ''}
                                </p>
                                {importState.result.parseErrors.length > 0 && (
                                    <details className="mt-1">
                                        <summary className="cursor-pointer text-[11px] text-amber-300">
                                            {importState.result.parseErrors.length} แถวที่มีปัญหา
                                        </summary>
                                        <ul className="mt-1 space-y-0.5 text-[11px] text-amber-200/80">
                                            {importState.result.parseErrors.slice(0, 5).map((e, i) => (
                                                <li key={i}>{e}</li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
                            </div>
                        </div>
                    )}

                    {importState.status === 'error' && (
                        <div className="flex gap-2 rounded-xl border border-rose-800/50 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-200">
                            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" aria-hidden />
                            <div>
                                <p className="font-semibold">นำเข้าไม่สำเร็จ</p>
                                <p className="mt-0.5 text-xs text-rose-200/80">{importState.error}</p>
                            </div>
                        </div>
                    )}

                    {/* Help & Template */}
                    <div className="flex flex-col sm:flex-row gap-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/30 p-3 text-xs text-slate-500">
                        <div className="flex-1">
                            <p className="font-semibold text-slate-400">ข้อมูลที่ต้องกรอก:</p>
                            <p className="mt-1">คอลัมน์ที่บังคับ: หมายเลข AWB, จำนวนเงิน</p>
                            <p className="mt-1">คอลัมน์เพิ่มเติม: ประเภทย่อยของค่าใช้จ่าย, วันที่ทำธุรกรรม, รหัสสาขา, หมายเหตุ</p>
                        </div>
                        <div className="shrink-0 flex items-center justify-center sm:border-l border-slate-700 sm:pl-4">
                            <button
                                type="button"
                                onClick={downloadTemplate}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 font-semibold text-sky-300 transition hover:border-sky-500/50 hover:bg-sky-500/20"
                            >
                                <Download className="h-3.5 w-3.5" aria-hidden />
                                โหลดไฟล์ CSV นำเข้า
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helpers

function daysBetween(from: string, to: string): number {
    const a = new Date(`${from}T00:00:00`).getTime();
    const b = new Date(`${to}T00:00:00`).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return 0;
    return Math.round((b - a) / 86_400_000) + 1; // inclusive
}

