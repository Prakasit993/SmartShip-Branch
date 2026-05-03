'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';

export type JtTopSenderRow = { name: string; count: number };

const DEFAULT_VISIBLE = 5;
const MAX_ROWS = 10;

function truncateName(s: string, max = 24): string {
    const t = s.trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
}

/**
 * รายชื่อผู้ส่ง Top 5–10 แบบกะทัดรัด
 */
export function JtTopSendersPanel({ rows }: { rows: JtTopSenderRow[] }) {
    const list = useMemo(() => rows.slice(0, MAX_ROWS), [rows]);
    const [expanded, setExpanded] = useState(false);
    const headId = useId();

    if (list.length === 0) {
        return null;
    }

    const top1 = list[0]?.count || 1;
    const showToggle = list.length > DEFAULT_VISIBLE;
    const shown = expanded ? list : list.slice(0, DEFAULT_VISIBLE);

    return (
        <aside
            aria-labelledby={headId}
            className="flex max-h-[min(70vh,34rem)] flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/95 shadow-lg shadow-black/20 ring-1 ring-white/[0.04]"
        >
            <div className="border-b border-slate-800/80 px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25">
                        <Users className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h3 id={headId} className="text-sm font-semibold text-white">
                            ผู้ส่งมากสุด
                        </h3>
                        <p className="text-[10px] leading-snug text-slate-600">
                            ทั้งตาราง · ไม่ผูกช่วงวันที่กรอง
                        </p>
                    </div>
                </div>
            </div>
            <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 py-2">
                {shown.map((row, idx) => {
                    const rank = idx + 1;
                    const vsTopPct = Math.round((row.count / top1) * 1000) / 10;
                    const barPct = (row.count / top1) * 100;
                    return (
                        <li
                            key={`${row.name}-${rank}`}
                            className="relative overflow-hidden rounded-lg px-2 py-1.5 text-[11px]"
                        >
                            <div
                                className="pointer-events-none absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-sky-600/18 to-transparent"
                                style={{ width: `${barPct}%` }}
                                aria-hidden
                            />
                            <div className="relative flex items-center gap-2">
                                <span className="w-5 shrink-0 tabular-nums text-slate-500">{rank}</span>
                                <span
                                    className="min-w-0 flex-1 truncate font-medium text-slate-200"
                                    title={row.name}
                                >
                                    {truncateName(row.name)}
                                </span>
                                <span className="shrink-0 tabular-nums text-slate-300">
                                    {row.count.toLocaleString('th-TH')}
                                </span>
                                <span className="w-11 shrink-0 text-right tabular-nums text-slate-500">
                                    {vsTopPct}%
                                </span>
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
                    <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        aria-hidden
                    />
                    {expanded ? 'แสดงน้อยลง' : `ดูอีก ${list.length - DEFAULT_VISIBLE} อันดับ`}
                </button>
            ) : null}
        </aside>
    );
}
