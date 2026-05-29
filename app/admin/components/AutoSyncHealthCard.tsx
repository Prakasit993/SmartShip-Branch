'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Bot,
    CheckCircle2,
    AlertCircle,
    Clock,
    Loader2,
} from 'lucide-react';
import { JOB_KIND_ICON, JOB_KIND_LABEL, type JobKind } from '@/lib/uploadJobs';
import { CollapsibleSection } from './CollapsibleSection';

/**
 * AutoSyncHealthCard — Phase A3 + collapsible
 *
 * Fetch /api/admin/auto-sync/health ทุก 30s
 * แสดงสถานะของ kind ที่ระบุ
 * Default collapsed = true เมื่อ status='success' (ทำงานปกติ)
 *                    false เมื่อ stale/error
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

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/auto-sync/health', {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) {
                setError(`HTTP ${res.status}`);
                setLoading(false);
                return;
            }
            const json = (await res.json()) as { items: HealthItem[] };
            const found = json.items.find((i) => i.kind === kind) ?? null;
            setItem(found);
            setError(null);
            setLoading(false);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
            setLoading(false);
        }
    }, [kind]);

    useEffect(() => {
        let cancelled = false;
        const tick = async () => {
            if (cancelled) return;
            await fetchHealth();
        };
        tick();
        const id = setInterval(tick, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [fetchHealth]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                กำลังโหลด auto-sync status…
            </div>
        );
    }

    if (error || !item) {
        return null; // ไม่แสดงถ้าไม่มีข้อมูล (auto-sync ยังไม่ตั้งค่า)
    }

    const showStale = item.is_stale && item.in_working_hours;
    const showError = item.last_status === 'error' && !showStale;
    const isOk =
        !showStale && !showError && item.last_status === 'success';

    const status = showStale
        ? { label: 'ข้อมูลค้าง', badgeClass: 'bg-amber-500/20 text-amber-200 ring-amber-500/40', borderClass: 'border-amber-500/40' }
        : showError
        ? { label: 'รอบล่าสุดผิดพลาด', badgeClass: 'bg-red-500/20 text-red-200 ring-red-500/40', borderClass: 'border-red-500/40' }
        : isOk
        ? { label: 'ทำงานปกติ', badgeClass: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40', borderClass: 'border-slate-800/70' }
        : { label: 'รอรอบแรก', badgeClass: 'bg-amber-500/20 text-amber-200 ring-amber-500/40', borderClass: 'border-slate-800/70' };

    const statusIcon = showStale ? (
        <Clock className="h-3 w-3" aria-hidden />
    ) : showError ? (
        <AlertCircle className="h-3 w-3" aria-hidden />
    ) : isOk ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
    ) : (
        <Clock className="h-3 w-3" aria-hidden />
    );

    return (
        <CollapsibleSection
            id={`auto-sync-${kind}`}
            defaultCollapsed={isOk}
            icon={<Bot className="h-4 w-4 text-amber-400" aria-hidden />}
            title={`Auto-Sync ${JOB_KIND_LABEL[kind]}`}
            badge={
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${status.badgeClass}`}>
                    {statusIcon}
                    {status.label}
                </span>
            }
            summary={
                <>
                    <span className={isOk ? 'text-emerald-300' : 'text-amber-300'}>
                        {formatMinutesAgo(item.minutes_since_last)}
                    </span>
                    {item.last_affected_rows !== null && isOk ? (
                        <>
                            <span className="mx-1 text-slate-600">·</span>
                            <span className="font-mono text-slate-300">
                                {formatNumber(item.last_affected_rows)} รายการ
                            </span>
                        </>
                    ) : null}
                </>
            }
            accentBorderClass={status.borderClass}
        >
            <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900/80 text-lg ring-1 ring-slate-700/60" aria-hidden>
                    {JOB_KIND_ICON[kind]}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm text-slate-100">
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
                    <p className="text-[11px] text-slate-500">
                        {item.schedule_label ?? '—'}
                        <span className="mx-1.5">·</span>
                        วันนี้: {item.success_count_today} success / {item.error_count_today} error
                    </p>
                    {item.last_error && (showStale || showError) ? (
                        <p className="line-clamp-2 rounded-md bg-red-950/40 px-2 py-1 text-[10.5px] text-red-200/90">
                            {item.last_error}
                        </p>
                    ) : null}
                </div>
            </div>
        </CollapsibleSection>
    );
}
