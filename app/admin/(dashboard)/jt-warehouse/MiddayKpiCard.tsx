'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Target,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Settings,
    Loader2,
    X,
    Save,
} from 'lucide-react';

/**
 * MiddayKpiCard — Phase 4
 *
 * แสดง KPI gate ก่อนเที่ยง: % ปิดงานจากยอดเข้าวันนี้ ต้อง ≥ target (default 20%)
 *
 * States:
 *   no_data    — ซ่อน card (ยังไม่มี intake วันนี้)
 *   achieved   — สีเขียว ผ่านเป้า
 *   behind     — สีเหลือง ต่ำกว่าเป้า (ยังไม่เลย cutoff)
 *   missed     — สีแดง พลาดเป้า (เลย cutoff แล้ว)
 */

type Performance = {
    branch_code: string;
    date: string;
    target_pct: number;
    cutoff_hour: number;
    intake_count: number;
    closed_count: number;
    closed_pct: number;
    target_count: number;
    delta_count: number;
    delta_pct: number;
    status: 'no_data' | 'achieved' | 'behind' | 'missed';
    minutes_until_cutoff: number;
    is_after_cutoff: boolean;
};

const POLL_INTERVAL_MS = 60_000;

function formatNumber(n: number): string {
    return n.toLocaleString('th-TH');
}

function formatPct(p: number): string {
    return `${(p * 100).toFixed(1)}%`;
}

function formatMinutes(mins: number): string {
    const abs = Math.abs(mins);
    const hrs = Math.floor(abs / 60);
    const rem = abs % 60;
    if (hrs > 0) return `${hrs} ชม. ${rem} นาที`;
    return `${rem} นาที`;
}

type Props = {
    branchCode: string;
};

export function MiddayKpiCard({ branchCode }: Props) {
    const [perf, setPerf] = useState<Performance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const fetchPerf = useCallback(async () => {
        try {
            const res = await fetch(
                `/api/admin/jt-warehouse/midday-performance?branch=${encodeURIComponent(branchCode)}`,
                { credentials: 'include', cache: 'no-store' },
            );
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                setError(typeof j.error === 'string' ? j.error : `HTTP ${res.status}`);
                setLoading(false);
                return;
            }
            const json = (await res.json()) as Performance;
            setPerf(json);
            setError(null);
            setLoading(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setLoading(false);
        }
    }, [branchCode]);

    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            if (cancelled) return;
            await fetchPerf();
        };
        tick();
        const id = setInterval(tick, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [fetchPerf]);

    if (loading || error || !perf || perf.status === 'no_data') {
        return null;
    }

    const progressPct = Math.min(
        100,
        Math.max(0, (perf.closed_pct / perf.target_pct) * 100),
    );

    const tone =
        perf.status === 'achieved'
            ? {
                  ring: 'ring-emerald-500/30',
                  border: 'border-emerald-500/30',
                  bg: 'bg-emerald-500/10',
                  text: 'text-emerald-300',
                  textBold: 'text-emerald-200',
                  badge: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40',
                  bar: 'from-emerald-500/40 via-emerald-400 to-emerald-500/40',
                  icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
                  label: 'ผ่านเป้า',
              }
            : perf.status === 'behind'
            ? {
                  ring: 'ring-amber-500/30',
                  border: 'border-amber-500/30',
                  bg: 'bg-amber-500/10',
                  text: 'text-amber-300',
                  textBold: 'text-amber-200',
                  badge: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
                  bar: 'from-amber-500/40 via-amber-400 to-amber-500/40',
                  icon: <TrendingUp className="h-3.5 w-3.5" aria-hidden />,
                  label: 'ต่ำกว่าเป้า',
              }
            : {
                  ring: 'ring-red-500/30',
                  border: 'border-red-500/30',
                  bg: 'bg-red-500/10',
                  text: 'text-red-300',
                  textBold: 'text-red-200',
                  badge: 'bg-red-500/20 text-red-200 ring-red-500/40',
                  bar: 'from-red-500/40 via-red-400 to-red-500/40',
                  icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden />,
                  label: 'พลาดเป้า',
              };

    return (
        <>
            <section
                className={`overflow-hidden rounded-2xl border bg-slate-950/40 ring-1 ${tone.border} ${tone.ring}`}
                aria-label="Mid-day KPI gate"
            >
                <header className={`flex items-center justify-between gap-2 border-b border-slate-800/40 px-4 py-2.5 ${tone.bg}`}>
                    <div className="flex items-center gap-2">
                        <Target className={`h-4 w-4 ${tone.text}`} aria-hidden />
                        <h2 className="text-sm font-semibold text-white">
                            KPI ก่อน {perf.cutoff_hour}:00
                        </h2>
                        <span className="text-xs text-slate-500">
                            เป้า ≥ {formatPct(perf.target_pct)} ของยอดเข้าวันนี้
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.badge}`}>
                            {tone.icon}
                            {tone.label}
                        </span>
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(true)}
                            aria-label="ตั้งค่า KPI"
                            title="ตั้งค่า KPI"
                            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                        >
                            <Settings className="h-3.5 w-3.5" aria-hidden />
                        </button>
                    </div>
                </header>

                <div className="px-4 py-3">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">ยอดเข้า</p>
                            <p className="mt-0.5 font-mono text-lg font-black tabular-nums text-white">
                                {formatNumber(perf.intake_count)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">เป้า</p>
                            <p className="mt-0.5 font-mono text-lg font-black tabular-nums text-slate-300">
                                {formatNumber(perf.target_count)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">
                                ปิดแล้ว
                                {perf.delta_count >= 0 ? (
                                    <span className="ml-1 text-emerald-400">+{perf.delta_count}</span>
                                ) : (
                                    <span className="ml-1 text-red-400">{perf.delta_count}</span>
                                )}
                            </p>
                            <p className={`mt-0.5 font-mono text-lg font-black tabular-nums ${tone.textBold}`}>
                                {formatNumber(perf.closed_count)}
                                <span className={`ml-1 text-xs font-normal ${tone.text}`}>
                                    ({formatPct(perf.closed_pct)})
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Progress bar — % ของเป้า */}
                    <div className="mt-3">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${tone.bar} transition-all duration-500`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                            <span className="font-mono text-slate-500">
                                {progressPct.toFixed(0)}% ของเป้า
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-400">
                                <Clock className="h-3 w-3" aria-hidden />
                                {perf.is_after_cutoff
                                    ? `เลย ${perf.cutoff_hour}:00 มา ${formatMinutes(perf.minutes_until_cutoff)}`
                                    : `เหลือ ${formatMinutes(perf.minutes_until_cutoff)}`}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {settingsOpen ? (
                <SettingsModal
                    currentTarget={perf.target_pct}
                    currentCutoff={perf.cutoff_hour}
                    onClose={() => setSettingsOpen(false)}
                    onSaved={() => {
                        setSettingsOpen(false);
                        fetchPerf();
                    }}
                />
            ) : null}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────
// Settings modal
// ─────────────────────────────────────────────────────────────────

function SettingsModal({
    currentTarget,
    currentCutoff,
    onClose,
    onSaved,
}: {
    currentTarget: number;
    currentCutoff: number;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [targetPct, setTargetPct] = useState(currentTarget * 100); // store as % display
    const [cutoffHour, setCutoffHour] = useState(currentCutoff);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    const handleSave = async () => {
        const targetFraction = targetPct / 100;
        if (targetFraction <= 0 || targetFraction >= 1) {
            setError('เป้าต้องอยู่ระหว่าง 1% ถึง 99%');
            return;
        }
        if (cutoffHour < 0 || cutoffHour > 23 || !Number.isInteger(cutoffHour)) {
            setError('Cutoff ต้องเป็น 0–23');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/jt-warehouse/midday-config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    target_pct: targetFraction,
                    cutoff_hour: cutoffHour,
                }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                setError(typeof j.error === 'string' ? j.error : `HTTP ${res.status}`);
                setSaving(false);
                return;
            }
            onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                aria-label="ปิด"
                onClick={onClose}
            />
            <div className="relative z-[1] w-full max-w-md overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 shadow-2xl shadow-black/40 ring-1 ring-white/[0.06]">
                <header className="flex items-center justify-between gap-3 border-b border-slate-800/80 px-5 py-3">
                    <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-amber-400" aria-hidden />
                        <h2 className="text-base font-semibold text-white">ตั้งค่า KPI ก่อนเที่ยง</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                        aria-label="ปิด"
                    >
                        <X className="h-4 w-4" aria-hidden />
                    </button>
                </header>

                <div className="space-y-4 px-5 py-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400">
                            เป้า (% ของยอดเข้าวันนี้)
                        </label>
                        <div className="mt-1.5 flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={99}
                                step={1}
                                value={targetPct}
                                onChange={(e) => setTargetPct(Number(e.target.value))}
                                className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                            />
                            <span className="text-sm text-slate-400">%</span>
                            <span className="ml-auto text-xs text-slate-500">
                                ค่าปัจจุบัน: {(currentTarget * 100).toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400">
                            เวลา cutoff (ชั่วโมง — Asia/Bangkok)
                        </label>
                        <div className="mt-1.5 flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                max={23}
                                step={1}
                                value={cutoffHour}
                                onChange={(e) => setCutoffHour(Number(e.target.value))}
                                className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                            />
                            <span className="text-sm text-slate-400">นาฬิกา (24h)</span>
                            <span className="ml-auto text-xs text-slate-500">
                                ค่าปัจจุบัน: {currentCutoff}:00
                            </span>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-600">เช่น 12 = เที่ยง, 11 = 11 โมงเช้า</p>
                    </div>

                    {error ? (
                        <p className="rounded-md bg-red-950/40 px-3 py-2 text-xs text-red-200">{error}</p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-amber-950/40 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                                <Save className="h-4 w-4" aria-hidden />
                            )}
                            บันทึก
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 disabled:opacity-40"
                        >
                            ยกเลิก
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
