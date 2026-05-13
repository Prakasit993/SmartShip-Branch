'use client';

import { AlertTriangle, Bot, CheckCircle2, ChevronDown, Clock3, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

type AiFinancialReport = {
    id: number | string;
    reportDate: string | null;
    reportType: string | null;
    healthStatus: string;
    title: string;
    summary: string;
    keyMetrics: Record<string, unknown>;
    highlights: unknown[];
    risks: unknown[];
    recommendedActions: unknown[];
    dataQualityNotes: unknown[];
    sourcePayload: Record<string, unknown>;
    aiModel: string | null;
    createdAt: string | null;
};

type ReportState =
    | { status: 'loading'; report: null; error: null }
    | { status: 'success'; report: AiFinancialReport | null; error: null }
    | { status: 'error'; report: null; error: string };

function formatThb(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 2,
    });
}

function formatPercent(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return `${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string | null): string {
    if (!value) return '-';
    const t = Date.parse(`${value}T12:00:00.000Z`);
    if (Number.isNaN(t)) return value;
    return new Date(t).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatCreatedAt(value: string | null): string {
    if (!value) return '-';
    const t = Date.parse(value);
    if (Number.isNaN(t)) return value;
    return new Date(t).toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function stringifyItem(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return String(record.text || record.message || record.title || JSON.stringify(value));
    }
    return String(value ?? '');
}

function healthStyle(status: string) {
    if (status === 'good') {
        return {
            label: 'ปกติ',
            className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
            icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
        };
    }
    if (status === 'critical') {
        return {
            label: 'วิกฤต',
            className: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
            icon: <ShieldAlert className="h-4 w-4" aria-hidden />,
        };
    }
    return {
        label: 'เฝ้าระวัง',
        className: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
        icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
    };
}

export function AiFinancialReportCard() {
    const [state, setState] = useState<ReportState>({ status: 'loading', report: null, error: null });
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        async function loadReport() {
            try {
                const res = await fetch('/api/admin/ai-financial-reports/latest', {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                });
                const json = await res.json() as { report?: AiFinancialReport | null; error?: string };
                if (!res.ok) throw new Error(json.error || 'โหลดรายงาน AI ไม่สำเร็จ');
                setState({ status: 'success', report: json.report || null, error: null });
            } catch (e) {
                if ((e as { name?: string }).name === 'AbortError') return;
                setState({
                    status: 'error',
                    report: null,
                    error: e instanceof Error ? e.message : 'โหลดรายงาน AI ไม่สำเร็จ',
                });
            }
        }

        loadReport();
        return () => controller.abort();
    }, []);

    if (state.status === 'loading') {
        return (
            <section className="rounded-2xl border border-slate-800/70 bg-slate-900/45 p-4 ring-1 ring-white/[0.03]">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                    <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                    กำลังโหลดรายงาน AI ล่าสุด...
                </div>
            </section>
        );
    }

    if (state.status === 'error') {
        return (
            <section className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
                {state.error}
            </section>
        );
    }

    if (!state.report) {
        return (
            <section className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/35 p-4">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-slate-800 p-2 text-slate-300">
                        <Bot className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">ยังไม่มีรายงาน AI</h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            เมื่อ n8n สร้างรายงานและบันทึกลง `ai_financial_reports` แล้ว รายงานล่าสุดจะแสดงที่นี่
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    const report = state.report;
    const health = healthStyle(report.healthStatus);
    const totalRevenue = report.keyMetrics.total_revenue;
    const totalCost = report.keyMetrics.total_cost;
    const totalProfit = report.keyMetrics.total_profit;
    const margin = report.keyMetrics.profit_margin_percent;
    const shipmentCount = report.keyMetrics.shipment_count;
    const extraFeePercent = report.keyMetrics.extra_fee_percent;
    const topCustomerInsight = typeof report.keyMetrics.top_customer_insight === 'string'
        ? report.keyMetrics.top_customer_insight
        : null;

    return (
        <section className="rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 shadow-xl shadow-black/10 ring-1 ring-white/[0.03]">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-sky-500/15 p-2 text-sky-300 ring-1 ring-sky-500/25">
                        <Bot className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-white">{report.title}</h2>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${health.className}`}>
                                {health.icon}
                                {health.label}
                            </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>ประจำวันที่ {formatDate(report.reportDate)}</span>
                            <span className="hidden text-slate-700 sm:inline">•</span>
                            <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                                สร้างเมื่อ {formatCreatedAt(report.createdAt)}
                            </span>
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                    aria-expanded={showDetails}
                >
                    {showDetails ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                    <ChevronDown className={`h-3.5 w-3.5 transition ${showDetails ? 'rotate-180' : ''}`} aria-hidden />
                </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">{report.summary}</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <MetricPill label="รายได้" value={formatThb(totalRevenue)} />
                <MetricPill label="ต้นทุน" value={formatThb(totalCost)} />
                <MetricPill label="กำไรสุทธิ" value={formatThb(totalProfit)} emphasis={Number(totalProfit) >= 0 ? 'good' : 'bad'} />
                <MetricPill label="อัตรากำไร" value={formatPercent(margin)} />
            </div>

            {/* Extra metrics from upgraded prompt — shown only when present */}
            {(shipmentCount != null || extraFeePercent != null) ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    {shipmentCount != null ? (
                        <MetricPill label="จำนวน Shipments" value={Number(shipmentCount).toLocaleString('th-TH')} />
                    ) : null}
                    {extraFeePercent != null ? (
                        <MetricPill label="สัดส่วน Extra Fee" value={formatPercent(extraFeePercent)} />
                    ) : null}
                </div>
            ) : null}

            {showDetails ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <InsightList title="ประเด็นเด่น" items={report.highlights} tone="emerald" />
                    <InsightList title="ความเสี่ยง" items={report.risks} tone="amber" />
                    <InsightList title="คำแนะนำ" items={report.recommendedActions} tone="sky" />

                    {topCustomerInsight ? (
                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-violet-200 lg:col-span-3">
                            <h3 className="text-sm font-semibold">วิเคราะห์ลูกค้า</h3>
                            <p className="mt-2 text-xs leading-relaxed">{topCustomerInsight}</p>
                        </div>
                    ) : null}

                    {report.dataQualityNotes.length > 0 ? (
                        <div className="lg:col-span-3">
                            <InsightList title="หมายเหตุคุณภาพข้อมูล" items={report.dataQualityNotes} tone="slate" />
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}

function MetricPill({
    label,
    value,
    emphasis,
}: {
    label: string;
    value: string;
    emphasis?: 'good' | 'bad';
}) {
    const valueClass = emphasis === 'good' ? 'text-emerald-200' : emphasis === 'bad' ? 'text-rose-200' : 'text-white';
    return (
        <article className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
        </article>
    );
}

function InsightList({
    title,
    items,
    tone,
}: {
    title: string;
    items: unknown[];
    tone: 'emerald' | 'amber' | 'sky' | 'slate';
}) {
    const toneClass =
        tone === 'emerald'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
            : tone === 'amber'
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                : tone === 'sky'
                    ? 'border-sky-500/20 bg-sky-500/10 text-sky-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300';

    return (
        <div className={`rounded-xl border p-3 ${toneClass}`}>
            <h3 className="text-sm font-semibold">{title}</h3>
            {items.length === 0 ? (
                <p className="mt-2 text-xs opacity-75">ไม่มีข้อมูลในหัวข้อนี้</p>
            ) : (
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed">
                    {items.slice(0, 5).map((item, idx) => (
                        <li key={idx} className="flex gap-2">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
                            <span>{stringifyItem(item)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
