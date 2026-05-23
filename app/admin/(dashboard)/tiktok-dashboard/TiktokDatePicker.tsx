'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { ymdAddDays } from '@/lib/bookingDateWindow';

/**
 * ตัวเลือกช่วงวันที่ของ TikTok dashboard — ปุ่มไอคอนปฎิทิน กดแล้วเปิดการ์ดวันที่ให้เลือก.
 * เลือก "วันสิ้นสุด" 1 วัน → ระบบดูย้อนหลัง WINDOW_DAYS วันจบที่วันนั้น.
 */

const WINDOW_DAYS = 14;
const CARD_COUNT = 28; // จำนวนการ์ดวันให้เลือก (ย้อนหลังจากวันนี้ = 4 สัปดาห์)

const TH_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_DOW_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function localYmd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** parse "YYYY-MM-DD" → local Date (เที่ยงวัน กัน DST edge) */
function parseYmd(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
}

function fmtDay(ymd: string): string {
    const dt = parseYmd(ymd);
    return `${dt.getDate()} ${TH_MONTH_SHORT[dt.getMonth()]}`;
}

function fmtRange(fromYmd: string, toYmd: string): string {
    return `${fmtDay(fromYmd)} – ${fmtDay(toYmd)}`;
}

export function TiktokDatePicker({
    endDate,
    onChange,
}: {
    endDate: string;
    onChange: (endYmd: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const today = useMemo(() => localYmd(new Date()), []);
    const fromYmd = useMemo(() => ymdAddDays(endDate, -(WINDOW_DAYS - 1)), [endDate]);
    const isToday = endDate === today;

    // การ์ดวันที่ให้เลือก — ย้อนหลังจากวันนี้ (ใหม่สุดอยู่บน)
    const dayCards = useMemo(
        () => Array.from({ length: CARD_COUNT }, (_, i) => ymdAddDays(today, -i)),
        [today],
    );

    // ปิดเมื่อคลิกนอกกล่อง / กด Esc
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    function pick(ymd: string) {
        onChange(ymd);
        setOpen(false);
    }

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                title="เลือกช่วงวันที่"
                aria-haspopup="dialog"
                aria-expanded={open}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            >
                <CalendarDays className="h-4 w-4 text-rose-300" aria-hidden />
                <span className="text-xs font-semibold tabular-nums">{fmtRange(fromYmd, endDate)}</span>
                <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{WINDOW_DAYS} วัน</span>
            </button>

            {open ? (
                <div
                    role="dialog"
                    aria-label="เลือกวันสิ้นสุดช่วง"
                    className="absolute left-0 z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/60 ring-1 ring-white/[0.06]"
                >
                    <div className="border-b border-slate-800 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">เลือกวันสิ้นสุดช่วง</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">ดูย้อนหลัง {WINDOW_DAYS} วันจากวันที่เลือก</p>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2.5">
                        <button
                            type="button"
                            onClick={() => pick(today)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                                isToday
                                    ? 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40'
                                    : 'border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}
                        >
                            วันนี้
                        </button>
                        <span className="text-[10px] text-slate-600">หรือเลือกการ์ดวันด้านล่าง</span>
                    </div>

                    <div className="max-h-[10.5rem] overflow-y-auto px-3 pb-3">
                        <div className="grid grid-cols-7 gap-1">
                            {dayCards.map((ymd) => {
                                const dt = parseYmd(ymd);
                                const selected = ymd === endDate;
                                return (
                                    <button
                                        key={ymd}
                                        type="button"
                                        onClick={() => pick(ymd)}
                                        aria-pressed={selected}
                                        title={`${TH_DOW_SHORT[dt.getDay()]} ${dt.getDate()} ${TH_MONTH_SHORT[dt.getMonth()]}`}
                                        className={`relative flex flex-col items-center rounded-lg border px-0.5 py-1.5 transition ${
                                            selected
                                                ? 'border-rose-500/60 bg-rose-500/15 text-rose-100 ring-1 ring-rose-500/40'
                                                : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className="text-[8px] leading-none text-slate-500">{TH_DOW_SHORT[dt.getDay()]}</span>
                                        <span className="text-sm font-bold leading-tight tabular-nums">{dt.getDate()}</span>
                                        <span className="text-[8px] leading-none text-slate-500">{TH_MONTH_SHORT[dt.getMonth()]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-slate-800 bg-slate-900/40 px-4 py-2.5">
                        <p className="text-[11px] text-slate-400">
                            ช่วงที่เลือก: <span className="font-semibold text-slate-200">{fmtRange(fromYmd, endDate)}</span>
                            <span className="ml-1 text-slate-500">({WINDOW_DAYS} วัน)</span>
                        </p>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
