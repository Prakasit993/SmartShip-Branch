'use client';

import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

interface ImportResult {
    total: number;
    inserted: number;
    skipped: number;
}

interface Props {
    onClose: () => void;
    onImported: (result: ImportResult) => void;
}

export default function ImportModal({ onClose, onImported }: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'done' | 'error'>('idle');
    const [preview, setPreview] = useState<Record<string, string>[]>([]);
    const [fileName, setFileName] = useState('');
    const [result, setResult] = useState<ImportResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const parseFile = useCallback((file: File) => {
        setFileName(file.name);
        setStatus('parsing');
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'binary', cellDates: true });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
                setPreview(rows.slice(0, 5));
                setStatus('idle');
            } catch {
                setStatus('error');
                setErrorMsg('ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ .xlsx หรือ .csv');
            }
        };
        reader.readAsBinaryString(file);

        // Store full rows for upload
        const fullReader = new FileReader();
        fullReader.onload = (e) => {
            const data = e.target?.result;
            const wb = XLSX.read(data, { type: 'binary', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
            (window as unknown as Record<string, unknown>).__importRows = rows;
        };
        fullReader.readAsBinaryString(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) parseFile(file);
    }, [parseFile]);

    const handleUpload = async () => {
        const rows = (window as unknown as Record<string, unknown>).__importRows as Record<string, string>[];
        if (!rows?.length) return;
        setStatus('uploading');
        try {
            const res = await fetch('/api/admin/jt-shipments/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setResult(json);
            setStatus('done');
            onImported(json);
        } catch (e: unknown) {
            setStatus('error');
            setErrorMsg(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4"
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-black">📥 Import ข้อมูล Excel / CSV</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white text-xl">✕</button>
                </div>

                {/* Drop Zone */}
                <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]'
                        : 'border-zinc-300 dark:border-zinc-700 hover:border-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                >
                    <div className="text-4xl mb-3">{fileName ? '📊' : '☁️'}</div>
                    {fileName
                        ? <p className="font-bold text-blue-600">{fileName}</p>
                        : <>
                            <p className="font-bold text-zinc-600 dark:text-zinc-300">ลากไฟล์มาวางที่นี่</p>
                            <p className="text-sm text-zinc-400 mt-1">หรือคลิกเพื่อเลือกไฟล์ .xlsx / .csv</p>
                        </>
                    }
                    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                        onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />
                </div>

                {/* Column hint */}
                <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-xs text-zinc-500">
                    <p className="font-semibold mb-1">📋 คอลัมน์ที่รองรับ (อังกฤษ / ไทย):</p>
                    <p className="leading-relaxed">
                        <span className="font-mono text-blue-500">awb_number</span> (หมายเลข AWB) · <span className="font-mono">booking_date</span> (เวลาที่ส่งพัสดุ) · <span className="font-mono">sender_name</span> (ชื่อลูกค้า/ผู้ส่ง) · <span className="font-mono">sender_phone</span> (เบอร์ผู้ส่ง) · <span className="font-mono">receiver_name</span> (ผู้รับ) · <span className="font-mono">receiver_phone</span> (เบอร์ผู้รับ) · <span className="font-mono">shipping_fee</span> (ค่าส่ง)
                    </p>
                </div>

                {/* Preview */}
                {preview.length > 0 && status !== 'done' && (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <table className="text-xs w-full">
                            <thead>
                                <tr className="bg-zinc-50 dark:bg-zinc-800">
                                    {Object.keys(preview[0]).map(k => (
                                        <th key={k} className="px-3 py-2 text-left font-semibold text-zinc-500 whitespace-nowrap">{k}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((row, i) => (
                                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                                        {Object.values(row).map((v, j) => (
                                            <td key={j} className="px-3 py-1.5 max-w-[150px] truncate">{String(v)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="px-3 py-1.5 text-xs text-zinc-400">แสดง 5 แถวแรก</p>
                    </div>
                )}

                {/* Result */}
                {status === 'done' && result && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-sm space-y-1">
                        <p className="font-bold text-green-700 dark:text-green-400">✅ Import สำเร็จ!</p>
                        <p>รวมทั้งหมด: <strong>{result.total.toLocaleString()}</strong> แถว</p>
                        <p>บันทึกแล้ว: <strong className="text-green-600">{result.inserted.toLocaleString()}</strong> แถว</p>
                        {result.skipped > 0 && <p>ข้ามไป: <strong className="text-yellow-600">{result.skipped.toLocaleString()}</strong> แถว</p>}
                    </div>
                )}

                {status === 'error' && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-sm text-red-600">⚠️ {errorMsg}</div>
                )}

                <div className="flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                        {status === 'done' ? 'ปิด' : 'ยกเลิก'}
                    </button>
                    {preview.length > 0 && status !== 'done' && (
                        <button onClick={handleUpload} disabled={status === 'uploading'}
                            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold transition">
                            {status === 'uploading' ? '⏳ กำลัง Import...' : `📤 Import (${((window as unknown as Record<string, unknown>).__importRows as unknown[])?.length?.toLocaleString() || '?'} แถว)`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
