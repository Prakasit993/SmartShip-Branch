'use client';

import { useCallback, useEffect, useState } from 'react';
import { Filter, Loader2, Save } from 'lucide-react';
import type { JtReturnExclusionConfig } from '@/lib/jtReturnExclusion';

function linesToArray(text: string): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of text.split('\n')) {
        const v = raw.trim();
        if (v && !seen.has(v)) {
            seen.add(v);
            out.push(v);
        }
    }
    return out;
}

/**
 * แก้รายชื่อสาขา/พนักงานที่ถือว่า "ปิดงานตีกลับแล้ว" (ตัดออกจากการ์ดพัสดุถูกตีกลับ)
 * โหลด/บันทึกผ่าน /api/admin/jt-shipments/return-exclusion — self-contained
 */
export function JtReturnExclusionEditor({ onSaved }: { onSaved?: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [okMsg, setOkMsg] = useState<string | null>(null);
    const [branchText, setBranchText] = useState('');
    const [staffText, setStaffText] = useState('');

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch('/api/admin/jt-shipments/return-exclusion', {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            const json = (await res.json()) as { exclusion?: JtReturnExclusionConfig; error?: string };
            if (!res.ok) throw new Error(json.error || 'โหลดรายการยกเว้นไม่สำเร็จ');
            setBranchText((json.exclusion?.signBranchNames ?? []).join('\n'));
            setStaffText((json.exclusion?.deliveryStaffIds ?? []).join('\n'));
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'โหลดรายการยกเว้นไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) void fetchConfig();
    }, [open, fetchConfig]);

    const save = useCallback(async () => {
        setSaving(true);
        setErr(null);
        setOkMsg(null);
        try {
            const exclusion: JtReturnExclusionConfig = {
                signBranchNames: linesToArray(branchText),
                deliveryStaffIds: linesToArray(staffText),
            };
            const res = await fetch('/api/admin/jt-shipments/return-exclusion', {
                method: 'PUT',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ exclusion }),
            });
            const json = (await res.json()) as { exclusion?: JtReturnExclusionConfig; error?: string };
            if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');
            setBranchText((json.exclusion?.signBranchNames ?? []).join('\n'));
            setStaffText((json.exclusion?.deliveryStaffIds ?? []).join('\n'));
            setOkMsg('บันทึกแล้ว — อัปเดตการ์ดพัสดุถูกตีกลับ');
            onSaved?.();
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    }, [branchText, staffText, onSaved]);

    return (
        <article className="relative col-span-full flex flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.06] sm:p-5">
            <button
                type="button"
                onClick={() => setOpen((p) => !p)}
                className="flex items-center justify-between gap-3 text-left"
            >
                <span className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
                        <Filter className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                        <span className="block text-sm font-semibold text-slate-200">
                            ตั้งค่ารายการยกเว้น “พัสดุถูกตีกลับ”
                        </span>
                        <span className="block text-[11px] text-slate-500">
                            สาขา/พนักงานที่เซ็นรับแล้วถือว่าปิดงาน — จะไม่ถูกนับในการ์ด
                        </span>
                    </span>
                </span>
                <span className="text-xs text-slate-400">{open ? 'ซ่อน' : 'แก้ไข'}</span>
            </button>

            {open ? (
                <div className="mt-4 flex flex-col gap-4">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลด…
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-300">
                                        สาขาที่เซ็นรับ (sign_branch_name) — 1 บรรทัด/สาขา
                                    </span>
                                    <textarea
                                        value={branchText}
                                        onChange={(e) => setBranchText(e.target.value)}
                                        rows={4}
                                        spellCheck={false}
                                        placeholder="เช่น 04Lam Luk Ka067"
                                        className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-rose-500/60"
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-slate-300">
                                        รหัสพนักงานส่ง (delivery_staff_id) — 1 บรรทัด/รหัส
                                    </span>
                                    <textarea
                                        value={staffText}
                                        onChange={(e) => setStaffText(e.target.value)}
                                        rows={4}
                                        spellCheck={false}
                                        placeholder="เช่น 604911501"
                                        className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-rose-500/60"
                                    />
                                </label>
                            </div>

                            <p className="text-[11px] text-slate-500">
                                เว้นว่างทั้งสองช่อง = ไม่ตัดอะไรเลย (นับพัสดุตีกลับทุกตัว)
                            </p>

                            {err ? <p className="text-sm text-rose-400">{err}</p> : null}
                            {okMsg ? <p className="text-sm text-emerald-400">{okMsg}</p> : null}

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => void save()}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
                                >
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                    ) : (
                                        <Save className="h-4 w-4" aria-hidden />
                                    )}
                                    บันทึก
                                </button>
                            </div>
                        </>
                    )}
                </div>
            ) : null}
        </article>
    );
}
