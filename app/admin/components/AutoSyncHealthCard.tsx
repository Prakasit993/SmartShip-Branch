'use client';

import { useEffect, useState } from 'react';
import {
    Bot,
    CheckCircle2,
    AlertCircle,
    Clock,
    RefreshCw,
    Loader2,
} from 'lucide-react';
import { JOB_KIND_ICON, JOB_KIND_LABEL, type JobKind } from '@/lib/uploadJobs';

/**
 * AutoSyncHealthCard — แสดงสถานะ auto-sync 1 portal (kind ที่กำหนด)
 *
 * Phase A3 — Fetch /api/admin/auto-sync/health ทุก 30 วินาที
 * Filter เฉพาะ kind ที่ระบุใน props
 */

type HealthItem = {
    kind: JobKind;
    schedule_label: string | null;
    expected_interval_min: number | null;
    last_started_at: string | null;
    last_finished_at: string | null;
    last_status: string | null;
    last_affected_rows: number | null;
    last_error: string | null;
    last_request_id: string | null;
    success_count_today: number;
    error_count_today: number;
    minutes_since_last: number | null;
    is_stale: boolean;
    in_working_hours: boolean;
};

const POLL_INTERVAL_MS = 30_000;

function formatMinutesAgo(min: number | null): string {
    if (min === null) return 'ยังไม่เคย sync';
    if (min < 1) return 'เพิ่งทำ';
    if (min < 60) return `${min} นาทีที่แล้ว`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
    const days = Math.floor(hrs / 24);
    return `${days} วันที่แล้ว`;
}

function formatNumber(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString('th-TH');
}

type Props = {
    kind: JobKind;
};

export function AutoSyncHealthCard({ kind }: Props) {
    const [item, setItem] = useState<HealthItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchHealth = async () => {
            try {
                const res = await fetch('/api/admin/auto-sync/health', {
                    credentials: 'include',
                    cache: 'no-store',
                });
                if (cancelled) return;
                if (!res.ok) {
                    setError(`HTTP ${res.status}`);
                    setLoading(false);
                    return;
                }
                const json = (await res.json()) as { items: HealthItem[] };
                if (cancelled) return;
                const found = json.items.find((i) => i.kind === kind) ?? null;
                setItem(found);
                setError(null);
                setLoading(false);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : String(e));
                setLoading(false);
            }
        };

        fetchHealth();
        const id = setInterval(fetchHealth, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [kind]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                กำลังโหลด auto-sync status…
            </div>
        );
    }

    if (error || !item) {
        return (
            <div className="flex items-start gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-xs text-slate-500">
                <Bot className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                <div>
                    <p className="font-medium text-slate-400">Auto-sync ยังไม่ตั้งค่า</p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                        ใช้ปุ่ม "อัปโหลด" ด้านบนเพื่อนำเข้าด้วยตนเอง
                    </p>
                </div>
            </div>
        );
    }

    const showStale = item.is_stale && item.in_working_hours;
    const showError = item.last_status === 'error' && !showStale;

    const statusBadge: { icon: React.ReactNode; label: string; tone: 'ok' | 'warn' | 'error' } = showStale
        ? {
              icon: <Clock className="h-3.5 w-3.5" aria-hidden />,
              label: 'ข้อมูลค้าง',
              tone: 'warn',
          }
        : showError
        ? {
              icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden />,
              label: 'รอบล่าสุดผิดพลาด',
              tone: 'error',
          }
        : item.last_status === 'success'
        ? {
              icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
              label: 'ทำงานปกติ',
              tone: 'ok',
          }
        : {
              icon: <Clock className="h-3.5 w-3.5" aria-hidden />,
              label: 'รอรอบแรก',
              tone: 'warn',
          };

    const toneClass =
        statusBadge.tone === 'ok'
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
            : statusBadge.tone === 'warn'
            ? 'bg-amber-500/15 text-amber-300 ring-amber-500/30'
            : 'bg-red-500/15 text-red-300 ring-red-500/30';

    const cardBorderClass = showStale
        ? 'border-amber-500/40 ring-1 ring-amber-500/20'
        : showError
        ? 'border-red-500/40 ring-1 ring-red-500/20'
        : 'border-slate-800/70';

    return (
        <section
            className={`overflow-hidden rounded-2xl border bg-slate-950/40 ${cardBorderClass}`}
            aria-label={`Auto-sync ${JOB_KIND_LABEL[kind]}`}
        >
            <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900/80 text-lg ring-1 ring-slate-700/60">
                    {JOB_KIND_ICON[kind]}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            <Bot className="mr-1 inline h-3 w-3" aria-hidden />
                            Auto-Sync
                        </p>
                        <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${toneClass}`}
                        >
                            {statusBadge.icon}
                            {statusBadge.label}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-100">
                        ล่าสุด:{' '}
                        <span className={`font-medium ${item.is_stale ? 'text-amber-300' : 'text-emerald-300'}`}>
                            {formatMinutesAgo(item.minutes_since_last)}
                        </span>
                        {item.last_status === 'success' && item.last_affected_rows !== null ? (
                            <span className="text-slate-500">
                                {' · '}
                                <span className="font-mono font-semibold text-slate-300">
                                    {formatNumber(item.last_affected_rows)}
                                </span>{' '}
                                รายการ
                            </span>
                        ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                        {item.schedule_label ?? '—'}
                        <span className="mx-1.5">·</span>
                        วันนี้: {item.success_count_today} success / {item.error_count_today} error
                    </p>
                    {item.last_error && (showStale || showError) ? (
                        <p className="mt-1.5 line-clamp-2 rounded-md bg-red-950/40 px-2 py-1 text-[10.5px] text-red-200/90">
                            {item.last_error}
                        </p>
                    ) : null}
                </div>
                <RefreshCw className="h-3 w-3 shrink-0 text-slate-700" aria-hidden />
            </div>
        </section>
    );
}
