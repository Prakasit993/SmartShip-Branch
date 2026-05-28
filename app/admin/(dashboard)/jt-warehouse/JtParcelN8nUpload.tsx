'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    FileSpreadsheet,
    Loader2,
    Upload,
    CheckCircle2,
    AlertCircle,
    X,
} from 'lucide-react';
import { useToast } from '@app/admin/context/ToastContext';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

type SuccessInfo =
    | { kind: 'payload'; message: string; status?: string }
    | { kind: 'plain'; text: string };

const ACCEPT =
    '.csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function getMaxFileMb(): number {
    const raw = process.env.NEXT_PUBLIC_N8N_UPLOAD_MAX_FILE_MB?.trim();
    if (!raw) return 4.5;
    const n = Number.parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 4.5;
}

function statusBadgeClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'processing' || s === 'pending') return 'bg-amber-500/20 text-amber-200 ring-amber-500/35';
    if (s === 'error' || s === 'failed') return 'bg-red-500/20 text-red-200 ring-red-500/35';
    if (s === 'success' || s === 'ok' || s === 'done' || s === 'completed') return 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/35';
    return 'bg-slate-600/40 text-slate-200 ring-slate-500/30';
}

function statusLabelTh(status: string): string {
    const map: Record<string, string> = {
        processing: 'กำลังประมวลผล', pending: 'รอดำเนินการ',
        success: 'สำเร็จ', ok: 'สำเร็จ', done: 'เสร็จสิ้น', completed: 'เสร็จสิ้น',
        error: 'ผิดพลาด', failed: 'ล้มเหลว',
    };
    return map[status.toLowerCase()] ?? status;
}

type Props = {
    onUploadSuccess?: () => void;
};

export function JtParcelN8nUpload({ onUploadSuccess }: Props) {
    const { showSuccess } = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [status, setStatus] = useState<UploadState>('idle');
    const [message, setMessage] = useState('');
    const [detail, setDetail] = useState<string | null>(null);
    const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

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
        const f = e.target.files?.[0];
        if (!f) { setFile(null); setDisplayName(''); setStatus('idle'); setMessage(''); setDetail(null); setSuccessInfo(null); return; }
        setFile(f); setDisplayName(f.name); setStatus('idle'); setMessage(''); setDetail(null); setSuccessInfo(null);
    }, []);

    const submit = async () => {
        if (!file) return;

        const maxMb = getMaxFileMb();
        if (file.size > maxMb * 1024 * 1024) {
            setStatus('error');
            setMessage('ไฟล์ใหญ่เกินขีดจำกัด');
            setDetail(`ไฟล์นี้มีขนาดเกิน ${maxMb} MB — ลองแยกหรือลดขนาดไฟล์แล้วส่งใหม่`);
            return;
        }

        setStatus('uploading'); setMessage(''); setDetail(null); setSuccessInfo(null);

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
                setStatus('error');
                setMessage(res.status === 413 ? 'ไฟล์ใหญ่เกินขีดจำกัด' : 'นำเข้าไม่สำเร็จ');
                setDetail(errMsg);
                return;
            }

            setStatus('success');

            if (typeof parsed === 'object' && parsed !== null) {
                const o = parsed as Record<string, unknown>;
                const msg = o.message;
                const st = o.status;
                if (typeof msg === 'string' && msg.trim()) {
                    const statusStr = typeof st === 'string' ? st : undefined;
                    if (statusStr === 'processing') showSuccess(msg);
                    setSuccessInfo({ kind: 'payload', message: msg.trim(), status: statusStr });
                    onUploadSuccess?.();
                    return;
                }
            }

            if (typeof parsed === 'string') {
                setSuccessInfo({ kind: 'plain', text: parsed.trim().slice(0, 800) || 'ดำเนินการสำเร็จ' });
            } else {
                setSuccessInfo({ kind: 'plain', text: 'ได้รับการตอบกลับจากระบบแล้ว' });
            }
            onUploadSuccess?.();
        } catch (e) {
            setStatus('error');
            setMessage('เชื่อมต่อไม่สำเร็จ — ลองใหม่อีกครั้ง');
            setDetail(e instanceof Error ? e.message : String(e));
        }
    };

    const clearFile = () => {
        setFile(null); setDisplayName(''); setStatus('idle'); setMessage(''); setDetail(null); setSuccessInfo(null);
        if (inputRef.current) inputRef.current.value = '';
    };

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
                                        disabled={status === 'uploading'}
                                        className="sr-only"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => inputRef.current?.click()}
                                        disabled={status === 'uploading'}
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

                            {displayName ? (
                                <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">ไฟล์ที่จะส่ง</p>
                                    <p className="mt-1 truncate font-mono text-sm text-orange-200" title={displayName}>{displayName}</p>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">รองรับไฟล์ .xlsx, .xls, .csv</p>
                            )}

                            {status === 'uploading' && (
                                <div className="space-y-2" role="status" aria-live="polite">
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <Loader2 className="h-4 w-4 animate-spin text-orange-400" aria-hidden />
                                        <span>กำลังอัปโหลดและส่งไฟล์…</span>
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
                                    disabled={!file || status === 'uploading'}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-950/40 transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {status === 'uploading' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                        <Upload className="h-4 w-4" aria-hidden />
                                    )}
                                    ส่งไฟล์เพื่อนำเข้า
                                </button>
                                {file ? (
                                    <button
                                        type="button"
                                        onClick={clearFile}
                                        disabled={status === 'uploading'}
                                        className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 disabled:opacity-40"
                                    >
                                        ล้างและเลือกใหม่
                                    </button>
                                ) : null}
                            </div>

                            {status === 'success' && successInfo ? (
                                <div className="flex gap-3 rounded-xl border border-emerald-800/60 bg-emerald-950/35 px-3 py-3 text-sm text-emerald-200">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <p className="font-semibold text-white">ส่งไฟล์สำเร็จ</p>
                                        {successInfo.kind === 'payload' ? (
                                            <>
                                                {successInfo.status ? (
                                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(successInfo.status)}`}>
                                                        {statusLabelTh(successInfo.status)}
                                                    </span>
                                                ) : null}
                                                <p className="text-sm leading-relaxed text-emerald-100/95">{successInfo.message}</p>
                                            </>
                                        ) : (
                                            <p className="text-sm leading-relaxed text-emerald-100/95">{successInfo.text}</p>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {status === 'error' && (
                                <div className="flex gap-2 rounded-xl border border-red-900/60 bg-red-950/35 px-3 py-2.5 text-sm text-red-200">
                                    <AlertCircle className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
                                    <div className="min-w-0">
                                        <p className="font-semibold">{message}</p>
                                        {detail ? <p className="mt-1 text-xs text-red-100/90">{detail}</p> : null}
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
