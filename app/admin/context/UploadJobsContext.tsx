'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './ToastContext';
import {
    JOB_KIND_LABEL,
    type JobKind,
    type JobStatus,
} from '@/lib/uploadJobs';

/**
 * UploadJobsProvider — global tracking + smart queue + auto-retry
 *
 * Phase 3.7+ — Concurrency + Retry rules:
 *   • MAX_CONCURRENT = 2     — รัน upload พร้อมกันสูงสุด 2 (test แล้วว่าไม่ทำให้ server พัง)
 *   • MAX_RETRIES = 2        — retry อัตโนมัติ 2 ครั้งเมื่อ error
 *   • RETRY_DELAY_MS = 30s   — รอ 30 วินาทีก่อน retry (ให้ server cool down)
 *
 * State machine:
 *   queued (in queue หรือ waiting for retry)
 *     ↓ slot available
 *   uploading (POST in progress)
 *     ↓ POST OK
 *   processing (รอ n8n callback)
 *     ↓
 *   success / error / timeout
 *
 *   หาก error/timeout + retries left → กลับเป็น queued (with retryAt)
 */

const UPLOAD_ENDPOINTS: Record<JobKind, string> = {
    jt_parcel: '/api/admin/jt-parcel-n8n-upload',
    jt_shipment: '/api/admin/n8n-upload',
    tiktok: '/api/admin/tiktok-n8n-upload',
};

const MAX_CONCURRENT = 2;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;
const QUEUE_TICK_MS = 1_000;
const AUTO_DISMISS_MS = 10_000;
const JOB_TIMEOUT_MS = 5 * 60_000;

export type UiJobStatus =
    | 'queued'      // รอคิว หรือ รอ retry (ดู retryAt)
    | 'uploading'   // POST upload route in progress
    | 'processing'  // POST OK รอ n8n callback
    | 'success'
    | 'error'
    | 'timeout';

export type UploadJob = {
    requestId: string;
    kind: JobKind;
    fileName: string;
    status: UiJobStatus;
    startedAt: number;
    finishedAt?: number;
    stats?: Record<string, unknown> | null;
    error?: string | null;
    autoDismissAt?: number;
    // Queue + retry
    file?: File;             // เก็บไว้สำหรับ retry — clear หลัง success/exhausted
    retryCount: number;      // 0..MAX_RETRIES
    retryAt?: number;        // ถ้า status='queued' + retryAt set → รอเวลา retry
};

type SubmitResult = { requestId: string } | { error: string };

type ContextValue = {
    jobs: UploadJob[];
    activeCount: number;
    queuedCount: number;
    submitUpload: (args: { kind: JobKind; file: File }) => Promise<SubmitResult>;
    dismissJob: (requestId: string) => void;
    retryJob: (requestId: string) => void;
    clearFinished: () => void;
};

const UploadJobsContext = createContext<ContextValue | null>(null);

export function useUploadJobs(): ContextValue {
    const ctx = useContext(UploadJobsContext);
    if (!ctx) {
        throw new Error('useUploadJobs ต้องเรียกภายใน UploadJobsProvider');
    }
    return ctx;
}

export function UploadJobsProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { showSuccess, showError, showInfo } = useToast();

    const [jobs, setJobs] = useState<UploadJob[]>([]);
    const jobsRef = useRef<UploadJob[]>([]);
    jobsRef.current = jobs;

    // ทำให้ใช้ใน async callbacks ได้ (กัน stale closure)
    const showSuccessRef = useRef(showSuccess);
    const showErrorRef = useRef(showError);
    const showInfoRef = useRef(showInfo);
    showSuccessRef.current = showSuccess;
    showErrorRef.current = showError;
    showInfoRef.current = showInfo;

    const routerRef = useRef(router);
    routerRef.current = router;

    // ─────────────────────────────────────────────────────────────
    // Mutations
    // ─────────────────────────────────────────────────────────────

    const updateJob = useCallback(
        (requestId: string, patch: Partial<UploadJob>) => {
            setJobs((prev) =>
                prev.map((j) => (j.requestId === requestId ? { ...j, ...patch } : j)),
            );
        },
        [],
    );

    const dismissJob = useCallback((requestId: string) => {
        setJobs((prev) => prev.filter((j) => j.requestId !== requestId));
    }, []);

    const clearFinished = useCallback(() => {
        setJobs((prev) =>
            prev.filter(
                (j) =>
                    j.status === 'uploading' ||
                    j.status === 'processing' ||
                    j.status === 'queued',
            ),
        );
    }, []);

    /**
     * Manual retry — admin กดปุ่ม retry บน job ที่ final error
     * Reset retryCount = 0 → ใส่ queue ใหม่
     */
    const retryJob = useCallback((requestId: string) => {
        setJobs((prev) =>
            prev.map((j) => {
                if (j.requestId !== requestId) return j;
                if (!j.file) return j; // ไม่มี file แล้ว — ไม่ retry
                return {
                    ...j,
                    status: 'queued',
                    retryCount: 0,
                    retryAt: undefined,
                    error: null,
                    finishedAt: undefined,
                    autoDismissAt: undefined,
                };
            }),
        );
    }, []);

    // ─────────────────────────────────────────────────────────────
    // Upload trigger (called by queue drainer)
    // ─────────────────────────────────────────────────────────────

    const triggerUploadJob = useCallback(async (job: UploadJob) => {
        if (!job.file) {
            // ไม่มี file (อาจถูก clear) — mark final error
            setJobs((prev) =>
                prev.map((j) =>
                    j.requestId === job.requestId
                        ? {
                              ...j,
                              status: 'error',
                              error: 'ไฟล์ถูกล้างไป — กดอัปโหลดใหม่',
                              finishedAt: Date.now(),
                              autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                          }
                        : j,
                ),
            );
            return;
        }

        const file = job.file;

        // Update status → uploading + reset startedAt (สำหรับ timeout)
        setJobs((prev) =>
            prev.map((j) =>
                j.requestId === job.requestId
                    ? { ...j, status: 'uploading', startedAt: Date.now(), retryAt: undefined }
                    : j,
            ),
        );

        const endpoint = UPLOAD_ENDPOINTS[job.kind];
        const fd = new FormData();
        fd.append('file', file);
        const url = `${endpoint}?filename=${encodeURIComponent(file.name)}`;

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
                handleJobError(job.requestId, errMsg);
                return;
            }

            const payload =
                typeof parsed === 'object' && parsed !== null
                    ? (parsed as Record<string, unknown>)
                    : {};
            const realRequestId =
                typeof payload.request_id === 'string' ? payload.request_id : null;

            if (!realRequestId) {
                handleJobError(job.requestId, 'server ไม่ส่ง request_id');
                return;
            }

            // Swap to real request_id + processing
            setJobs((prev) =>
                prev.map((j) =>
                    j.requestId === job.requestId
                        ? { ...j, requestId: realRequestId, status: 'processing' }
                        : j,
                ),
            );
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            handleJobError(job.requestId, msg);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Handle error during upload or processing.
     * ถ้า retries left → schedule retry (status=queued + retryAt)
     * ถ้าเต็ม retry → final error + showError toast + clear file
     */
    const handleJobError = useCallback((requestId: string, errorMsg: string) => {
        setJobs((prev) =>
            prev.map((j) => {
                if (j.requestId !== requestId) return j;
                if (j.retryCount < MAX_RETRIES && j.file) {
                    // Schedule retry
                    showInfoRef.current(
                        `${JOB_KIND_LABEL[j.kind]}: จะลองใหม่ใน 30 วินาที (${j.retryCount + 1}/${MAX_RETRIES})`,
                    );
                    return {
                        ...j,
                        status: 'queued',
                        retryAt: Date.now() + RETRY_DELAY_MS,
                        retryCount: j.retryCount + 1,
                        error: errorMsg,
                    };
                }
                // Final error
                showErrorRef.current(
                    `${JOB_KIND_LABEL[j.kind]}: ${errorMsg.slice(0, 100)}`,
                );
                return {
                    ...j,
                    status: 'error',
                    file: undefined,
                    finishedAt: Date.now(),
                    error: errorMsg,
                    autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                };
            }),
        );
    }, []);

    // ─────────────────────────────────────────────────────────────
    // submitUpload — entry point
    // ─────────────────────────────────────────────────────────────

    const submitUpload = useCallback(
        async ({ kind, file }: { kind: JobKind; file: File }): Promise<SubmitResult> => {
            const tempId = `temp-${crypto.randomUUID()}`;
            const now = Date.now();

            const activeCount = jobsRef.current.filter(
                (j) => j.status === 'uploading' || j.status === 'processing',
            ).length;

            const initialStatus: UiJobStatus = activeCount < MAX_CONCURRENT ? 'queued' : 'queued';

            const newJob: UploadJob = {
                requestId: tempId,
                kind,
                fileName: file.name,
                status: initialStatus,
                startedAt: now,
                file,
                retryCount: 0,
            };

            setJobs((prev) => [...prev, newJob]);

            // Queue drainer (useEffect) จะ pick up ภายใน 1 วินาที
            return { requestId: tempId };
        },
        [],
    );

    // ─────────────────────────────────────────────────────────────
    // Queue drainer — ทุก 1 วินาที check ว่ามี slot ไหม + queued job พร้อมเริ่มไหม
    // ─────────────────────────────────────────────────────────────

    useEffect(() => {
        const id = setInterval(() => {
            const currentJobs = jobsRef.current;
            const activeCount = currentJobs.filter(
                (j) => j.status === 'uploading' || j.status === 'processing',
            ).length;

            const slots = MAX_CONCURRENT - activeCount;
            if (slots <= 0) return;

            const now = Date.now();
            const readyToStart = currentJobs
                .filter((j) => j.status === 'queued' && (!j.retryAt || j.retryAt <= now))
                .slice(0, slots);

            readyToStart.forEach((job) => {
                triggerUploadJob(job);
            });
        }, QUEUE_TICK_MS);

        return () => clearInterval(id);
    }, [triggerUploadJob]);

    // ─────────────────────────────────────────────────────────────
    // Polling loop — เช็คสถานะของ processing jobs
    // ─────────────────────────────────────────────────────────────

    useEffect(() => {
        const id = setInterval(async () => {
            const processingJobs = jobsRef.current.filter((j) => j.status === 'processing');
            if (processingJobs.length === 0) return;

            await Promise.all(
                processingJobs.map(async (job) => {
                    // Timeout check
                    if (Date.now() - job.startedAt > JOB_TIMEOUT_MS) {
                        // Use handleJobError ให้ retry logic ทำงาน
                        handleJobError(
                            job.requestId,
                            'ไม่ได้รับการตอบกลับจากระบบใน 5 นาที',
                        );
                        return;
                    }

                    try {
                        const res = await fetch(
                            `/api/admin/jt-warehouse/upload-jobs?request_id=${encodeURIComponent(job.requestId)}`,
                            { credentials: 'include', cache: 'no-store' },
                        );
                        if (!res.ok) return;
                        const json = (await res.json()) as {
                            job: {
                                status: JobStatus;
                                stats: Record<string, unknown> | null;
                                error: string | null;
                                finished_at: string | null;
                            } | null;
                        };
                        const remote = json.job;
                        if (!remote) return;

                        if (remote.status === 'success') {
                            const affected =
                                remote.stats && typeof remote.stats.affected_rows === 'number'
                                    ? (remote.stats.affected_rows as number)
                                    : null;
                            updateJob(job.requestId, {
                                status: 'success',
                                file: undefined,
                                finishedAt: remote.finished_at
                                    ? new Date(remote.finished_at).getTime()
                                    : Date.now(),
                                stats: remote.stats,
                                autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                            });
                            showSuccessRef.current(
                                affected !== null
                                    ? `${JOB_KIND_LABEL[job.kind]}: นำเข้า ${affected.toLocaleString('th-TH')} รายการ`
                                    : `${JOB_KIND_LABEL[job.kind]}: เสร็จสิ้น`,
                            );
                            routerRef.current.refresh();
                        } else if (remote.status === 'error' || remote.status === 'timeout') {
                            handleJobError(
                                job.requestId,
                                remote.error || 'ระบบแจ้งข้อผิดพลาด',
                            );
                        }
                    } catch {
                        // network error — retry รอบหน้า (พึ่ง polling tick ใหม่)
                    }
                }),
            );
        }, POLL_INTERVAL_MS);

        return () => clearInterval(id);
    }, [updateJob, handleJobError]);

    // ─────────────────────────────────────────────────────────────
    // Auto-dismiss finished jobs
    // ─────────────────────────────────────────────────────────────

    useEffect(() => {
        const id = setInterval(() => {
            setJobs((prev) => {
                const now = Date.now();
                const filtered = prev.filter(
                    (j) => !(j.autoDismissAt && j.autoDismissAt <= now),
                );
                return filtered.length === prev.length ? prev : filtered;
            });
        }, 1_000);
        return () => clearInterval(id);
    }, []);

    // ─────────────────────────────────────────────────────────────
    // Derived state + context value
    // ─────────────────────────────────────────────────────────────

    const activeCount = useMemo(
        () =>
            jobs.filter((j) => j.status === 'uploading' || j.status === 'processing').length,
        [jobs],
    );
    const queuedCount = useMemo(
        () => jobs.filter((j) => j.status === 'queued').length,
        [jobs],
    );

    const value = useMemo<ContextValue>(
        () => ({
            jobs,
            activeCount,
            queuedCount,
            submitUpload,
            dismissJob,
            retryJob,
            clearFinished,
        }),
        [jobs, activeCount, queuedCount, submitUpload, dismissJob, retryJob, clearFinished],
    );

    return <UploadJobsContext.Provider value={value}>{children}</UploadJobsContext.Provider>;
}
