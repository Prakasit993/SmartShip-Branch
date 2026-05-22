import type { ReactNode } from 'react';

/** Modal รับทราบ (ใช้ทั้งตีกลับ/ตกค้าง) — เนื้อใน (เหตุผล ฯลฯ) ส่งผ่าน children */
export function AckModal({ title, awb, awbTone, note, accent, loading, error, canSubmit, onClose, onSubmit, children }: {
    title: string;
    awb: string;
    awbTone: string;
    note: string;
    accent: 'emerald' | 'amber';
    loading: boolean;
    error: string | null;
    canSubmit: boolean;
    onClose: () => void;
    onSubmit: () => void;
    children: ReactNode;
}) {
    const btn = accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500';
    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl ring-1 ring-white/10">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <button type="button" disabled={loading} onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50">ปิด</button>
                </div>
                <div className="space-y-3 px-4 py-4">
                    <p className="text-sm text-slate-300">เลขพัสดุ <span className={`font-semibold ${awbTone}`}>{awb}</span> {note}</p>
                    {children}
                    {error ? <p className="text-sm text-rose-400">{error}</p> : null}
                    <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                        <button type="button" disabled={loading} onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50">ยกเลิก</button>
                        <button type="button" disabled={loading || !canSubmit} onClick={onSubmit} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${btn}`}>{loading ? 'กำลังบันทึก...' : 'บันทึกรับทราบ'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function PresetSelect({ value, accent, options, onChange }: { value: string; accent: 'emerald' | 'amber'; options: string[]; onChange: (v: string) => void }) {
    const ring = accent === 'emerald' ? 'ring-emerald-500/25 focus:border-emerald-500/50' : 'ring-amber-500/25 focus:border-amber-500/50';
    return (
        <label className="block">
            <span className="text-xs font-medium text-slate-400">เหตุผลที่รับทราบ</span>
            <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 ${ring}`}>
                {options.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
        </label>
    );
}

export function CustomReasonTextarea({ value, accent, placeholder, onChange }: { value: string; accent: 'emerald' | 'amber'; placeholder: string; onChange: (v: string) => void }) {
    const ring = accent === 'emerald' ? 'ring-emerald-500/25 focus:border-emerald-500/50' : 'ring-amber-500/25 focus:border-amber-500/50';
    return (
        <label className="block">
            <span className="text-xs font-medium text-slate-400">รายละเอียดเพิ่มเติม</span>
            <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={500} placeholder={placeholder} className={`mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:ring-2 ${ring}`} />
        </label>
    );
}
