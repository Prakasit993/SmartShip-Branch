'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    toYmd,
    addCalendarMonths,
    monthStartFromYmd,
    formatCalendarMonth,
    formatThaiDateRange,
} from '@/lib/jtDashboardDateUtils';

/**
 * ปฏิทินเลือกช่วงวันที่ (from–to) แบบ popover — ใช้แทน <input type="date"> คู่เดิม
 * ให้หน้าตาเข้าชุดกันทุกแดชบอร์ด (สไตล์เดียวกับ TikTok date picker).
 *
 * Controlled: ส่ง from/to (YYYY-MM-DD, อาจเป็น '' = ยังไม่เลือก) + onChange(from,to).
 * เลือกแบบกริดเดือน: คลิกวันแรก = จุดเริ่ม, คลิกวันที่สอง = จุดจบ (เรียงให้อัตโนมัติ).
 * ไม่มีปุ่มด่วน/ปุ่มโหลดในตัว — แต่ละหน้าคงปุ่มเดิมไว้ภายนอก.
 */

type Accent = 'sky' | 'rose' | 'emerald';

const ACCENT: Record<
    Accent,
    { icon: string; badge: string; endpoint: string; middle: string; ring: string }
> = {
    sky: {
        icon: 'text-sky-300',
        badge: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
        endpoint: 'bg-sky-500 text-white',
        middle: 'bg-sky-500/15 text-sky-100',
        ring: 'ring-sky-500/40',
    },
    rose: {
        icon: 'text-rose-300',
        badge: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
        endpoint: 'bg-rose-500 text-white',
        middle: 'bg-rose-500/15 text-rose-100',
        ring: 'ring-rose-500/40',
    },
    emerald: {
        icon: 'text-emerald-300',
        badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
        endpoint: 'bg-emerald-500 text-white',
        middle: 'bg-emerald-500/15 text-emerald-100',
        ring: 'ring-emerald-500/40',
    },
};

const TH_DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function daysInclusive(from: string, to: string): number {
    const a = Date.parse(`${from}T00:00:00`);
    const b = Date.parse(`${to}T00:00:00`);
    if (Number.isNaN(a) || Number.isNaN(b)) return 0;
    return Math.round((b - a) / 86_400_000) + 1;
}

/** cells ของเดือน: ช่องว่างนำหน้าตามวันในสัปดาห์ (เริ่มอาทิตย์) + วันที่ 1..สิ้นเดือน */
function buildMonthCells(monthStart: Date): Array<string | null> {
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<string | null> = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(toYmd(new Date(year, month, d)));
    return cells;
}

export function DateRangePicker({
    from,
    to,
    onChange,
    maxDate,
    minDate,
    disabled = false,
    accent = 'sky',
    align = 'left',
    placeholder = 'เลือกช่วงวันที่',
    closeOnComplete = true,
}: {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
    maxDate?: string;
    minDate?: string;
    disabled?: boolean;
    accent?: Accent;
    align?: 'left' | 'right';
    placeholder?: string;
    /** ปิด popover อัตโนมัติเมื่อเลือกครบช่วง (default true) */
    closeOnComplete?: boolean;
}) {
    const [open, setOpen] = useState(false);
    // anchor = จุดเริ่มที่คลิกไว้ รอคลิกจุดที่สอง
    const [anchor, setAnchor] = useState<string | null>(null);
    const [calMonth, setCalMonth] = useState<Date>(() => monthStartFromYmd(to || from || toYmd(new Date())));
    const ref = useRef<HTMLDivElement>(null);
    const a = ACCENT[accent];

    const hasRange = Boolean(from && to);

    // sync เดือนที่แสดงเมื่อเปิด / เมื่อ from-to เปลี่ยนจากภายนอก (preset/clear)
    useEffect(() => {
        if (open) setCalMonth(monthStartFromYmd(to || from || toYmd(new Date())));
    }, [open, from, to]);

    // ปิดเมื่อคลิกนอก / Esc
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setAnchor(null);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
                setAnchor(null);
            }
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    // ช่วงที่ไฮไลต์: ระหว่างเลือก (anchor) โชว์จุดเดียว, ไม่งั้นโชว์ from..to
    const selStart = anchor ?? (from || '');
    const selEnd = anchor ? anchor : (to || '');

    const cells = useMemo(() => buildMonthCells(calMonth), [calMonth]);

    function isDisabledDay(ymd: string): boolean {
        if (maxDate && ymd > maxDate) return true;
        if (minDate && ymd < minDate) return true;
        return false;
    }

    function clickDay(ymd: string) {
        if (isDisabledDay(ymd)) return;
        if (anchor === null) {
            setAnchor(ymd);
            return;
        }
        const lo = ymd < anchor ? ymd : anchor;
        const hi = ymd < anchor ? anchor : ymd;
        setAnchor(null);
        onChange(lo, hi);
        if (closeOnComplete) setOpen(false);
    }

    const triggerLabel = hasRange ? formatThaiDateRange({ from, to }) : placeholder;
    const dayCount = hasRange ? daysInclusive(from, to) : 0;

    return (
        <div ref={ref} className="relative inline-block">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((v) => !v)}
                title="เลือกช่วงวันที่"
                aria-haspopup="dialog"
                aria-expanded={open}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <CalendarDays className={`h-4 w-4 ${a.icon}`} aria-hidden />
                <span className={`text-xs font-semibold tabular-nums ${hasRange ? '' : 'text-slate-400'}`}>{triggerLabel}</span>
                {dayCount > 0 ? (
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${a.badge}`}>{dayCount.toLocaleString('th-TH')} วัน</span>
                ) : null}
            </button>

            {open ? (
                <div
                    role="dialog"
                    aria-label="เลือกช่วงวันที่"
                    className={`absolute z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/60 ring-1 ring-white/[0.06] ${
                        align === 'right' ? 'right-0' : 'left-0'
                    }`}
                >
                    {/* month nav */}
                    <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
                        <button
                            type="button"
                            onClick={() => setCalMonth((m) => addCalendarMonths(m, -1))}
                            aria-label="เดือนก่อนหน้า"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
                        >
                            <ChevronLeft className="h-4 w-4" aria-hidden />
                        </button>
                        <span className="text-xs font-semibold text-slate-200">{formatCalendarMonth(calMonth)}</span>
                        <button
                            type="button"
                            onClick={() => setCalMonth((m) => addCalendarMonths(m, 1))}
                            aria-label="เดือนถัดไป"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
                        >
                            <ChevronRight className="h-4 w-4" aria-hidden />
                        </button>
                    </div>

                    {/* weekday header */}
                    <div className="grid grid-cols-7 gap-1 px-3 pt-2.5 text-center">
                        {TH_DOW.map((d) => (
                            <span key={d} className="text-[10px] font-medium text-slate-500">{d}</span>
                        ))}
                    </div>

                    {/* days */}
                    <div className="grid grid-cols-7 gap-1 px-3 pb-3 pt-1">
                        {cells.map((ymd, i) => {
                            if (ymd === null) return <span key={`b${i}`} />;
                            const day = Number(ymd.slice(8, 10));
                            const isStart = ymd === selStart;
                            const isEnd = ymd === selEnd;
                            const inRange = selStart && selEnd && ymd > selStart && ymd < selEnd;
                            const isEndpoint = isStart || isEnd;
                            const dis = isDisabledDay(ymd);
                            return (
                                <button
                                    key={ymd}
                                    type="button"
                                    disabled={dis}
                                    onClick={() => clickDay(ymd)}
                                    aria-pressed={isEndpoint}
                                    className={`flex h-8 items-center justify-center rounded-lg text-xs tabular-nums transition ${
                                        dis
                                            ? 'cursor-not-allowed text-slate-700'
                                            : isEndpoint
                                              ? `${a.endpoint} font-bold ring-1 ${a.ring}`
                                              : inRange
                                                ? a.middle
                                                : 'text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* footer */}
                    <div className="border-t border-slate-800 bg-slate-900/40 px-3 py-2.5 text-[11px]">
                        {anchor ? (
                            <span className="text-slate-400">เลือกวันสิ้นสุด… (เริ่ม {formatThaiDateRange({ from: anchor, to: anchor })})</span>
                        ) : hasRange ? (
                            <span className="text-slate-400">
                                ช่วงที่เลือก: <span className="font-semibold text-slate-200">{formatThaiDateRange({ from, to })}</span>
                                <span className="ml-1 text-slate-500">({dayCount.toLocaleString('th-TH')} วัน)</span>
                            </span>
                        ) : (
                            <span className="text-slate-500">คลิกวันเริ่มต้น แล้วคลิกวันสิ้นสุด</span>
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
