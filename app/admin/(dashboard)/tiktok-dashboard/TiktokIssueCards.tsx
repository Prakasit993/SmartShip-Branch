import type { ReactNode } from 'react';
import { Check, Copy, Info } from 'lucide-react';
import type { HiddenCase } from './tiktokDashboardTypes';

/** ⓘ tooltip อธิบายการเชื่อม/ที่มาของฟิลด์ — pattern เดียวกับ jt-deep-dive FinancialMetricCard */
export function InlineInfoTooltip({ content }: { content: string }) {
    return (
        <span className="group/info relative inline-flex">
            <button
                type="button"
                aria-label="คำอธิบายการคำนวณ"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 outline-none transition hover:text-slate-300 focus-visible:ring-2 focus-visible:ring-sky-500/40"
            >
                <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span
                role="tooltip"
                className="pointer-events-none absolute left-0 top-5 z-20 w-60 rounded-lg border border-slate-700 bg-slate-950/95 p-2 text-[11px] normal-case leading-relaxed text-slate-300 opacity-0 shadow-xl shadow-black/30 transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
            >
                {content}
            </span>
        </span>
    );
}

/* สีของการ์ดติดตามปัญหา */
const TONE: Record<'rose' | 'amber', { iconBg: string; iconRing: string; iconFg: string; glow: string; active: string }> = {
    rose: { iconBg: 'bg-rose-500/15', iconRing: 'ring-rose-500/25', iconFg: 'text-rose-300', glow: 'bg-rose-500/40', active: 'border-rose-500/60 ring-rose-500/35' },
    amber: { iconBg: 'bg-amber-500/15', iconRing: 'ring-amber-500/25', iconFg: 'text-amber-400', glow: 'bg-amber-500/40', active: 'border-amber-500/60 ring-amber-500/35' },
};

/** การ์ดตัวเลขปัญหา — คลิกเพื่อเปิด/ปิด drilldown. `tooltip` = ⓘ อธิบายที่มาของฟิลด์ */
export function IssueCard({ icon, tone, label, value, hint, tooltip, isActive, onClick }: { icon: ReactNode; tone: 'rose' | 'amber'; label: string; value: number; hint: string; tooltip?: string; isActive: boolean; onClick: () => void }) {
    const t = TONE[tone];
    return (
        <article
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            className={`group relative flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900/60 via-slate-900/50 to-slate-950/80 p-4 shadow-lg shadow-black/20 ring-1 backdrop-blur-sm transition-all duration-300 sm:p-5 ${isActive ? `${t.active} shadow-black/20` : 'border-slate-800/80 ring-white/[0.06] hover:-translate-y-0.5 hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/30'}`}
        >
            <div className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full ${t.glow} opacity-20 blur-2xl`} />
            <div className={`relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${t.iconBg} ${t.iconFg} ring-1 ${t.iconRing} transition-transform duration-300 group-hover:scale-110 sm:mb-4 sm:h-11 sm:w-11`}>{icon}</div>
            <div className="flex items-center gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-[11px]">{label}</p>
                {tooltip ? <InlineInfoTooltip content={tooltip} /> : null}
            </div>
            <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-white sm:mt-2 sm:text-2xl">{value.toLocaleString('th-TH')}</p>
            <p className="mt-auto pt-1.5 text-[10px] leading-snug text-slate-500 sm:pt-2 sm:text-[11px]">{hint}</p>
        </article>
    );
}

/** เลข AWB ที่คลิกเพื่อคัดลอก */
export function AwbCell({ awb, copied, onCopy }: { awb: string; copied: boolean; onCopy: () => void }) {
    return (
        <button type="button" onClick={onCopy} className="inline-flex min-w-0 items-center gap-1 truncate text-left text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline" title={`คลิกเพื่อคัดลอก ${awb}`}>
            {awb}
            {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden /> : <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />}
        </button>
    );
}

export function CopyAllButton({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white">
            <Copy className="h-3.5 w-3.5" aria-hidden /> คัดลอก AWB ทั้งชุด
        </button>
    );
}

export function HiddenToggle({ active, count, onClick }: { active: boolean; count: number; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${active ? 'border-sky-500/50 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:text-white'}`}>
            {active ? 'ซ่อนรายการที่ซ่อนไว้' : `ดูที่ซ่อนไว้ (${count})`}
        </button>
    );
}

export function ShowMoreButton({ expanded, extra, onClick }: { expanded: boolean; extra: number; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="mt-2 w-full rounded-lg bg-slate-900/50 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-white/[0.04] transition-colors hover:bg-slate-800/60 hover:text-slate-300">
            {expanded ? 'แสดงน้อยลง' : `ดูเพิ่มเติมอีก ${extra} รายการ`}
        </button>
    );
}

/** รายการที่ถูกซ่อน (ack active) + ปุ่มดึงกลับ — ใช้ทั้งฝั่งตกค้าง/ตีกลับ */
export function HiddenList({ title, rows, expanded, onToggleExpand, copiedAwb, onCopy, restoringAwb, onRestore }: {
    title: string;
    rows: HiddenCase[];
    expanded: boolean;
    onToggleExpand: () => void;
    copiedAwb: string | null;
    onCopy: (awb: string) => void;
    restoringAwb: string | null;
    onRestore: (awb: string) => void;
}) {
    return (
        <div className="mt-3 rounded-lg border border-slate-800/70 bg-slate-900/30 p-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            {rows.length > 0 ? (
                <>
                    <div className="space-y-1.5 overflow-x-auto">
                        <div className="grid min-w-[720px] grid-cols-[1.6rem_1fr_1.7fr_1fr_5rem] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            <span>#</span><span>เลขพัสดุ</span><span>เหตุผล</span><span>รับทราบเมื่อ</span><span className="text-right">จัดการ</span>
                        </div>
                        {(expanded ? rows : rows.slice(0, 5)).map((h, idx) => (
                            <div key={`${h.awb_number}-${idx}`} className="grid min-w-[720px] grid-cols-[1.6rem_1fr_1.7fr_1fr_5rem] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]">
                                <span className="tabular-nums text-slate-500">{idx + 1}</span>
                                <AwbCell awb={h.awb_number} copied={copiedAwb === h.awb_number} onCopy={() => onCopy(h.awb_number)} />
                                <span className="min-w-0 truncate text-slate-300" title={h.reason}>{h.reason}</span>
                                <span className="min-w-0 truncate text-right tabular-nums text-slate-400">{h.acknowledged_at !== '-' ? h.acknowledged_at.slice(0, 16) : '—'}</span>
                                <button type="button" disabled={restoringAwb === h.awb_number} onClick={() => onRestore(h.awb_number)} className="justify-self-end rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200 transition-colors hover:border-sky-400/50 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                                    {restoringAwb === h.awb_number ? '...' : 'ดึงกลับ'}
                                </button>
                            </div>
                        ))}
                    </div>
                    {rows.length > 5 ? <ShowMoreButton expanded={expanded} extra={rows.length - 5} onClick={onToggleExpand} /> : null}
                </>
            ) : (
                <p className="text-xs text-slate-500">ยังไม่มีรายการที่ซ่อนไว้</p>
            )}
        </div>
    );
}
