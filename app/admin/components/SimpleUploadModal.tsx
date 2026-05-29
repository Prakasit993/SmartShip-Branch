'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload, X, AlertCircle } from 'lucide-react';
import { useUploadJobs } from '@app/admin/context/UploadJobsContext';
import type { JobKind } from '@/lib/uploadJobs';

/**
 * SimpleUploadModal — Modal เลือกไฟล์อย่างเดียว
 *
 * Phase 3.7 — ส่ง file เข้า UploadJobsProvider → tray ทำหน้าที่ tracking
 * Modal ตัวเองไม่ต้องดูแล polling/status
 */

const ACCEPT =
    '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function getMaxFileMb(): number {
    const raw = process.env.NEXT_PUBLIC_N8N_UPLOAD_MAX_FILE_MB?.trim();
    if (!raw) return 4.5;
    const n = Number.parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 4.5;
}

export type SimpleUploadModalProps = {
    kind: JobKind;
    title: string;
    description?: string;
    triggerAriaLabel?: string;
    /** override style ของปุ่ม trigger — default = สีส้ม */
    triggerClassName?: string;
    triggerIconClassName?: string;
};

export function SimpleUploadModal({
    kind,
    title,
    description = 'เลือกไฟล์ Excel หรือ CSV แล้วกดส่ง — ระบบจะประมวลผลและบันทึกข้อมูล',
    triggerAriaLabel,
    triggerClassName,
    triggerIconClassName,
}: SimpleUploadModalProps) {
    const { submitUpload } = useUploadJobs();
    const inputRef = useRef<HTMLInputElement>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!modalOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modalOpen]);

    useEffect(() => {
        if (!modalOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [modalOpen]);

    const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] ?? null;
        setFile(f);
        setDisplayName(f?.name ?? '');
        setError(null);
    }, []);

    const reset = useCallback(() => {
        setFile(null);
        setDisplayName('');
        setError(null);
        if (inputRef.current) inputRef.current.value = '';
    }, []);

    const handleSubmit = async () => {
        if (!file) return;

        const maxMb = getMaxFileMb();
        if (file.size > maxMb * 1024 * 1024) {
            setError(`ไฟล์เกิน ${maxMb} MB — ลองแยกหรือลดขนาด`);
            return;
        }

        setSubmitting(true);
        setError(null);

        const result = await submitUpload({ kind, file });
        setSubmitting(false);

        if ('error' in result) {
            // submit ล้มเหลวก่อนถึง n8n — โชว์ใน modal
            setError(result.error);
            return;
        }

        // POST สำเร็จ → tray ดูแล tracking ต่อ → ปิด modal + reset
        setModalOpen(false);
        reset();
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setModalOpen(true)}
                title={triggerAriaLabel ?? title}
                aria-label={triggerAriaLabel ?? title}
                className={
                    triggerClassName ??
                    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25 transition hover:bg-orange-500/25 hover:ring-orange-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400'
                }
            >
                <FileSpreadsheet
                    className={triggerIconClassName ?? 'h-5 w-5'}
                    aria-hidden
                />
            </button>

            {modalOpen ? (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={`upload-modal-${kind}-title`}>
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
                        aria-label="ปิด"
                        onClick={() => !submitting && setModalOpen(false)}
                    />
                    <div className="relative z-[1] flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 shadow-2xl shadow-black/40 ring-1 ring-white/[0.06]">
                        {/* Header */}
                        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3 sm:px-5">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25">
                                    <FileSpreadsheet className="h-5 w-5" aria-hidden />
                                </div>
                                <div className="min-w-0">
                                    <h2 id={`upload-modal-${kind}-title`} className="text-base font-semibold text-white">
                                        {title}
                                    </h2>
                                    <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalOpen(false)}
                                disabled={submitting}
                                className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
                                aria-label="ปิดหน้าต่าง"
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
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
                                        disabled={submitting}
                                        className="sr-only"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => inputRef.current?.click()}
                                        disabled={submitting}
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

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={!file || submitting}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-950/40 transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {submitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                        <Upload className="h-4 w-4" aria-hidden />
                                    )}
                                    ส่งไฟล์เพื่อนำเข้า
                                </button>
                                {file && !submitting ? (
                                    <button
                                        type="button"
                                        onClick={reset}
                                        className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900"
                                    >
                                        ล้างและเลือกใหม่
                                    </button>
                                ) : null}
                            </div>

                            {error ? (
                                <div className="flex gap-2 rounded-xl border border-red-900/60 bg-red-950/35 px-3 py-2.5 text-sm text-red-200">
                                    <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
                                    <div className="min-w-0">
                                        <p className="font-semibold">ส่งไฟล์ไม่สำเร็จ</p>
                                        <p className="mt-1 text-xs text-red-100/90">{error}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[11px] text-slate-500">
                                    หลังกดส่ง — Modal จะปิด ระบบจะแสดงสถานะที่ปุ่ม
                                    <span className="mx-1 inline-flex items-center gap-1 rounded bg-slate-800/60 px-1.5 py-0.5 font-mono">
                                        งานอัปโหลด
                                    </span>
                                    ขวาล่าง
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
