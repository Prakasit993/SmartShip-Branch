'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    FileSpreadsheet,
    Loader2,
    Upload,
    CheckCircle2,
    AlertCircle,
    X,
    MinusCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@app/admin/context/ToastContext';

// State ของหน้าจอ (UI-level)
type ScreenState = 'idle' | 'uploading' | 'tracking' | 'success' | 'error';

// State ของ background job
type JobInfo = {
    requestId: string;
    fileName: string;
    startedAt: number;
};

// Response จาก /api/admin/jt-warehouse/upload-jobs
type JobPollResponse = {
    job: {
        id: string;
        request_id: string;
        status: 'processing' | 'success' | 'error' | 'timeout';
        file_name: string | null;
        started_at: string;
        finished_at: string | null;
        stats: Record<string, unknown> | null;
        error: string | null;
    } | null;
};

const ACCEPT =
    '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// timeout — ถ้า n8n ไม่ callback ใน 5 นาที = เสมือนพัง
const JOB_TIMEOUT_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 2_000;

function getMaxFileMb(): number {
    const raw = process.env.NEXT_PUBLIC_N8N_UPLOAD_MAX_FILE_MB?.trim();
    if (!raw) return 4.5;
    const n = Number.parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 4.5;
}

function formatDuration(ms: number): string {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec} วินาที`;
    const min = Math.floor(sec / 60);
    const s = sec % 60;
    return `${min}:${s.toString().padStart(2, '0')} นาที`;
}

type Props = {
    onUploadSuccess?: () => void;
};

export function JtParcelN8nUpload({ onUploadSuccess }: Props) {
    const router = useRouter();
    const { showSuccess, showError, showInfo } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);

    const [modalOpen, setModalOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState('');

    const [screen, setScreen] = useState<ScreenState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [errorDetail, setErrorDetail] = useState<string | null>(null);

    const [activeJob, setActiveJob] = useState<JobInfo | null>(null);
    const [jobStats, setJobStats] = useState<Record<string, unknown> | null>(null);
    const [now, setNow] = useState(() => Date.now());

    // ESC close
    useEffect(() => {
        if (!modalOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modalOpen]);

    // Lock scroll
    useEffect(() => {
        if (!modalOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [modalOpen]);

    // Live duration counter (ทำงานเฉพาะตอน tracking)
    useEffect(() => {
        if (screen !== 'tracking') return;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [screen]);

    // Polling loop — ทำงานเฉพาะตอนมี activeJob และ screen='tracking'
    useEffect(() => {
        if (!activeJob || screen !== 'tracking') return;

        let cancelled = false;
        let pollTimer: ReturnType<typeof setTimeout> | null = null;

        const tick = async () => {
            if (cancelled) return;

            try {
                const res = await fetch(
                    `/api/admin/jt-warehouse/upload-jobs?request_id=${encodeURIComponent(activeJob.requestId)}`,
                    { credentials: 'include', cache: 'no-store' },
                );
                if (cancelled) return;

                const json = (await res.json()) as JobPollResponse;
                if (cancelled) return;

                const job = json.job;

                // Timeout check (ในกรณี n8n เงียบ)
                if (Date.now() - activeJob.startedAt > JOB_TIMEOUT_MS) {
                    finishJob('error', null, 'ไม่ได้รับการตอบกลับจากระบบใน 5 นาที — ตรวจสอบ n8n');
                    return;
                }

                if (job && job.status === 'success') {
                    finishJob('success', job.stats, null);
                    return;
                }
                if (job && job.status === 'error') {
                    finishJob('error', job.stats, job.error || 'ระบบแจ้งข้อผิดพลาด');
                    return;
                }

                // Continue polling
                pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
            } catch (e) {
                // network error — retry ต่อจนกว่าจะ timeout
                pollTimer = setTimeout(tick, POLL_INTERVAL_MS);
            }
        };

        tick();

        return () => {
            cancelled = true;
            if (pollTimer) clearTimeout(pollTimer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeJob, screen]);

    const finishJob = useCallback(
        (
            outcome: 'success' | 'error',
            stats: Record<string, unknown> | null,
            error: string | null,
        ) => {
            setJobStats(stats);

            const affected = stats && typeof stats.affected_rows === 'number' ? stats.affected_rows : null;
            const durationMs = activeJob ? Date.now() - activeJob.startedAt : 0;

            if (outcome === 'success') {
                setScreen('success');
                setErrorMessage(null);
                setErrorDetail(null);

                // Toast เด้ง (เห็นทั้งกรณี modal เปิด/ปิด)
                const msg = affected !== null
                    ? `นำเข้าสำเร็จ ${affected.toLocaleString('th-TH')} พัสดุ (${formatDuration(durationMs)})`
                    : `อัปโหลดสำเร็จ (${formatDuration(durationMs)})`;
                if (!modalOpen) showSuccess(msg);

                // Auto refresh page เพื่อโชว์ข้อมูลใหม่
                router.refresh();
                onUploadSuccess?.();
            } else {
                setScreen('error');
                setErrorMessage('นำเข้าไม่สำเร็จ');
                setErrorDetail(error || 'unknown error');
                if (!modalOpen) showError(`อัปโหลดไม่สำเร็จ: ${error || 'unknown error'}`);
            }
        },
        [activeJob, modalOpen, onUploadSuccess, router, showError, showSuccess],
    );

    const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) { resetState(); return; }
        setFile(f);
        setDisplayName(f.name);
        setScreen('idle');
        setErrorMessage(null);
        setErrorDetail(null);
    }, []);

    const resetState = useCallback(() => {
        setFile(null);
        setDisplayName('');
        setScreen('idle');
        setErrorMessage(null);
        setErrorDetail(null);
        setActiveJob(null);
        setJobStats(null);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    const submit = async () => {
        if (!file) return;

        const maxMb = getMaxFileMb();
        if (file.size > maxMb * 1024 * 1024) {
            setScreen('error');
            setErrorMessage('ไฟล์ใหญ่เกินขีดจำกัด');
            setErrorDetail(`ไฟล์นี้มีขนาดเกิน ${maxMb} MB — ลองแยกหรือลดขนาดไฟล์แล้วส่งใหม่`);
            return;
        }

        setScreen('uploading');
        setErrorMessage(null);
        setErrorDetail(null);
        setJobStats(null);

        const fd = new FormData();
        fd.append('file', file);
        const url = `/api/admin/jt-parcel-n8n-upload?filename=${encodeURIComponent(file.name)}`;

        try {
            const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' });
            const text = await res.text();
            let parsed: unknown;
            try { parsed = JSON.parse(text); } catch { parsed = text; }

            if (!res.ok) {
                const errMsg =
                    typeof parsed === 'object' && parsed !== null && 'error' in parsed
                        ? String((parsed as { error: string }).error)
                        : text.slice(0, 500);
                setScreen('error');
                setErrorMessage(res.status === 413 ? 'ไฟล์ใหญ่เกินขีดจำกัด' : 'ส่งไฟล์ไม่สำเร็จ');
                setErrorDetail(errMsg);
                return;
            }

            // POST สำเร็จ — รับ request_id + status='processing'
            if (typeof parsed !== 'object' || parsed === null) {
                setScreen('error');
                setErrorMessage('ตอบกลับจาก server ไม่ถูกต้อง');
                setErrorDetail(typeof parsed === 'string' ? parsed.slice(0, 500) : 'invalid response');
                return;
            }

            const payload = parsed as Record<string, unknown>;
            const requestId = typeof payload.request_id === 'string' ? payload.request_id : null;

            if (!requestId) {
                setScreen('error');
                setErrorMessage('ไม่พบ request_id ใน response');
                return;
            }

            // เปลี่ยนไปโหมด tracking → polling เริ่มทันทีจาก useEffect
            const now = Date.now();
            setActiveJob({ requestId, fileName: file.name, startedAt: now });
            setNow(now);
            setScreen('tracking');
        } catch (e) {
            setScreen('error');
            setErrorMessage('เชื่อมต่อไม่สำเร็จ — ลองใหม่อีกครั้ง');
            setErrorDetail(e instanceof Error ? e.message : String(e));
        }
    };

    const closeAndContinue = () => {
        // ปิด modal แต่ component ยัง mounted → polling ทำงานต่อ → toast เด้งเมื่อจบ
        setModalOpen(false);
        showInfo('ระบบจะแจ้งเตือนเมื่อประมวลผลเสร็จ');
    };

    const elapsedMs = activeJob ? now - activeJob.startedAt : 0;
    const affectedRows =
        jobStats && typeof jobStats.affected_rows === 'number' ? (jobStats.affected_rows as number) : null;

    return (
        <>
            <button
                type="button"
                onClick={() => setModalOpen(true)}
                title="อัปโหลดข้อมูลคลังพัสดุ J&T"
                aria-label="อัปโหลดข้อมูลคลังพัสดุ J&T"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25 transition hover:bg-orange-500/25 hover:ring-orange-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
            >
                <FileSpreadsheet className="h-5 w-5" aria-hidden />
                {screen === 'tracking' ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-3 w-3 animate-pulse rounded-full bg-amber-400 ring-2 ring-slate-900" aria-hidden />
                ) : null}
            </button>

            {modalOpen ? (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="jt-parcel-upload-modal-title">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                        aria-label="ปิด"
                        onClick={() => setModalOpen(false)}
                    />
                    <div className="relative z-[1] flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 shadow-2xl shadow-black/40 ring-1 ring-white/[0.06]">
                        {/* Header */}
                        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3 sm:px-5">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25">
                                    <FileSpreadsheet className="h-5 w-5" aria-hidden />
                                </div>
                                <div className="min-w-0">
                                    <h2 id="jt-parcel-upload-modal-title" className="text-base font-semibold text-white">
                                        อัปโหลดข้อมูลคลังพัสดุ J&amp;T
                                    </h2>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                        เลือกไฟล์ Excel หรือ CSV แล้วกดส่ง — ระบบจะประมวลผลและบันทึกข้อมูล
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                                aria-label="ปิดหน้าต่าง"
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                            {screen === 'idle' || screen === 'uploading' ? (
                                <>
                                    <p className="text-xs leading-relaxed text-slate-400">
                                        การเชื่อมต่อกับระบบนำเข้ากำหนดไว้ที่เซิร์ฟเวอร์แล้ว — ไม่ต้องวางลิงก์หรือรหัสลับในหน้านี้
                                    </p>

                                    <div className="flex flex-col gap-3">
                                        <span className="block text-xs font-medium text-slate-400">ไฟล์ที่จะนำเข้า</span>
                                        <div className="flex min-h-[42px] flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 hover:border-slate-600">
                                            <input
                                                ref={inputRef}
                                                type="file"
                                                accept={ACCEPT}
                                                onChange={onFileChange}
                                                disabled={screen === 'uploading'}
                                                className="sr-only"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => inputRef.current?.click()}
                                                disabled={screen === 'uploading'}
                                                className="shrink-0 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                เลือกไฟล์…
                                            </button>
                                            <span
                                                className={`min-w-0 flex-1 truncate text-sm ${displayName ? 'text-slate-200' : 'text-slate-500'}`}
                                                title={displayName || undefined}
                                            >
                                                {displayName || 'ยังไม่ได้เลือกไฟล์'}
                                            </span>
                                        </div>
                                    </div>

                                    {!displayName ? (
                                        <p className="text-xs text-slate-500">รองรับไฟล์ .xlsx, .xls, .csv</p>
                                    ) : null}

                                    {screen === 'uploading' && (
                                        <div className="space-y-2" role="status" aria-live="polite">
                                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                                <Loader2 className="h-4 w-4 animate-spin text-orange-400" aria-hidden />
                                                <span>กำลังส่งไฟล์เข้าระบบ…</span>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                                <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-slate-800 via-orange-500/90 to-slate-800" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={submit}
                                            disabled={!file || screen === 'uploading'}
                                            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-950/40 transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {screen === 'uploading' ? (
                                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                            ) : (
                                                <Upload className="h-4 w-4" aria-hidden />
                                            )}
                                            ส่งไฟล์เพื่อนำเข้า
                                        </button>
                                        {file ? (
                                            <button
                                                type="button"
                                                onClick={resetState}
                                                disabled={screen === 'uploading'}
                                                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 disabled:opacity-40"
                                            >
                                                ล้างและเลือกใหม่
                                            </button>
                                        ) : null}
                                    </div>
                                </>
                            ) : null}

                            {/* Tracking — โชว์สถานะ + duration */}
                            {screen === 'tracking' && activeJob ? (
                                <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                                    <div className="flex items-start gap-3">
                                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-400" aria-hidden />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-amber-200">กำลังประมวลผลในระบบ…</p>
                                            <p className="mt-1 text-xs text-slate-400">
                                                {activeJob.fileName} • เริ่มมา {formatDuration(elapsedMs)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                        <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-slate-800 via-amber-500/80 to-slate-800" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeAndContinue}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                                    >
                                        <MinusCircle className="h-3.5 w-3.5" aria-hidden />
                                        ปิดและทำงานต่อในเบื้องหลัง
                                    </button>
                                </div>
                            ) : null}

                            {/* Success */}
                            {screen === 'success' ? (
                                <div className="flex gap-3 rounded-xl border border-emerald-800/60 bg-emerald-950/35 px-3 py-3 text-sm text-emerald-200">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <p className="font-semibold text-white">นำเข้าสำเร็จ</p>
                                        {affectedRows !== null ? (
                                            <p className="text-sm leading-relaxed text-emerald-100/95">
                                                บันทึก <span className="font-bold">{affectedRows.toLocaleString('th-TH')}</span> พัสดุ
                                                {activeJob ? ` (${formatDuration(Date.now() - activeJob.startedAt)})` : null}
                                            </p>
                                        ) : (
                                            <p className="text-sm leading-relaxed text-emerald-100/95">
                                                ระบบบันทึกข้อมูลเรียบร้อย
                                            </p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={resetState}
                                            className="text-xs text-emerald-300 underline-offset-2 hover:underline"
                                        >
                                            อัปโหลดไฟล์ใหม่
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {/* Error */}
                            {screen === 'error' && (
                                <div className="flex gap-2 rounded-xl border border-red-900/60 bg-red-950/35 px-3 py-2.5 text-sm text-red-200">
                                    <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
                                    <div className="min-w-0">
                                        <p className="font-semibold">{errorMessage || 'ผิดพลาด'}</p>
                                        {errorDetail ? <p className="mt-1 text-xs text-red-100/90">{errorDetail}</p> : null}
                                        <button
                                            type="button"
                                            onClick={resetState}
                                            className="mt-2 text-xs text-red-300 underline-offset-2 hover:underline"
                                        >
                                            ลองอีกครั้ง
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
