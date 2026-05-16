'use client';

import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Shortcut {
    id: number;
    keyword: string;
    prompt: string;
    is_active: boolean;
    sort_order: number;
}

interface Props {
    onClose: () => void;
    onShortcutsChanged: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const json = (await res.json()) as { error?: string; shortcut?: Shortcut; shortcuts?: Shortcut[] };
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
}

// ── Row component ─────────────────────────────────────────────────────────────

interface ShortcutRowProps {
    shortcut: Shortcut;
    onToggle: (id: number, active: boolean) => Promise<void>;
    onEdit: (shortcut: Shortcut) => void;
    onDelete: (id: number) => Promise<void>;
}

function ShortcutRow({ shortcut, onToggle, onEdit, onDelete }: ShortcutRowProps) {
    const [toggling, setToggling] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleToggle = async () => {
        setToggling(true);
        try {
            await onToggle(shortcut.id, !shortcut.is_active);
        } finally {
            setToggling(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setDeleting(true);
        try {
            await onDelete(shortcut.id);
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    return (
        <div
            className={`group flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                shortcut.is_active
                    ? 'border-white/[0.07] bg-white/[0.02]'
                    : 'border-white/[0.04] bg-transparent opacity-50'
            }`}
        >
            {/* Toggle */}
            <button
                type="button"
                onClick={() => void handleToggle()}
                disabled={toggling}
                aria-label={shortcut.is_active ? 'ปิดใช้งาน chip' : 'เปิดใช้งาน chip'}
                className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border transition-all ${
                    shortcut.is_active
                        ? 'border-indigo-500/40 bg-indigo-500/30'
                        : 'border-white/10 bg-white/5'
                } disabled:cursor-wait`}
            >
                <span
                    className={`ml-0.5 h-3.5 w-3.5 rounded-full shadow transition-all ${
                        shortcut.is_active
                            ? 'translate-x-[18px] bg-indigo-400'
                            : 'translate-x-0 bg-slate-500'
                    }`}
                />
            </button>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-200 leading-snug">{shortcut.keyword}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                    {shortcut.prompt}
                </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                    type="button"
                    onClick={() => onEdit(shortcut)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                    aria-label="แก้ไข"
                    title="แก้ไข"
                >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors disabled:cursor-wait ${
                        confirmDelete
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-400'
                    }`}
                    aria-label={confirmDelete ? 'ยืนยันลบ' : 'ลบ'}
                    title={confirmDelete ? 'คลิกอีกครั้งเพื่อยืนยัน' : 'ลบ'}
                >
                    {deleting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : confirmDelete ? (
                        <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                </button>
            </div>
        </div>
    );
}

// ── Edit / Add form ───────────────────────────────────────────────────────────

interface ShortcutFormProps {
    initial?: Shortcut;
    onSave: (keyword: string, prompt: string) => Promise<void>;
    onCancel: () => void;
}

function ShortcutForm({ initial, onSave, onCancel }: ShortcutFormProps) {
    const [keyword, setKeyword] = useState(initial?.keyword ?? '');
    const [prompt, setPrompt] = useState(initial?.prompt ?? '');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const keywordRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        keywordRef.current?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!keyword.trim() || !prompt.trim()) {
            setErr('กรุณากรอกทั้ง keyword และ prompt');
            return;
        }
        setSaving(true);
        setErr(null);
        try {
            await onSave(keyword.trim(), prompt.trim());
        } catch (ex) {
            setErr(ex instanceof Error ? ex.message : 'เกิดข้อผิดพลาด');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form
            onSubmit={(e) => void handleSubmit(e)}
            className="space-y-2 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3"
        >
            <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Chip label (keyword)
                </label>
                <input
                    ref={keywordRef}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    maxLength={40}
                    placeholder="เช่น COD วันนี้"
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                />
            </div>
            <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Prompt ที่ส่งให้ AI
                </label>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="เช่น สรุปยอด COD วันนี้ พร้อมเคสที่ยังค้างชำระ"
                    className="w-full resize-none rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                />
                <p className="mt-0.5 text-right text-[10px] text-slate-600">{prompt.length}/500</p>
            </div>

            {err && (
                <p className="text-[11px] text-rose-400">{err}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                >
                    ยกเลิก
                </button>
                <button
                    type="submit"
                    disabled={saving || !keyword.trim() || !prompt.trim()}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-40"
                >
                    {saving ? (
                        <span className="flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                            กำลังบันทึก…
                        </span>
                    ) : initial ? (
                        'บันทึก'
                    ) : (
                        'เพิ่ม'
                    )}
                </button>
            </div>
        </form>
    );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function AdminShortcutsManager({ onClose, onShortcutsChanged }: Props) {
    const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [editing, setEditing] = useState<Shortcut | null>(null);
    const [addingNew, setAddingNew] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await apiFetch('/api/admin/ai-chat-shortcuts', 'GET');
            setShortcuts((res?.shortcuts ?? []) as Shortcut[]);
        } catch (e) {
            setFetchError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Close on Escape or F1
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'F1') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const handleToggle = useCallback(async (id: number, active: boolean) => {
        await apiFetch(`/api/admin/ai-chat-shortcuts/${id}`, 'PATCH', { is_active: active });
        setShortcuts((prev) =>
            prev.map((s) => (s.id === id ? { ...s, is_active: active } : s)),
        );
        onShortcutsChanged();
    }, [onShortcutsChanged]);

    const handleDelete = useCallback(async (id: number) => {
        await apiFetch(`/api/admin/ai-chat-shortcuts/${id}`, 'DELETE');
        setShortcuts((prev) => prev.filter((s) => s.id !== id));
        onShortcutsChanged();
    }, [onShortcutsChanged]);

    const handleSaveEdit = useCallback(
        async (keyword: string, prompt: string) => {
            if (!editing) return;
            const res = await apiFetch(`/api/admin/ai-chat-shortcuts/${editing.id}`, 'PATCH', {
                keyword,
                prompt,
            });
            const updated = (res as { shortcut: Shortcut }).shortcut;
            setShortcuts((prev) => prev.map((s) => (s.id === editing.id ? updated : s)));
            setEditing(null);
            onShortcutsChanged();
        },
        [editing, onShortcutsChanged],
    );

    const handleSaveNew = useCallback(
        async (keyword: string, prompt: string) => {
            const res = await apiFetch('/api/admin/ai-chat-shortcuts', 'POST', {
                keyword,
                prompt,
                sort_order: shortcuts.length,
            });
            const created = (res as { shortcut: Shortcut }).shortcut;
            setShortcuts((prev) => [...prev, created]);
            setAddingNew(false);
            onShortcutsChanged();
        },
        [shortcuts.length, onShortcutsChanged],
    );

    return (
        /* Backdrop */
        <div
            ref={overlayRef}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === overlayRef.current) onClose();
            }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

            {/* Panel */}
            <div
                className="relative flex max-h-[min(90vh,36rem)] w-[min(calc(100vw-2rem),26rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-950 shadow-2xl shadow-black/60 ring-1 ring-white/[0.03]"
                role="dialog"
                aria-label="จัดการ Shortcuts"
            >
                {/* Header */}
                <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3.5">
                    <div>
                        <h2 className="text-[14px] font-semibold text-slate-100">จัดการ Shortcuts</h2>
                        <p className="mt-0.5 text-[11px] text-slate-500">F1 เพื่อเปิด/ปิด</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                        aria-label="ปิด"
                    >
                        <X className="h-4.5 w-4.5" aria-hidden />
                    </button>
                </header>

                {/* Body */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
                    {loading ? (
                        <div className="flex flex-1 items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                        </div>
                    ) : fetchError ? (
                        <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2.5 text-[12px] text-rose-300">
                            {fetchError}
                            <button
                                type="button"
                                onClick={() => void load()}
                                className="ml-2 underline hover:no-underline"
                            >
                                ลองใหม่
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {shortcuts.length === 0 && !addingNew && (
                                <p className="py-8 text-center text-[12px] text-slate-600">
                                    ยังไม่มี shortcuts — กด + เพื่อเพิ่ม
                                </p>
                            )}

                            {shortcuts.map((s) =>
                                editing?.id === s.id ? (
                                    <ShortcutForm
                                        key={s.id}
                                        initial={s}
                                        onSave={handleSaveEdit}
                                        onCancel={() => setEditing(null)}
                                    />
                                ) : (
                                    <ShortcutRow
                                        key={s.id}
                                        shortcut={s}
                                        onToggle={handleToggle}
                                        onEdit={(sc) => {
                                            setAddingNew(false);
                                            setEditing(sc);
                                        }}
                                        onDelete={handleDelete}
                                    />
                                ),
                            )}

                            {addingNew && (
                                <ShortcutForm
                                    onSave={handleSaveNew}
                                    onCancel={() => setAddingNew(false)}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!loading && !fetchError && (
                    <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
                        <button
                            type="button"
                            disabled={addingNew || editing !== null}
                            onClick={() => {
                                setEditing(null);
                                setAddingNew(true);
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2.5 text-[12px] text-slate-500 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:text-indigo-300 disabled:pointer-events-none disabled:opacity-40"
                        >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            เพิ่ม shortcut ใหม่
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
