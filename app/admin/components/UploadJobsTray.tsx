'use client';

import { useEffect, useState } from 'react';
import {
    Loader2,
    CheckCircle2,
    AlertCircle,
    X,
    ChevronUp,
    ChevronDown,
    Cloud,
    Trash2,
    FileSpreadsheet,
} from 'lucide-react';
import { useUploadJobs, type UploadJob } from '@app/admin/context/UploadJobsContext';
import { JOB_KIND_LABEL, JOB_KIND_ICON, type JobKind } from '@/lib/uploadJobs';

/**
 * UploadJobsTray — floating tray มุมขวาล่างของ admin layout
 *
 * Phase 3.7 polish — gradient header, icon tiles, smooth animations,
 * pill status badges, progress indicator for processing jobs
 */

function formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s.toString().padStart(2, '0')}`;
}

// สีตาม kind สำหรับ icon container
function kindAccent(kind: JobKind): { bg: string; ring: string; text: string } {
    switch (kind) {
        case 'jt_parcel':
            return {
                bg: 'bg-orange-500/15',
                ring: 'ring-orange-500/30',
                text: 'text-orange-300',
            };
        case 'jt_shipment':
            return {
                bg: 'bg-sky-500/15',
                ring: 'ring-sky-500/30',
                text: 'text-sky-300',
            };
        case 'tiktok':
            return {
                bg: 'bg-emerald-500/15',
                ring: 'ring-emerald-500/30',
                text: 'text-emerald-300',
            };
    }
}

type StatusVisual = {
    icon: React.ReactNode;
    label: string;
    badgeClass: string;        // pill background + text
    leftStripClass: string;    // colored vertical strip ที่ขอบซ้ายของ tile
    showProgress: boolean;
};

function statusVisual(status: UploadJob['status']): StatusVisual {
    switch (status) {
        case 'uploading':
            return {
                icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden />,
                label: 'กำลังส่ง',
                badgeClass: 'bg-slate-700/80 text-slate-200 ring-slate-600/50',
                leftStripClass: 'bg-slate-500',
                showProgress: true,
            };
        case 'processing':
            return {
                icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden />,
                label: 'ประมวลผล',
                badgeClass: 'bg-amber-500/20 text-amber-200 ring-amber-500/40',
                leftStripClass: 'bg-amber-400',
                showProgress: true,
            };
        case 'success':
            return {
                icon: <CheckCircle2 className="h-3 w-3" aria-hidden />,
                label: 'สำเร็จ',
                badgeClass: 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/40',
                leftStripClass: 'bg-emerald-400',
                showProgress: false,
            };
        case 'error':
            return {
                icon: <AlertCircle className="h-3 w-3" aria-hidden />,
                label: 'ผิดพลาด',
                badgeClass: 'bg-red-500/20 text-red-200 ring-red-500/40',
                leftStripClass: 'bg-red-400',
                showProgress: false,
            };
        case 'timeout':
            return {
                icon: <AlertCircle className="h-3 w-3" aria-hidden />,
                label: 'หมดเวลา',
                badgeClass: 'bg-red-500/20 text-red-200 ring-red-500/40',
                leftStripClass: 'bg-red-400',
                showProgress: false,
            };
    }
}

export default function UploadJobsTray() {
    const { jobs, activeCount, dismissJob, clearFinished } = useUploadJobs();
    const [expanded, setExpanded] = useState(true);
    const [now, setNow] = useState(() => Date.now());

    // Live timer (1s) — update duration ตอนมี job active
    useEffect(() => {
        if (jobs.length === 0) return;
        const id = setInterval(() => setNow(Date.now()), 1_000);
        return () => clearInterval(id);
    }, [jobs.length]);

    // Auto-expand เมื่อมี job ใหม่เริ่ม
    useEffect(() => {
        if (activeCount > 0) setExpanded(true);
    }, [activeCount]);

    if (jobs.length === 0) return null;

    const finishedCount = jobs.filter(
        (j) => j.status === 'success' || j.status === 'error' || j.status === 'timeout',
    ).length;

    return (
        <div
            className="pointer-events-none fixed bottom-4 right-4 z-[150] w-[min(380px,calc(100vw-2rem))]"
            role="region"
            aria-label="สถานะการอัปโหลด"
        >
            <div className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/95 shadow-2xl shadow-black/60 ring-1 ring-white/[0.05] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Header — gradient + larger */}
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="group flex w-full items-center justify-between gap-3 border-b border-slate-800/80 bg-gradient-to-r from-amber-500/10 via-orange-500/[0.07] to-transparent px-4 py-3 text-left transition hover:from-amber-500/15 hover:via-orange-500/10"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30">
                            <Cloud className="h-4 w-4" aria-hidden />
                            {activeCount > 0 ? (
                                <span
                                    className="absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400 ring-2 ring-slate-950"
                                    aria-hidden
                                />
                            ) : null}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white">งานอัปโหลด</p>
                            <p className="text-[11px] text-slate-400">
                                {activeCount > 0 ? (
                                    <span className="text-amber-300">
                                        {activeCount} กำลังทำงาน
                                    </span>
                                ) : (
                                    <span>เสร็จแล้ว {finishedCount}</span>
                                )}
                                <span className="mx-1 text-slate-600">·</span>
                                <span className="text-slate-500">รวม {jobs.length}</span>
                            </p>
                        </div>
                    </div>
                    <div className="shrink-0 rounded-lg p-1 text-slate-400 transition group-hover:bg-slate-800/60 group-hover:text-white">
                        {expanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                        ) : (
                            <ChevronUp className="h-4 w-4" aria-hidden />
                        )}
                    </div>
                </button>

                {expanded ? (
                    <>
                        <ul className="max-h-[60vh] divide-y divide-slate-800/40 overflow-y-auto">
                            {jobs.map((job) => {
                                const v = statusVisual(job.status);
                                const accent = kindAccent(job.kind);
                                const elapsedMs = (job.finishedAt ?? now) - job.startedAt;
                                const affected =
                                    job.stats && typeof job.stats.affected_rows === 'number'
                                        ? (job.stats.affected_rows as number)
                                        : null;
                                const canDismiss =
                                    job.status === 'success' ||
                                    job.status === 'error' ||
                                    job.status === 'timeout';
                                return (
                                    <li
                                        key={job.requestId}
                                        className="group relative animate-in fade-in slide-in-from-right-2 duration-200"
                                    >
                                        {/* Left vertical strip ตามสถานะ */}
                                        <div
                                            className={`absolute left-0 top-0 h-full w-0.5 ${v.leftStripClass}`}
                                            aria-hidden
                                        />

                                        <div className="flex gap-3 px-4 py-3 pl-5">
                                            {/* Icon container */}
                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ring-1 ${accent.bg} ${accent.ring}`}
                                                aria-hidden
                                            >
                                                {JOB_KIND_ICON[job.kind]}
                                            </div>

                                            {/* Body */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p
                                                        className={`truncate text-[11px] font-semibold uppercase tracking-wider ${accent.text}`}
                                                    >
                                                        {JOB_KIND_LABEL[job.kind]}
                                                    </p>
                                                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                                                        {formatDuration(elapsedMs)}
                                                    </span>
                                                </div>
                                                <div className="mt-0.5 flex items-center gap-2">
                                                    <FileSpreadsheet
                                                        className="h-3.5 w-3.5 shrink-0 text-slate-500"
                                                        aria-hidden
                                                    />
                                                    <p
                                                        className="truncate text-sm font-medium text-slate-100"
                                                        title={job.fileName}
                                                    >
                                                        {job.fileName}
                                                    </p>
                                                </div>

                                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${v.badgeClass}`}
                                                    >
                                                        {v.icon}
                                                        {v.label}
                                                    </span>
                                                    {affected !== null && job.status === 'success' ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                                                            <span className="text-slate-600">·</span>
                                                            <span className="font-mono font-bold text-emerald-300">
                                                                {affected.toLocaleString('th-TH')}
                                                            </span>
                                                            <span className="text-slate-500">รายการ</span>
                                                        </span>
                                                    ) : null}
                                                </div>

                                                {/* Error message */}
                                                {(job.status === 'error' || job.status === 'timeout') &&
                                                job.error ? (
                                                    <p className="mt-1.5 line-clamp-2 rounded-md bg-red-950/40 px-2 py-1 text-[10.5px] leading-relaxed text-red-200/90">
                                                        {job.error}
                                                    </p>
                                                ) : null}

                                                {/* Progress bar (uploading / processing) */}
                                                {v.showProgress ? (
                                                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-800/80">
                                                        <div
                                                            className={`h-full w-full animate-pulse rounded-full ${
                                                                job.status === 'processing'
                                                                    ? 'bg-gradient-to-r from-amber-500/30 via-amber-400 to-amber-500/30'
                                                                    : 'bg-gradient-to-r from-slate-700 via-slate-400 to-slate-700'
                                                            }`}
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>

                                            {/* Dismiss button */}
                                            {canDismiss ? (
                                                <button
                                                    type="button"
                                                    onClick={() => dismissJob(job.requestId)}
                                                    aria-label="ปิด"
                                                    className="shrink-0 self-start rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                                                >
                                                    <X className="h-3.5 w-3.5" aria-hidden />
                                                </button>
                                            ) : (
                                                <div className="h-5 w-5 shrink-0" aria-hidden />
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        {finishedCount > 0 ? (
                            <button
                                type="button"
                                onClick={clearFinished}
                                className="flex w-full items-center justify-center gap-1.5 border-t border-slate-800/60 bg-slate-900/40 py-2 text-[11px] font-medium text-slate-400 transition hover:bg-slate-900/80 hover:text-slate-100"
                            >
                                <Trash2 className="h-3 w-3" aria-hidden />
                                ล้างที่เสร็จแล้ว ({finishedCount})
                            </button>
                        ) : null}
                    </>
                ) : null}
            </div>
        </div>
    );
}
