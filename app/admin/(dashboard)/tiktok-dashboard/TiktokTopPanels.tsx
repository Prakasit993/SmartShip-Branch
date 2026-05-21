'use client';

import { useId, useMemo, useState, type ComponentType } from 'react';
import { ChevronDown, Users, ShoppingBag } from 'lucide-react';

export type TiktokSenderRow = { sender: string; shop: string; count: number };
export type TiktokProductRow = { name: string; count: number };

const DEFAULT_VISIBLE = 5;

type Accent = 'sky' | 'emerald';

const ACCENT: Record<Accent, { icon: string; bar: string }> = {
    sky: {
        icon: 'bg-sky-500/15 text-sky-400 ring-sky-500/25',
        bar: 'from-sky-600/18 to-transparent',
    },
    emerald: {
        icon: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
        bar: 'from-emerald-600/18 to-transparent',
    },
};

type PanelRow = { label: string; sublabel?: string; value: number };

function truncateName(s: string, max = 24): string {
    const t = s.trim();
    return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** การ์ดจัดอันดับแบบกะทัดรัด — แสดง 5 อันดับแรก กดดูเพิ่มได้ */
function RankPanel({
    rows,
    title,
    subtitle,
    accent,
    icon: Icon,
    maxRows,
}: {
    rows: PanelRow[];
    title: string;
    subtitle: string;
    accent: Accent;
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    maxRows: number;
}) {
    const list = useMemo(() => rows.slice(0, maxRows), [rows, maxRows]);
    const [expanded, setExpanded] = useState(false);
    const headId = useId();

    if (list.length === 0) return null;

    const top1 = list[0]?.value || 1;
    const showToggle = list.length > DEFAULT_VISIBLE;
    const shown = expanded ? list : list.slice(0, DEFAULT_VISIBLE);
    const a = ACCENT[accent];

    return (
        <aside
            aria-labelledby={headId}
            className="flex max-h-[min(70vh,34rem)] flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/95 shadow-lg shadow-black/20 ring-1 ring-white/[0.04]"
        >
            <div className="border-b border-slate-800/80 px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${a.icon}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h3 id={headId} className="text-sm font-semibold text-white">{title}</h3>
                        <p className="text-[10px] leading-snug text-slate-600">{subtitle}</p>
                    </div>
                </div>
            </div>

            <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 py-2">
                {shown.map((row, idx) => {
                    const rank = idx + 1;
                    const vsTopPct = Math.round((row.value / top1) * 1000) / 10;
                    const barPct = (row.value / top1) * 100;
                    return (
                        <li key={`${row.label}-${rank}`} className="relative overflow-hidden rounded-lg px-2 py-1.5 text-[11px]">
                            <div
                                className={`pointer-events-none absolute inset-y-0 left-0 rounded-md bg-gradient-to-r ${a.bar}`}
                                style={{ width: `${barPct}%` }}
                                aria-hidden
                            />
                            <div className="relative flex items-center gap-2">
                                <span className="w-5 shrink-0 tabular-nums text-slate-500">{rank}</span>
                                <span className="min-w-0 flex-1" title={row.sublabel ? `${row.label} · ${row.sublabel}` : row.label}>
                                    <span className="block truncate font-medium text-slate-200">{truncateName(row.label)}</span>
                                    {row.sublabel ? (
                                        <span className="block truncate text-[10px] text-slate-500">{truncateName(row.sublabel, 28)}</span>
                                    ) : null}
                                </span>
                                <span className="shrink-0 tabular-nums text-slate-300">{row.value.toLocaleString('th-TH')}</span>
                                <span className="w-11 shrink-0 text-right tabular-nums text-slate-500">{vsTopPct}%</span>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {showToggle ? (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex w-full items-center justify-center gap-1 border-t border-slate-800/80 py-2 text-[11px] font-medium text-sky-400/95 transition hover:bg-slate-800/50 hover:text-sky-300"
                >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                    {expanded ? 'แสดงน้อยลง' : `ดูอีก ${list.length - DEFAULT_VISIBLE} อันดับ`}
                </button>
            ) : null}
        </aside>
    );
}

export function TiktokTopSendersPanel({ rows }: { rows: TiktokSenderRow[] }) {
    const mapped: PanelRow[] = rows.map((r) => ({
        label: r.sender || r.shop || '—',
        sublabel: r.shop && r.shop !== r.sender ? r.shop : undefined,
        value: r.count,
    }));
    return (
        <RankPanel
            rows={mapped}
            title="ผู้ส่งมากสุด"
            subtitle="ทั้งตาราง · จัดอันดับตามจำนวนชิ้น"
            accent="sky"
            icon={Users}
            maxRows={10}
        />
    );
}

export function TiktokTopProductsPanel({ rows }: { rows: TiktokProductRow[] }) {
    const mapped: PanelRow[] = rows.map((r) => ({ label: r.name, value: r.count }));
    return (
        <RankPanel
            rows={mapped}
            title="สินค้าในระบบ"
            subtitle="ทั้งตาราง · จัดอันดับตามจำนวนรายการ"
            accent="emerald"
            icon={ShoppingBag}
            maxRows={50}
        />
    );
}
