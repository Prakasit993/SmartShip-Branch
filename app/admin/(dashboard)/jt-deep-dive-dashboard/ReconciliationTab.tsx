'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    AlertCircle,
    ArrowDownCircle,
    ArrowUpCircle,
    CheckCircle2,
    ChevronDown,
    Download,
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
    formatCountWithUnit,
} from '@/lib/jtDashboardDateUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReconciliationSummary = {
    totalAwbCount: number;
    matchedCount: number;
    overchargedCount: number;
    underchargedCount: number;
    statementOnlyCount: number;
    shipmentOnlyCount: number;
    totalOurCost: number;
    totalPartnerCost: number;
    totalGap: number;
    overchargedOurCost: number;
    overchargedPartnerCost: number;
    overchargedGapTotal: number;
    underchargedOurCost: number;
    underchargedPartnerCost: number;
    underchargedGapTotal: number;
};

type ReconciliationDetailRow = {
    awbNumber: string;
    bookingDate: string;
    transactionDate: string | null;
    destProvince: string;
    zoneCode: string | null;
    ourBillableWeightKg: number | null;
    ourCost: number;
    partnerCost: number;
    gap: number;
    status: 'matched' | 'overcharged' | 'undercharged' | 'statement_only' | 'shipment_only' | string;
    chargeTypes: string;
};

type ReconciliationData = {
    date_from: string;
    date_to: string;
    status_filter: string | null;
    summary: ReconciliationSummary;
    detail: ReconciliationDetailRow[];
    pagination: { limit: number; offset: number; hasMore: boolean };
};

type LoadState =
    | { status: 'idle'; data: null }
    | { status: 'loading'; data: ReconciliationData | null }
    | { status: 'success'; data: ReconciliationData }
    | { status: 'error'; data: ReconciliationData | null; error: string };

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

type StatusFilter = 'all' | 'overcharged' | 'undercharged' | 'matched' | 'statement_only' | 'shipment_only';

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
    matched:        { label: 'ตรงกัน',          color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    overcharged:    { label: 'J&T เก็บเกิน',    color: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30' },
    undercharged:   { label: 'J&T เก็บน้อยกว่า', color: 'text-amber-300',  bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
    statement_only: { label: 'มีแค่ใน Statement', color: 'text-purple-300', bg: 'bg-purple-500/10',  border: 'border-purple-500/30' },
    shipment_only:  { label: 'ไม่มีใน Statement', color: 'text-slate-300',  bg: 'bg-slate-500/10',   border: 'border-slate-500/30' },
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReconciliationTab() {
    const today = useMemo(() => toYmd(new Date()), []);
    const defaultFrom = useMemo(() => toYmd(addDays(new Date(), -29)), []);

    const [dateFrom, setDateFrom] = useState(defaultFrom);
    const [dateTo, setDateTo] = useState(today);
    const [appliedRange, setAppliedRange] = useState({ from: defaultFrom, to: today });
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [loadState, setLoadState] = useState<LoadState>({ status: 'idle', data: null });
    const [showDetail, setShowDetail] = useState(false);

    const canApply = YMD.test(dateFrom) && YMD.test(dateTo) && dateFrom <= dateTo;

    const load = useCallback(async (range: { from: string; to: string }, sf: StatusFilter, signal?: AbortSignal) => {
        setLoadState((prev) => ({ status: 'loading', data: prev.data ?? null }));
        const params = new URLSearchParams({ date_from: range.from, date_to: range.to, limit: '300', offset: '0' });
        if (sf !== 'all') params.set('status', sf);

        const res = await fetch(`/api/admin/jt-partner-statement/reconciliation?${params}`, {
            credentials: 'same-origin',
            signal,
        });
        const json = (await res.json()) as Partial<ReconciliationData> & { error?: string };
        if (!res.ok) throw new Error(json.error ?? 'โหลดข้อมูลกระทบยอดไม่สำเร็จ');

        setLoadState({
            status: 'success',
            data: {
                date_from: json.date_from ?? range.from,
                date_to: json.date_to ?? range.to,
                status_filter: json.status_filter ?? null,
                summary: json.summary ?? emptySummary(),
                detail: json.detail ?? [],
                pagination: json.pagination ?? { limit: 300, offset: 0, hasMore: false },
            },
        });
    }, []);

    useEffect(() => {
        const ctrl = new AbortController();
        load(appliedRange, statusFilter, ctrl.signal).catch((e: unknown) => {
            if ((e as { name?: string }).name === 'AbortError') return;
            setLoadState((prev) => ({
                status: 'error',
                data: prev.data ?? null,
                error: e instanceof Error ? e.message : 'โหลดไม่สำเร็จ',
            }));
        });
        return () => ctrl.abort();
    }, [appliedRange, statusFilter, load]);

    const isLoading = loadState.status === 'loading';
    const data = loadState.status === 'success' || loadState.status === 'loading' ? loadState.data : null;
    const summary = data?.summary ?? null;

    const applyRange = () => {
        if (!canApply) return;
        setAppliedRange({ from: dateFrom, to: dateTo });
    };

    // Quick presets
    const applyPreset = (days: number) => {
        const from = toYmd(addDays(new Date(), -(days - 1)));
        const to = toYmd(new Date());
        setDateFrom(from);
        setDateTo(to);
        setAppliedRange({ from, to });
    };
    const applyLastMonth = () => {
        const from = toYmd(addMonths(new Date(), -1));
        const to = toYmd(new Date());
        setDateFrom(from);
        setDateTo(to);
        setAppliedRange({ from, to });
    };

    return (
        <div className="space-y-4">
            {/* Import Panel */}
            <StatementImportPanel onImportSuccess={() => load(appliedRange, statusFilter)} />

            {/* Date Range Controls */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    เลือกช่วงวันที่สำหรับกระทบยอด
                </p>
                <div className="flex flex-wrap items-end gap-2">
                    {/* Presets */}
                    {[
                        { label: '7 วัน', days: 7 },
                        { label: '30 วัน', days: 30 },
                        { label: '3 เดือน', days: 90 },
                    ].map((p) => (
                        <button
                            key={p.days}
                            type="button"
                            onClick={() => applyPreset(p.days)}
                            disabled={isLoading}
                            className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-slate-600 hover:text-slate-100 disabled:opacity-50"
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={applyLastMonth}
                        disabled={isLoading}
                        className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-slate-600 hover:text-slate-100 disabled:opacity-50"
                    >
                        เดือนที่แล้ว
                    </button>

                    {/* Date inputs */}
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateFrom}
                            max={dateTo || today}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white transition focus:border-sky-500 focus:outline-none"
                        />
                        <span className="text-xs text-slate-500">ถึง</span>
                        <input
                            type="date"
                            value={dateTo}
                            min={dateFrom}
                            max={today}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white transition focus:border-sky-500 focus:outline-none"
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

            {/* Error State */}
            {loadState.status === 'error' && (
                <div className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                    <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
                    <div>
                        <p className="font-semibold">โหลดข้อมูลกระทบยอดไม่สำเร็จ</p>
                        <p className="mt-1 text-rose-200/80">{loadState.error}</p>
                        <p className="mt-1 text-xs text-rose-200/60">
                            ตรวจสอบว่ารัน migration 20260520_jt_partner_statement.sql และ 20260520_jt_reconciliation_rpc.sql แล้ว
                        </p>
                    </div>
                </div>
            )}

            {/* Empty state — no data yet */}
            {!summary && loadState.status === 'idle' && (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center text-sm text-slate-500">
                    <GitCompareArrows className="mx-auto mb-3 h-8 w-8 opacity-30" aria-hidden />
                    <p>กดปุ่ม <strong className="text-slate-300">โหลดข้อมูล</strong> เพื่อเริ่มกระทบยอด</p>
                </div>
            )}

            {/* Summary Cards */}
            {(summary || isLoading) && (
                <SummarySection summary={summary} isLoading={isLoading} range={appliedRange} />
            )}

            {/* Status Filter + Detail Table */}
            {(summary || isLoading) && (
                <section className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-semibold text-white">รายการ AWB ระดับละเอียด</h2>
                            <p className="mt-0.5 text-xs text-slate-500">
                                {appliedRange.from} ถึง {appliedRange.to}
                                {data ? ` — ${formatCountWithUnit(data.detail.length)} รายการ` : ''}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Export CSV */}
                            {data && data.detail.length > 0 && (
                                <ExportCsvButton rows={data.detail} dateFrom={appliedRange.from} dateTo={appliedRange.to} />
                            )}
                            {/* Show/hide toggle */}
                            <button
                                type="button"
                                onClick={() => setShowDetail((v) => !v)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                                aria-expanded={showDetail}
                            >
                                {showDetail ? 'ซ่อนตาราง' : 'ดูตาราง'}
                                <ChevronDown className={`h-3.5 w-3.5 transition ${showDetail ? 'rotate-180' : ''}`} aria-hidden />
                            </button>
                        </div>
                    </div>

                    {/* Status filter tabs */}
                    <div className="mb-3 flex flex-wrap gap-1.5">
                        {(
                            [
                                { key: 'all', label: 'ทั้งหมด' },
                                { key: 'overcharged', label: 'J&T เก็บเกิน' },
                                { key: 'undercharged', label: 'J&T เก็บน้อยกว่า' },
                                { key: 'matched', label: 'ตรงกัน' },
                                { key: 'statement_only', label: 'มีแค่ใน Statement' },
                                { key: 'shipment_only', label: 'ไม่มีใน Statement' },
                            ] as { key: StatusFilter; label: string }[]
                        ).map((opt) => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => setStatusFilter(opt.key)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                                    statusFilter === opt.key
                                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/25'
                                        : 'border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-600 hover:text-white'
                                }`}
                            >
                                {opt.label}
                                {summary && opt.key !== 'all' && (
                                    <span className="ml-1 opacity-60">
                                        ({getStatusCount(summary, opt.key).toLocaleString('th-TH')})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {showDetail && (
                        <ReconciliationTable rows={data?.detail ?? []} isLoading={isLoading} />
                    )}
                </section>
            )}
        </div>
    );
}

// ─── Summary Section ──────────────────────────────────────────────────────────

function SummarySection({
    summary,
    isLoading,
    range,
}: {
    summary: ReconciliationSummary | null;
    isLoading: boolean;
    range: { from: string; to: string };
}) {
    const gapPositive = (summary?.totalGap ?? 0) >= 0;

    return (
        <div className="space-y-3">
            {/* Top row: 4 count cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ReconcileCard
                    label="AWB ทั้งหมด"
                    value={summary ? formatCountWithUnit(summary.totalAwbCount) : isLoading ? '…' : '-'}
                    sub={`${range.from} – ${range.to}`}
                    tone="neutral"
                    icon={<GitCompareArrows className="h-4 w-4" />}
                />
                <ReconcileCard
                    label="ตรงกัน"
                    value={summary ? formatCountWithUnit(summary.matchedCount) : isLoading ? '…' : '-'}
                    sub="ผลต่าง ≤ 1 บาท"
                    tone="emerald"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <ReconcileCard
                    label="J&T เก็บเกิน"
                    value={summary ? formatCountWithUnit(summary.overchargedCount) : isLoading ? '…' : '-'}
                    sub={summary ? `รวม ${formatThb(summary.overchargedGapTotal)}` : ''}
                    tone="rose"
                    icon={<ArrowUpCircle className="h-4 w-4" />}
                />
                <ReconcileCard
                    label="J&T เก็บน้อยกว่า"
                    value={summary ? formatCountWithUnit(summary.underchargedCount) : isLoading ? '…' : '-'}
                    sub={summary ? `รวม ${formatThb(Math.abs(summary.underchargedGapTotal))}` : ''}
                    tone="amber"
                    icon={<ArrowDownCircle className="h-4 w-4" />}
                />
            </div>

            {/* Bottom row: cost comparison */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/8 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-300/80">
                        ต้นทุนที่เราคำนวณ
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-white">
                        {summary ? formatThb(summary.totalOurCost) : isLoading ? '…' : '-'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-sky-300/50">จาก billable weight + zone</p>
                </div>
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/8 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-300/80">
                        ต้นทุน J&T เรียกเก็บจริง
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-white">
                        {summary ? formatThb(summary.totalPartnerCost) : isLoading ? '…' : '-'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-purple-300/50">จาก Statement J&T แฟรนไชส์</p>
                </div>
                <div className={`rounded-xl border p-3 ${gapPositive ? 'border-rose-500/25 bg-rose-500/8' : 'border-emerald-500/25 bg-emerald-500/8'}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${gapPositive ? 'text-rose-300/80' : 'text-emerald-300/80'}`}>
                        ผลต่างสุทธิ (J&T − เรา)
                    </p>
                    <p className={`mt-1 text-lg font-bold tabular-nums ${gapPositive ? 'text-rose-200' : 'text-emerald-200'}`}>
                        {summary ? formatThb(summary.totalGap) : isLoading ? '…' : '-'}
                    </p>
                    <p className={`mt-0.5 text-[11px] ${gapPositive ? 'text-rose-300/50' : 'text-emerald-300/50'}`}>
                        {gapPositive ? '+ = J&T เก็บเกินกว่าที่เราคำนวณ' : '− = J&T เก็บน้อยกว่าที่เราคำนวณ'}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Reconciliation Table ─────────────────────────────────────────────────────

function ReconciliationTable({ rows, isLoading }: { rows: ReconciliationDetailRow[]; isLoading: boolean }) {
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

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
                <thead className="text-slate-500">
                    <tr className="border-b border-slate-800">
                        <th className="whitespace-nowrap px-2 py-2 font-semibold">AWB</th>
                        <th className="whitespace-nowrap px-2 py-2 font-semibold">วันที่ Booking</th>
                        <th className="whitespace-nowrap px-2 py-2 font-semibold">วันที่ Statement</th>
                        <th className="whitespace-nowrap px-2 py-2 font-semibold">ปลายทาง</th>
                        <th className="whitespace-nowrap px-2 py-2 font-semibold">Zone</th>
                        <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">น้ำหนัก (kg)</th>
                        <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">ต้นทุนเรา</th>
                        <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">ต้นทุน J&T</th>
                        <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">ผลต่าง</th>
                        <th className="whitespace-nowrap px-2 py-2 font-semibold">สถานะ</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                    {rows.map((row, i) => {
                        const s = STATUS_LABELS[row.status] ?? STATUS_LABELS['matched'];
                        const gapPos = row.gap > 0;
                        const gapNeg = row.gap < 0;
                        return (
                            <tr key={`${row.awbNumber}-${i}`} className="hover:bg-slate-900/50">
                                <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-sky-300">
                                    {row.awbNumber || '—'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                                    {row.bookingDate || '—'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                                    {row.transactionDate || '—'}
                                </td>
                                <td className="max-w-[120px] truncate px-2 py-2 text-slate-300">
                                    {row.destProvince || '—'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-slate-500">
                                    {row.zoneCode ? row.zoneCode.replace('zone_', 'Z') : '—'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-400">
                                    {row.ourBillableWeightKg != null
                                        ? row.ourBillableWeightKg.toFixed(2)
                                        : '—'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-sky-200">
                                    {formatThb(row.ourCost)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-purple-200">
                                    {row.partnerCost > 0 ? formatThb(row.partnerCost) : '—'}
                                </td>
                                <td className={`whitespace-nowrap px-2 py-2 text-right font-bold tabular-nums ${
                                    gapPos ? 'text-rose-300' : gapNeg ? 'text-emerald-300' : 'text-slate-500'
                                }`}>
                                    {row.gap !== 0
                                        ? `${gapPos ? '+' : ''}${formatThb(row.gap)}`
                                        : '—'}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2">
                                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.color} ${s.bg} ${s.border}`}>
                                        {s.label}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
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

// ─── Export CSV Button ────────────────────────────────────────────────────────

function ExportCsvButton({
    rows,
    dateFrom,
    dateTo,
}: {
    rows: ReconciliationDetailRow[];
    dateFrom: string;
    dateTo: string;
}) {
    const handleExport = () => {
        const headers = [
            'AWB', 'วันที่ Booking', 'วันที่ Statement', 'ปลายทาง', 'Zone',
            'น้ำหนักคิดเงิน (kg)', 'ต้นทุนเรา (บาท)', 'ต้นทุน J&T (บาท)',
            'ผลต่าง (บาท)', 'สถานะ', 'ประเภทค่าใช้จ่าย',
        ];

        const csvRows = rows.map((r) => [
            r.awbNumber,
            r.bookingDate,
            r.transactionDate ?? '',
            r.destProvince,
            r.zoneCode ?? '',
            r.ourBillableWeightKg != null ? r.ourBillableWeightKg.toFixed(2) : '',
            r.ourCost.toFixed(2),
            r.partnerCost.toFixed(2),
            r.gap.toFixed(2),
            STATUS_LABELS[r.status]?.label ?? r.status,
            r.chargeTypes,
        ]);

        const bom = '\uFEFF';
        const csv = bom + [headers, ...csvRows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reconciliation_${dateFrom}_to_${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white"
        >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
        </button>
    );
}

// ─── Small Components ─────────────────────────────────────────────────────────

function ReconcileCard({
    label,
    value,
    sub,
    tone,
    icon,
}: {
    label: string;
    value: string;
    sub: string;
    tone: 'neutral' | 'emerald' | 'rose' | 'amber';
    icon: React.ReactNode;
}) {
    const toneClass =
        tone === 'emerald' ? 'border-emerald-500/25 bg-emerald-500/8 text-emerald-300' :
        tone === 'rose'    ? 'border-rose-500/25 bg-rose-500/8 text-rose-300' :
        tone === 'amber'   ? 'border-amber-500/25 bg-amber-500/8 text-amber-300' :
                             'border-slate-700 bg-slate-900/50 text-slate-300';

    return (
        <div className={`rounded-xl border p-3 ${toneClass}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {icon}
                <span>{label}</span>
            </div>
            <p className="mt-1.5 text-xl font-black tabular-nums text-white">{value}</p>
            <p className="mt-0.5 text-[11px] opacity-60">{sub}</p>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptySummary(): ReconciliationSummary {
    return {
        totalAwbCount: 0, matchedCount: 0, overchargedCount: 0, underchargedCount: 0,
        statementOnlyCount: 0, shipmentOnlyCount: 0,
        totalOurCost: 0, totalPartnerCost: 0, totalGap: 0,
        overchargedOurCost: 0, overchargedPartnerCost: 0, overchargedGapTotal: 0,
        underchargedOurCost: 0, underchargedPartnerCost: 0, underchargedGapTotal: 0,
    };
}

function getStatusCount(summary: ReconciliationSummary, status: StatusFilter): number {
    if (status === 'matched') return summary.matchedCount;
    if (status === 'overcharged') return summary.overchargedCount;
    if (status === 'undercharged') return summary.underchargedCount;
    if (status === 'statement_only') return summary.statementOnlyCount;
    if (status === 'shipment_only') return summary.shipmentOnlyCount;
    return summary.totalAwbCount;
}
