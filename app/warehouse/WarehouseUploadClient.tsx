'use client';

import { useCallback, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload, CheckCircle2, AlertCircle, X } from 'lucide-react';

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

export function WarehouseUploadClient() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [status, setStatus] = useState<UploadState>('idle');
    const [message, setMessage] = useState('');
    const [detail, setDetail] = useState<string | null>(null);
    const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

    const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) { setFile(null); setDisplayName(''); setStatus('idle'); setMessage(''); setDetail(null); setSuccessInfo(null); return; }
        setFile(f); setDisplayName(f.name); setStatus('idle'); setMessage(''); setDetail(null); setSuccessInfo(null);
    }, []);

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
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
        const url = `/api/admin/stock-n8n-upload?filename=${encodeURIComponent(file.name)}`;

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
                    setSuccessInfo({ kind: 'payload', message: msg.trim(), status: typeof st === 'string' ? st : undefined });
                    return;
                }
            }
            if (typeof parsed === 'string') {
                setSuccessInfo({ kind: 'plain', text: parsed.trim().slice(0, 800) || 'ดำเนินการสำเร็จ' });
            } else {
                setSuccessInfo({ kind: 'plain', text: 'ได้รับการตอบกลับจากระบบแล้ว' });
            }
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
        <div className="w-full max-w-xl space-y-5">
            {/* Drop zone */}
            <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => status !== 'uploading' && inputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="คลิกหรือลากไฟล์มาวางที่นี่"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition
                    ${status === 'uploading'
                        ? 'cursor-not-allowed border-slate-700 bg-slate-900/40 opacity-60'
                        : file
                            ? 'border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10'
                            : 'border-slate-700 bg-slate-900/40 hover:border-amber-500/40 hover:bg-amber-500/5'
                    }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    onChange={onFileChange}
                    disabled={status === 'uploading'}
                    className="sr-only"
                />
                <FileSpreadsheet
                    className={`h-10 w-10 ${file ? 'text-amber-400' : 'text-slate-600'}`}
                    aria-hidden
                />
                {file ? (
                    <div className="space-y-1">
                        <p className="font-semibold text-amber-200 break-all">{displayName}</p>
                        <p className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-300">คลิกเลือกไฟล์ หรือลากมาวางที่นี่</p>
                        <p className="text-xs text-slate-500">รองรับ .xlsx, .xls, .csv</p>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            {status === 'uploading' && (
                <div className="space-y-2" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Loader2 className="h-4 w-4 animate-spin text-amber-400" aria-hidden />
                        <span>กำลังอัปโหลดและส่งไฟล์…</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-slate-800 via-amber-500/90 to-slate-800" />
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={submit}
                    disabled={!file || status === 'uploading'}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-950/40 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {status === 'uploading' ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                        <Upload className="h-4 w-4" aria-hidden />
                    )}
                    ส่งไฟล์เพื่อนำเข้า
                </button>
                {file && status !== 'uploading' ? (
                    <button
                        type="button"
                        onClick={clearFile}
                        className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-900"
                    >
                        <X className="h-4 w-4" aria-hidden />
                        ล้างไฟล์
                    </button>
                ) : null}
            </div>

            {/* Success */}
            {status === 'success' && successInfo ? (
                <div className="flex gap-3 rounded-xl border border-emerald-800/60 bg-emerald-950/35 px-4 py-4 text-sm text-emerald-200">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" aria-hidden />
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

            {/* Error */}
            {status === 'error' && (
                <div className="flex gap-3 rounded-xl border border-red-900/60 bg-red-950/35 px-4 py-3 text-sm text-red-200">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" aria-hidden />
                    <div className="min-w-0">
                        <p className="font-semibold">{message}</p>
                        {detail ? <p className="mt-1 text-xs text-red-100/90">{detail}</p> : null}
                    </div>
                </div>
            )}
        </div>
    );
}
