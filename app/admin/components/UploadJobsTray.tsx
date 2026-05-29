'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown, Cloud } from 'lucide-react';
import { useUploadJobs, type UploadJob } from '@app/admin/context/UploadJobsContext';
import { JOB_KIND_LABEL, JOB_KIND_ICON } from '@/lib/uploadJobs';

/**
 * UploadJobsTray — floating tray มุมขวาล่างของ admin layout
 *
 * โชว์เฉพาะตอนมี jobs (active หรือ finished ที่ยังไม่ auto-dismiss)
 * Default: collapsed (แสดงแค่ badge + summary)
 * Click → expand → list jobs พร้อม progress + dismiss buttons
 */

function formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s.toString().padStart(2, '0')}`;
}

function statusTone(status: UploadJob['status']): {
    icon: React.ReactNode;
    text: string;
    textClass: string;
    ringClass: string;
} {
    switch (status) {
        case 'uploading':
            return {
                icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />,
                text: 'กำลังส่ง…',
                textClass: 'text-slate-300',
                ringClass: 'ring-slate-700',
            };
        case 'processing':
            return {
                icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />,
                text: 'ประมวลผล',
                textClass: 'text-amber-300',
                ringClass: 'ring-amber-500/40',
            };
        case 'success':
            return {
                icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
                text: 'สำเร็จ',
                textClass: 'text-emerald-300',
                ringClass: 'ring-emerald-500/40',
            };
        case 'error':
            return {
                icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden />,
                text: 'ผิดพลาด',
                textClass: 'text-red-300',
                ringClass: 'ring-red-500/40',
            };
        case 'timeout':
            return {
                icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden />,
                text: 'หมดเวลา',
                textClass: 'text-red-300',
                ringClass: 'ring-red-500/40',
            };
    }
}

export default function UploadJobsTray() {
    const { jobs, activeCount, dismissJob, clearFinished } = useUploadJobs();
    const [expanded, setExpanded] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    // Live timer (1s) เพื่อ update duration บน UI
    useEffect(() => {
        if (jobs.length === 0) return;
        const id = setInterval(() => setNow(Date.now()), 1_000);
        return () => clearInterval(id);
    }, [jobs.length]);

    // ขยาย tray อัตโนมัติเมื่อมี job ใหม่เริ่ม
    useEffect(() => {
        if (activeCount > 0) setExpanded(true);
    }, [activeCount]);

    if (jobs.length === 0) return null;

    return (
        <div
            className="fixed bottom-4 right-4 z-[150] w-[min(360px,calc(100vw-2rem))]"
            role="region"
            aria-label="สถานะการอัปโหลด"
        >
            <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/95 shadow-2xl shadow-black/40 ring-1 ring-white/[0.05] backdrop-blur-md">
                {/* Header — toggle expand */}
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-2.5 text-left transition hover:bg-slate-900/60"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Cloud className="h-4 w-4 text-amber-400" aria-hidden />
                        <p className="text-sm font-semibold text-white">
                            งานอัปโหลด{' '}
                            <span className="font-normal text-slate-400">({jobs.length})</span>
                        </p>
                        {activeCount > 0 ? (
                            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden />
                        ) : null}
                    </div>
                    {expanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
                    ) : (
                        <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
                    )}
                </button>

                {expanded ? (
                    <>
                        <ul className="max-h-[60vh] divide-y divide-slate-800/60 overflow-y-auto">
                            {jobs.map((job) => {
                                const tone = statusTone(job.status);
                                const elapsedMs =
                                    (job.finishedAt ?? now) - job.startedAt;
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
                                        className={`flex gap-3 px-3 py-2.5 ring-1 ring-inset ${tone.ringClass}/40`}
                                    >
                                        <div className="text-lg leading-none" aria-hidden>
                                            {JOB_KIND_ICON[job.kind]}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                    {JOB_KIND_LABEL[job.kind]}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-600">
                                                    {formatDuration(elapsedMs)}
                                                </span>
                                            </div>
                                            <p className="truncate text-xs font-medium text-slate-200" title={job.fileName}>
                                                {job.fileName}
                                            </p>
                                            <div className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${tone.textClass}`}>
                                                {tone.icon}
                                                <span>{tone.text}</span>
                                                {affected !== null && job.status === 'success' ? (
                                                    <span className="ml-1 font-mono">
                                                        · {affected.toLocaleString('th-TH')} รายการ
                                                    </span>
                                                ) : null}
                                            </div>
                                            {job.status === 'error' || job.status === 'timeout' ? (
                                                <p className="mt-1 line-clamp-2 text-[10px] text-red-200/80">
                                                    {job.error || 'unknown error'}
                                                </p>
                                            ) : null}
                                        </div>
                                        {canDismiss ? (
                                            <button
                                                type="button"
                                                onClick={() => dismissJob(job.requestId)}
                                                aria-label="ปิด"
                                                className="shrink-0 self-start rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                                            >
                                                <X className="h-3.5 w-3.5" aria-hidden />
                                            </button>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                        {jobs.some((j) => j.status === 'success' || j.status === 'error' || j.status === 'timeout') ? (
                            <button
                                type="button"
                                onClick={clearFinished}
                                className="w-full border-t border-slate-800/60 py-2 text-center text-[11px] font-medium text-slate-500 transition hover:bg-slate-900/40 hover:text-slate-200"
                            >
                                ล้างที่เสร็จแล้ว
                            </button>
                        ) : null}
                    </>
                ) : null}
            </div>
        </div>
    );
}
