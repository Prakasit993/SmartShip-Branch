'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, Calculator, ChevronDown, Database, Eye, EyeOff, Info, RefreshCw, TrendingUp } from 'lucide-react';

type FinancialSummary = {
    date_from: string;
    date_to: string;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    shipmentCount: number;
    costModel?: string;
    revenueBreakdown: FinancialRevenueBreakdown;
    costBreakdown: FinancialCostBreakdown;
    dailyProfit: FinancialDailyProfitRow[];
    missingCostPrices: FinancialMissingCostPriceRow[];
};

type FinancialRevenueBreakdown = {
    shippingFeeRevenue: number;
    totalShippingFeeRevenue: number;
    extraFeeRevenue: number;
};

type FinancialCostBreakdown = {
    baseShippingCost: number;
    remoteAreaFeeCost: number;
    otherFeeCost: number;
    insuranceFeeCost: number;
    returnFeeCost: number;
    codFeeCost: number;
};

type FinancialDailyProfitRow = {
    date: string;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    shipmentCount: number;
};

type FinancialMissingCostPriceRow = {
    salePrice: number;
    shipmentCount: number;
    totalRevenue: number;
    defaultCostTotal: number;
    estimatedProfitWithDefaultCost: number;
};

type FinancialSummaryState =
    | { status: 'loading'; data: FinancialSummary | null; error: null }
    | { status: 'success'; data: FinancialSummary; error: null }
    | { status: 'error'; data: FinancialSummary | null; error: string };

type FinancialRangePreset = '7d' | '30d' | '3m' | '6m' | '1y' | 'custom';

const RANGE_PRESETS: Array<{ key: Exclude<FinancialRangePreset, 'custom'>; label: string }> = [
    { key: '7d', label: '7 วันย้อนหลัง' },
    { key: '30d', label: '30 วันย้อนหลัง' },
    { key: '3m', label: '3 เดือนย้อนหลัง' },
    { key: '6m', label: '6 เดือนย้อนหลัง' },
    { key: '1y', label: '1 ปีย้อนหลัง' },
];

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

function addMonths(d: Date, months: number): Date {
    const next = new Date(d);
    next.setMonth(next.getMonth() + months);
    return next;
}

function rangeForPreset(preset: Exclude<FinancialRangePreset, 'custom'>): { from: string; to: string } {
    const today = new Date();
    const from =
        preset === '7d'
            ? addDays(today, -6)
            : preset === '30d'
                ? addDays(today, -29)
                : preset === '3m'
                    ? addMonths(today, -3)
                    : preset === '6m'
                        ? addMonths(today, -6)
                        : addMonths(today, -12);

    return {
        from: toYmd(from),
        to: toYmd(today),
    };
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

function formatDayLabel(ymd: string): string {
    const t = Date.parse(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(t)) return ymd;
    return new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

export function FinancialTab() {
    const initialRange = useMemo(() => rangeForPreset('30d'), []);
    const [dateFrom, setDateFrom] = useState(initialRange.from);
    const [dateTo, setDateTo] = useState(initialRange.to);
    const [appliedRange, setAppliedRange] = useState(initialRange);
    const [activePreset, setActivePreset] = useState<FinancialRangePreset>('30d');
    const [state, setState] = useState<FinancialSummaryState>({
        status: 'loading',
        data: null,
        error: null,
    });
    const [showProfitAnalysis, setShowProfitAnalysis] = useState(false);

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
                costModel: typeof json.costModel === 'string' ? json.costModel : undefined,
                revenueBreakdown: {
                    shippingFeeRevenue: Number(json.revenueBreakdown?.shippingFeeRevenue) || 0,
                    totalShippingFeeRevenue: Number(json.revenueBreakdown?.totalShippingFeeRevenue) || 0,
                    extraFeeRevenue: Number(json.revenueBreakdown?.extraFeeRevenue) || 0,
                },
                costBreakdown: {
                    baseShippingCost: Number(json.costBreakdown?.baseShippingCost) || 0,
                    remoteAreaFeeCost: Number(json.costBreakdown?.remoteAreaFeeCost) || 0,
                    otherFeeCost: Number(json.costBreakdown?.otherFeeCost) || 0,
                    insuranceFeeCost: Number(json.costBreakdown?.insuranceFeeCost) || 0,
                    returnFeeCost: Number(json.costBreakdown?.returnFeeCost) || 0,
                    codFeeCost: Number(json.costBreakdown?.codFeeCost) || 0,
                },
                dailyProfit: Array.isArray(json.dailyProfit)
                    ? json.dailyProfit.map((r) => ({
                          date: String((r as FinancialDailyProfitRow).date || ''),
                          totalRevenue: Number((r as FinancialDailyProfitRow).totalRevenue) || 0,
                          totalCost: Number((r as FinancialDailyProfitRow).totalCost) || 0,
                          totalProfit: Number((r as FinancialDailyProfitRow).totalProfit) || 0,
                          shipmentCount: Number((r as FinancialDailyProfitRow).shipmentCount) || 0,
                      }))
                    : [],
                missingCostPrices: Array.isArray(json.missingCostPrices)
                    ? json.missingCostPrices.map((r) => ({
                          salePrice: Number((r as FinancialMissingCostPriceRow).salePrice) || 0,
                          shipmentCount: Number((r as FinancialMissingCostPriceRow).shipmentCount) || 0,
                          totalRevenue: Number((r as FinancialMissingCostPriceRow).totalRevenue) || 0,
                          defaultCostTotal: Number((r as FinancialMissingCostPriceRow).defaultCostTotal) || 0,
                          estimatedProfitWithDefaultCost:
                              Number((r as FinancialMissingCostPriceRow).estimatedProfitWithDefaultCost) || 0,
                      }))
                    : [],
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

    const applyPreset = (preset: Exclude<FinancialRangePreset, 'custom'>) => {
        const range = rangeForPreset(preset);
        setActivePreset(preset);
        setDateFrom(range.from);
        setDateTo(range.to);
        setAppliedRange(range);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="basis-full">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        เลือกช่วงเวลาที่ต้องการดึงข้อมูล
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {RANGE_PRESETS.map((preset) => {
                            const active = activePreset === preset.key;
                            return (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => applyPreset(preset.key)}
                                    disabled={isLoading && active}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                        active
                                            ? 'border-sky-400/60 bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/25'
                                            : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:bg-slate-900 hover:text-slate-100'
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <label className="space-y-1 text-xs font-medium text-slate-400">
                    <span>วันที่เริ่มต้น</span>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => {
                            setActivePreset('custom');
                            setDateFrom(e.target.value);
                        }}
                        className="block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/20 focus:border-sky-500 focus:ring-2"
                    />
                </label>
                <label className="space-y-1 text-xs font-medium text-slate-400">
                    <span>วันที่สิ้นสุด</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => {
                            setActivePreset('custom');
                            setDateTo(e.target.value);
                        }}
                        className="block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500/20 focus:border-sky-500 focus:ring-2"
                    />
                </label>
                <button
                    type="button"
                    disabled={!canApply || isLoading}
                    onClick={() => {
                        setActivePreset('custom');
                        setAppliedRange({ from: dateFrom, to: dateTo });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
                    ใช้ช่วงวันที่กำหนดเอง
                </button>
                <p className="text-xs text-slate-500">
                    อ้างอิง `booking_date` และคำนวณต้นทุนจากน้ำหนักคิดเงินล่าสุดก่อน fallback ไปตารางต้นทุนเดิม
                </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <FinancialMetricCard
                    label="ยอดขายค่าขนส่ง"
                    value={data ? formatThb(data.totalRevenue) : isLoading ? 'กำลังโหลด...' : '-'}
                    hint="รวมรายได้จริงจาก total_shipping_fee และ fallback เป็น shipping_fee ถ้าไม่มีค่า"
                    icon={<TrendingUp className="h-5 w-5" aria-hidden />}
                />
                <FinancialMetricCard
                    label="ต้นทุนรวม"
                    value={data ? formatThb(data.totalCost) : isLoading ? 'กำลังโหลด...' : '-'}
                    hint="ใช้ปลายทาง + billable weight จาก gateway/น้ำหนักจริง แล้ว fallback ด้วย shipping_cost_master"
                    icon={<Database className="h-5 w-5" aria-hidden />}
                />
                <FinancialMetricCard
                    label="กำไรรวม"
                    value={data ? formatThb(data.totalProfit) : isLoading ? 'กำลังโหลด...' : '-'}
                    hint="กำไร = total_shipping_fee ที่ร้านเก็บจริง - ต้นทุนขนส่งและ fee ที่คำนวณล่าสุด"
                    icon={<Calculator className="h-5 w-5" aria-hidden />}
                />
            </div>

            {data ? (
                <FinancialBreakdownPanel
                    revenueBreakdown={data.revenueBreakdown}
                    costBreakdown={data.costBreakdown}
                    totalRevenue={data.totalRevenue}
                    totalCost={data.totalCost}
                    totalProfit={data.totalProfit}
                />
            ) : null}

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
                    <div className="flex items-center gap-2">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                            กำไร
                        </span>
                        <button
                            type="button"
                            aria-expanded={showProfitAnalysis}
                            aria-controls="financial-profit-analysis-body"
                            onClick={() => setShowProfitAnalysis((v) => !v)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white"
                        >
                            {showProfitAnalysis ? (
                                <EyeOff className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                                <Eye className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {showProfitAnalysis ? 'ซ่อน' : 'แสดง'}
                        </button>
                    </div>
                </div>

                {showProfitAnalysis ? (
                    <div id="financial-profit-analysis-body">
                        {state.status === 'error' ? (
                            <div className="mt-4 flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                                <div>
                                    <p className="font-semibold">โหลดข้อมูล financial ไม่สำเร็จ</p>
                                    <p className="mt-1 text-rose-200/80">{state.error}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 space-y-4">
                                <DailyProfitChart rows={data?.dailyProfit ?? []} />
                                {data && data.missingCostPrices.length > 0 ? (
                                    <MissingCostPricesTable rows={data.missingCostPrices} />
                                ) : null}
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        id="financial-profit-analysis-body"
                        className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-4 text-sm text-slate-500"
                    >
                        ซ่อนรายละเอียดกำไรรายวันและตารางราคาที่ยังไม่มีต้นทุนไว้
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
        <article className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/85 to-slate-950/90 p-2.5 ring-1 ring-white/[0.03]">
            <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
                    {icon}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>{label}</span>
                    <InlineInfoTooltip content={hint} />
                </div>
            </div>
            <p className="text-2xl font-black leading-tight text-white sm:text-[1.7rem]">{value}</p>
        </article>
    );
}

function InlineInfoTooltip({ content }: { content: string }) {
    return (
        <span className="group relative inline-flex">
            <button
                type="button"
                aria-label="คำอธิบายการคำนวณ"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 outline-none transition hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
                <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-5 z-20 w-56 rounded-lg border border-slate-700 bg-slate-950/95 p-2 text-[11px] normal-case leading-relaxed text-slate-300 opacity-0 shadow-xl shadow-black/30 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
                {content}
            </span>
        </span>
    );
}

function FinancialBreakdownPanel({
    revenueBreakdown,
    costBreakdown,
    totalRevenue,
    totalCost,
    totalProfit,
}: {
    revenueBreakdown: FinancialRevenueBreakdown;
    costBreakdown: FinancialCostBreakdown;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
}) {
    const [showDetails, setShowDetails] = useState(false);
    const revenueRows = [
        { label: 'ค่าส่งฐานที่ร้านคีย์', value: revenueBreakdown.shippingFeeRevenue },
        { label: 'ส่วนต่างที่เก็บเพิ่ม', value: revenueBreakdown.extraFeeRevenue },
        { label: 'รายได้รวมที่เก็บจริง', value: totalRevenue, strong: true },
    ];
    const costRows = [
        { label: 'ต้นทุนค่าส่งฐาน', value: costBreakdown.baseShippingCost },
        { label: 'พื้นที่ห่างไกล', value: costBreakdown.remoteAreaFeeCost },
        { label: 'COD fee', value: costBreakdown.codFeeCost },
        { label: 'ค่าอื่น ๆ', value: costBreakdown.otherFeeCost },
        { label: 'ประกัน', value: costBreakdown.insuranceFeeCost },
        { label: 'ตีกลับ', value: costBreakdown.returnFeeCost },
        { label: 'ต้นทุนรวม', value: totalCost, strong: true },
    ];

    return (
        <section className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-white">สรุปรายได้และต้นทุน</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        แสดงภาพรวมก่อน และซ่อนรายละเอียดการคำนวณไว้จนกว่าจะกดดูเพิ่มเติม
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                    aria-expanded={showDetails}
                >
                    {showDetails ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                    <ChevronDown className={`h-3.5 w-3.5 transition ${showDetails ? 'rotate-180' : ''}`} aria-hidden />
                </button>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <CompactSummaryCard label="รายได้รวมที่เก็บจริง" value={totalRevenue} tone="sky" />
                <CompactSummaryCard label="ต้นทุนรวม" value={totalCost} tone="amber" />
                <CompactSummaryCard label="กำไรสุทธิ" value={totalProfit} tone={totalProfit >= 0 ? 'emerald' : 'rose'} />
            </div>

            {showDetails ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <BreakdownCard
                        title="แจกแจงรายได้"
                        subtitle="แยกค่าส่งฐานออกจากรายได้ส่วนต่างที่ร้านเก็บเพิ่ม"
                        rows={revenueRows}
                        accent="sky"
                    />
                    <BreakdownCard
                        title="แจกแจงต้นทุน"
                        subtitle="รวมต้นทุนค่าส่งฐาน พื้นที่ห่างไกล COD และค่าธรรมเนียมอื่น ๆ"
                        rows={costRows}
                        accent="amber"
                    />
                </div>
            ) : (
                <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-500">
                    ซ่อนตารางแจกแจงรายได้และต้นทุนไว้ กดปุ่ม "ดูรายละเอียด" เพื่อเปิดรายการคำนวณทั้งหมด
                </div>
            )}
        </section>
    );
}

function BreakdownCard({
    title,
    subtitle,
    rows,
    accent,
}: {
    title: string;
    subtitle: string;
    rows: Array<{ label: string; value: number; strong?: boolean }>;
    accent: 'sky' | 'amber';
}) {
    const accentClass =
        accent === 'sky'
            ? 'border-sky-500/25 bg-sky-500/10 text-sky-200'
            : 'border-amber-500/25 bg-amber-500/10 text-amber-200';

    return (
        <article className="rounded-xl border border-slate-800 bg-slate-950/45 p-4">
            <div className="mb-3">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accentClass}`}>
                    {title}
                </span>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{subtitle}</p>
            </div>
            <div className="space-y-2">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                            row.strong ? 'bg-slate-900 text-white' : 'bg-slate-900/45 text-slate-300'
                        }`}
                    >
                        <span className="text-xs">{row.label}</span>
                        <span className="font-semibold tabular-nums">{formatThb(row.value)}</span>
                    </div>
                ))}
            </div>
        </article>
    );
}

function CompactSummaryCard({
    label,
    value,
    tone,
    isCount = false,
}: {
    label: string;
    value: number;
    tone: 'sky' | 'amber' | 'emerald' | 'rose';
    isCount?: boolean;
}) {
    const toneClass =
        tone === 'sky'
            ? 'border-sky-500/30 bg-sky-500/10 text-sky-200'
            : tone === 'amber'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                : tone === 'rose'
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';

    return (
        <article className={`rounded-lg border px-3 py-2 ${toneClass}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
                {isCount ? `${Math.trunc(value).toLocaleString('th-TH')} วัน` : formatThb(value)}
            </p>
        </article>
    );
}

function DailyProfitChart({ rows }: { rows: FinancialDailyProfitRow[] }) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const orderedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const maxProfit = Math.max(0, ...orderedRows.map((r) => r.totalProfit));
    const minProfit = Math.min(0, ...orderedRows.map((r) => r.totalProfit));
    const range = Math.max(1, maxProfit - minProfit);
    const chartWidth = Math.max(680, orderedRows.length * 34);
    const chartHeight = 260;
    const padding = { top: 20, right: 18, bottom: 42, left: 18 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;
    const stepX = orderedRows.length > 1 ? innerWidth / (orderedRows.length - 1) : innerWidth;
    const barWidth = Math.max(8, Math.min(22, stepX * 0.62));
    const yOf = (value: number) => padding.top + ((maxProfit - value) / range) * innerHeight;
    const zeroY = yOf(0);
    const labelEvery = Math.max(1, Math.ceil(orderedRows.length / 8));
    const avgProfit = orderedRows.length > 0 ? orderedRows.reduce((s, r) => s + r.totalProfit, 0) / orderedRows.length : 0;
    const activeRow = activeIndex != null ? orderedRows[activeIndex] : null;

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-white">กำไรรายวัน</h3>
                    <p className="mt-1 text-xs text-slate-500">กราฟแท่งแสดงกำไร/ขาดทุนต่อวัน โดยเทียบกับเส้นฐานศูนย์</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                        {orderedRows.length.toLocaleString('th-TH')} วัน
                    </span>
                    <span className="rounded-full border border-sky-500/35 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
                        เฉลี่ย/วัน {formatThb(avgProfit)}
                    </span>
                </div>
            </div>

            {orderedRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-800 p-5 text-sm text-slate-500">
                    ยังไม่มีข้อมูลรายวันในช่วงนี้
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="scrollbar-hide overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/45 p-2">
                        <svg
                            width={chartWidth}
                            height={chartHeight}
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            className="min-w-full"
                            role="img"
                            aria-label="กราฟกำไรรายวัน"
                            onMouseLeave={() => setActiveIndex(null)}
                        >
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                                const y = padding.top + ratio * innerHeight;
                                return (
                                    <line
                                        key={ratio}
                                        x1={padding.left}
                                        y1={y}
                                        x2={chartWidth - padding.right}
                                        y2={y}
                                        stroke="rgba(148,163,184,0.18)"
                                        strokeWidth="1"
                                    />
                                );
                            })}

                            <line
                                x1={padding.left}
                                y1={zeroY}
                                x2={chartWidth - padding.right}
                                y2={zeroY}
                                stroke="rgba(248,250,252,0.35)"
                                strokeDasharray="4 3"
                                strokeWidth="1.2"
                            />

                            {orderedRows.map((row, idx) => {
                                const xCenter = padding.left + idx * stepX;
                                const yValue = yOf(row.totalProfit);
                                const top = Math.min(yValue, zeroY);
                                const height = Math.max(2, Math.abs(zeroY - yValue));
                                const positive = row.totalProfit >= 0;
                                const active = activeIndex === idx;
                                const valueLabelY = Math.max(12, top - 8);
                                return (
                                    <g
                                        key={row.date}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                        onFocus={() => setActiveIndex(idx)}
                                        onBlur={() => setActiveIndex(null)}
                                    >
                                        <rect
                                            x={xCenter - barWidth / 2}
                                            y={top}
                                            width={barWidth}
                                            height={height}
                                            rx={4}
                                            fill={positive ? 'rgba(16,185,129,0.9)' : 'rgba(244,63,94,0.9)'}
                                            stroke={active ? 'rgba(248,250,252,0.9)' : 'none'}
                                            strokeWidth={active ? 1.2 : 0}
                                            className="cursor-pointer"
                                        >
                                            <title>{`${row.date} · ${formatThb(row.totalProfit)} · ${formatCount(row.shipmentCount)}`}</title>
                                        </rect>
                                        {active ? (
                                            <text
                                                x={xCenter}
                                                y={valueLabelY}
                                                textAnchor="middle"
                                                fill={positive ? 'rgba(110,231,183,1)' : 'rgba(253,164,175,1)'}
                                                fontSize="11"
                                                fontWeight="700"
                                                stroke="rgba(15,23,42,0.92)"
                                                strokeWidth="3"
                                                paintOrder="stroke"
                                            >
                                                {formatThb(row.totalProfit)}
                                            </text>
                                        ) : null}
                                        {idx % labelEvery === 0 || idx === orderedRows.length - 1 ? (
                                            <text
                                                x={xCenter}
                                                y={chartHeight - 12}
                                                textAnchor="middle"
                                                fill="rgba(148,163,184,0.9)"
                                                fontSize="10"
                                            >
                                                {formatDayLabel(row.date)}
                                            </text>
                                        ) : null}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/45 px-3 py-2 text-xs text-slate-400">
                        {activeRow ? (
                            <span className="font-medium text-slate-200">
                                {formatDayLabel(activeRow.date)} · กำไร {formatThb(activeRow.totalProfit)} · {formatCount(activeRow.shipmentCount)}
                            </span>
                        ) : (
                            <span>เลื่อนเมาส์บนแท่งเพื่อดูตัวเลขกำไรของวันนั้น</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function MissingCostPricesTable({ rows }: { rows: FinancialMissingCostPriceRow[] }) {
    if (rows.length === 0) return null;

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">ตารางราคาที่ยังไม่มีต้นทุน</h3>
                <p className="mt-1 text-xs text-slate-500">
                    รายการนี้ยังใช้ต้นทุน default 15 บาท ควรเติมเรตใน `jt_shipping_cost_rates` หรือ fallback ใน `shipping_cost_master`
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                    <thead className="text-slate-500">
                        <tr className="border-b border-slate-800">
                            <th className="whitespace-nowrap px-2 py-2 font-semibold">ราคาขาย</th>
                            <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">จำนวน</th>
                            <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">รายได้</th>
                            <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">กำไร default</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 text-slate-300">
                        {rows.map((row) => (
                            <tr key={row.salePrice} className="hover:bg-slate-900/60">
                                <td className="whitespace-nowrap px-2 py-2 font-semibold text-white">
                                    {formatThb(row.salePrice)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                    {row.shipmentCount.toLocaleString('th-TH')}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                                    {formatThb(row.totalRevenue)}
                                </td>
                                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-amber-300">
                                    {formatThb(row.estimatedProfitWithDefaultCost)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
