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
 * UploadJobsProvider — global tracking ของ upload jobs ทั้งระบบ
 *
 * Lifecycle ของ job ใน UI:
 *   1. submitUpload({kind, file}) — POST → กำลัง upload
 *   2. หลัง POST สำเร็จ — ได้ request_id → status='processing'
 *   3. Polling /api/admin/jt-warehouse/upload-jobs?request_id=... ทุก 2 วินาที
 *   4. n8n callback → DB row update → poll เห็น status เปลี่ยน → broadcast toast
 *   5. หลัง finished — เหลือไว้ใน tray 10 วินาที (admin เห็นผล) → auto-dismiss
 */

const UPLOAD_ENDPOINTS: Record<JobKind, string> = {
    jt_parcel: '/api/admin/jt-parcel-n8n-upload',
    jt_shipment: '/api/admin/n8n-upload',
    tiktok: '/api/admin/tiktok-n8n-upload',
};

const POLL_INTERVAL_MS = 2_000;
const AUTO_DISMISS_MS = 10_000;
const JOB_TIMEOUT_MS = 5 * 60_000; // 5 นาที — ถ้า n8n ไม่ callback = ถือว่า timeout

export type UiJobStatus =
    | 'uploading'   // ระหว่าง POST upload route
    | 'processing'  // หลัง POST OK รอ n8n callback
    | 'success'
    | 'error'
    | 'timeout';

export type UploadJob = {
    requestId: string;       // เป็น 'temp-<uuid>' จนกว่าจะได้ id จริงจาก server
    kind: JobKind;
    fileName: string;
    status: UiJobStatus;
    startedAt: number;
    finishedAt?: number;
    stats?: Record<string, unknown> | null;
    error?: string | null;
    autoDismissAt?: number;  // Date.now() ที่จะ auto-dismiss
};

type SubmitResult = { requestId: string } | { error: string };

type ContextValue = {
    jobs: UploadJob[];
    activeCount: number;
    submitUpload: (args: { kind: JobKind; file: File }) => Promise<SubmitResult>;
    dismissJob: (requestId: string) => void;
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
    const { showSuccess, showError } = useToast();

    const [jobs, setJobs] = useState<UploadJob[]>([]);
    const jobsRef = useRef<UploadJob[]>([]);
    jobsRef.current = jobs;

    // Helper: mutate single job
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
        setJobs((prev) => prev.filter((j) => j.status === 'uploading' || j.status === 'processing'));
    }, []);

    // --- submitUpload ----------------------------------------------
    const submitUpload = useCallback(
        async ({ kind, file }: { kind: JobKind; file: File }): Promise<SubmitResult> => {
            // 1. สร้าง local job ก่อน (UI feedback ทันที)
            const tempId = `temp-${crypto.randomUUID()}`;
            const startedAt = Date.now();
            setJobs((prev) => [
                ...prev,
                {
                    requestId: tempId,
                    kind,
                    fileName: file.name,
                    status: 'uploading',
                    startedAt,
                },
            ]);

            // 2. ส่ง POST
            const endpoint = UPLOAD_ENDPOINTS[kind];
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
                    // mark error
                    setJobs((prev) =>
                        prev.map((j) =>
                            j.requestId === tempId
                                ? {
                                      ...j,
                                      status: 'error',
                                      finishedAt: Date.now(),
                                      error: errMsg,
                                      autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                                  }
                                : j,
                        ),
                    );
                    showError(`อัปโหลด ${JOB_KIND_LABEL[kind]} ไม่สำเร็จ: ${errMsg}`);
                    return { error: errMsg };
                }

                // 3. รับ request_id → swap tempId → realId, set processing
                const payload = (typeof parsed === 'object' && parsed !== null
                    ? (parsed as Record<string, unknown>)
                    : {}) as Record<string, unknown>;
                const realRequestId =
                    typeof payload.request_id === 'string' ? payload.request_id : null;

                if (!realRequestId) {
                    const msg = 'server ไม่ส่ง request_id กลับมา';
                    setJobs((prev) =>
                        prev.map((j) =>
                            j.requestId === tempId
                                ? {
                                      ...j,
                                      status: 'error',
                                      finishedAt: Date.now(),
                                      error: msg,
                                      autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                                  }
                                : j,
                        ),
                    );
                    showError(`อัปโหลด ${JOB_KIND_LABEL[kind]} ไม่สำเร็จ: ${msg}`);
                    return { error: msg };
                }

                setJobs((prev) =>
                    prev.map((j) =>
                        j.requestId === tempId
                            ? { ...j, requestId: realRequestId, status: 'processing' }
                            : j,
                    ),
                );

                return { requestId: realRequestId };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setJobs((prev) =>
                    prev.map((j) =>
                        j.requestId === tempId
                            ? {
                                  ...j,
                                  status: 'error',
                                  finishedAt: Date.now(),
                                  error: msg,
                                  autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                              }
                            : j,
                    ),
                );
                showError(`อัปโหลด ${JOB_KIND_LABEL[kind]} ไม่สำเร็จ: ${msg}`);
                return { error: msg };
            }
        },
        [showError],
    );

    // --- Polling loop -----------------------------------------------
    useEffect(() => {
        const id = setInterval(async () => {
            const processingJobs = jobsRef.current.filter((j) => j.status === 'processing');
            if (processingJobs.length === 0) return;

            // Poll พร้อมกันทุก job
            await Promise.all(
                processingJobs.map(async (job) => {
                    // Timeout check
                    if (Date.now() - job.startedAt > JOB_TIMEOUT_MS) {
                        updateJob(job.requestId, {
                            status: 'timeout',
                            finishedAt: Date.now(),
                            error: 'ไม่ได้รับการตอบกลับจากระบบใน 5 นาที',
                            autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                        });
                        showError(`${JOB_KIND_LABEL[job.kind]}: timeout`);
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
                            updateJob(job.requestId, {
                                status: 'success',
                                finishedAt: remote.finished_at
                                    ? new Date(remote.finished_at).getTime()
                                    : Date.now(),
                                stats: remote.stats,
                                autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                            });
                            const affected =
                                remote.stats && typeof remote.stats.affected_rows === 'number'
                                    ? (remote.stats.affected_rows as number)
                                    : null;
                            showSuccess(
                                affected !== null
                                    ? `${JOB_KIND_LABEL[job.kind]}: นำเข้า ${affected.toLocaleString('th-TH')} รายการ`
                                    : `${JOB_KIND_LABEL[job.kind]}: เสร็จสิ้น`,
                            );
                            router.refresh();
                        } else if (remote.status === 'error' || remote.status === 'timeout') {
                            updateJob(job.requestId, {
                                status: remote.status === 'timeout' ? 'timeout' : 'error',
                                finishedAt: remote.finished_at
                                    ? new Date(remote.finished_at).getTime()
                                    : Date.now(),
                                stats: remote.stats,
                                error: remote.error,
                                autoDismissAt: Date.now() + AUTO_DISMISS_MS,
                            });
                            showError(
                                `${JOB_KIND_LABEL[job.kind]}: ${remote.error || 'ผิดพลาด'}`,
                            );
                        }
                    } catch {
                        // network error — retry รอบหน้า
                    }
                }),
            );
        }, POLL_INTERVAL_MS);

        return () => clearInterval(id);
    }, [updateJob, showError, showSuccess, router]);

    // --- Auto-dismiss finished jobs ----------------------------------
    useEffect(() => {
        const id = setInterval(() => {
            setJobs((prev) => {
                const now = Date.now();
                const filtered = prev.filter((j) => !(j.autoDismissAt && j.autoDismissAt <= now));
                return filtered.length === prev.length ? prev : filtered;
            });
        }, 1_000);
        return () => clearInterval(id);
    }, []);

    const activeCount = useMemo(
        () => jobs.filter((j) => j.status === 'uploading' || j.status === 'processing').length,
        [jobs],
    );

    const value = useMemo<ContextValue>(
        () => ({ jobs, activeCount, submitUpload, dismissJob, clearFinished }),
        [jobs, activeCount, submitUpload, dismissJob, clearFinished],
    );

    return <UploadJobsContext.Provider value={value}>{children}</UploadJobsContext.Provider>;
}
