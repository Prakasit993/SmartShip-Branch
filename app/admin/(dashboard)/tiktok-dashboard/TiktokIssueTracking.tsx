'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Hourglass, RefreshCw, RotateCcw } from 'lucide-react';
import type { IssuesData, StagnantData } from './tiktokDashboardTypes';
import { AwbCell, CopyAllButton, HiddenList, HiddenToggle, IssueCard, ShowMoreButton } from './TiktokIssueCards';
import { AckModal, CustomReasonTextarea, PresetSelect } from './TiktokAckModal';

const ACK_CUSTOM_LABEL = 'อื่นๆ (พิมพ์เอง)';

const RETURN_ACK_PRESETS: ReadonlyArray<{ label: string; mute: boolean }> = [
    { label: 'เคลมแล้ว อนุมัติแล้ว', mute: true },
    { label: 'ไปส่งให้ลูกค้าแล้ว', mute: true },
    { label: 'ส่งคืนให้ลูกค้าแล้ว', mute: true },
    { label: 'สูญหาย', mute: true },
    { label: 'รอตีกลับมา', mute: false },
    { label: ACK_CUSTOM_LABEL, mute: true },
];

const STAGNANT_ACK_PRESETS: ReadonlyArray<string> = [
    'ตรวจสอบแล้ว — ปกติ',
    'ติดต่อขนส่งแล้ว',
    'รออัปเดตสถานะ',
    'ลูกค้ารับทราบแล้ว',
    ACK_CUSTOM_LABEL,
];

const ACK_ENDPOINT = '/api/admin/tiktok-shipments/parcel-acknowledgements';

export function TiktokIssueTracking({ refreshToken }: { refreshToken: number }) {
    const [issues, setIssues] = useState<IssuesData | null>(null);
    const [stagnant, setStagnant] = useState<StagnantData | null>(null);
    const [loading, setLoading] = useState(true);

    const [activeDrilldown, setActiveDrilldown] = useState<'exception' | 'stagnant' | 'return' | null>(null);
    const [showAllIssues, setShowAllIssues] = useState(false);
    const [showAllReturns, setShowAllReturns] = useState(false);
    const [showAllStagnant, setShowAllStagnant] = useState(false);
    const [showReturnHidden, setShowReturnHidden] = useState(false);
    const [showAllReturnHidden, setShowAllReturnHidden] = useState(false);
    const [showStagnantHidden, setShowStagnantHidden] = useState(false);
    const [showAllStagnantHidden, setShowAllStagnantHidden] = useState(false);

    const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);

    // ── Return ack modal ──
    const [ackReturnAwb, setAckReturnAwb] = useState('');
    const [ackPreset, setAckPreset] = useState<string>(RETURN_ACK_PRESETS[0].label);
    const [ackReason, setAckReason] = useState('');
    const [ackMuteAging, setAckMuteAging] = useState(true);
    const [ackLoading, setAckLoading] = useState(false);
    const [ackError, setAckError] = useState<string | null>(null);
    const [restoringReturnAwb, setRestoringReturnAwb] = useState<string | null>(null);

    // ── Stagnant ack modal ──
    const [stagnantAckAwb, setStagnantAckAwb] = useState('');
    const [stagnantAckPreset, setStagnantAckPreset] = useState<string>(STAGNANT_ACK_PRESETS[0]);
    const [stagnantAckReason, setStagnantAckReason] = useState('');
    const [stagnantAckLoading, setStagnantAckLoading] = useState(false);
    const [stagnantAckError, setStagnantAckError] = useState<string | null>(null);
    const [restoringStagnantAwb, setRestoringStagnantAwb] = useState<string | null>(null);

    const loadIssues = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/tiktok-shipments/issues', { credentials: 'include' });
            if (!res.ok) return;
            const json = (await res.json()) as Partial<IssuesData>;
            setIssues({
                exceptionCount: json.exceptionCount ?? 0,
                returnCount: json.returnCount ?? 0,
                topExceptionCases: Array.isArray(json.topExceptionCases) ? json.topExceptionCases : [],
                topReturnTypeCases: Array.isArray(json.topReturnTypeCases) ? json.topReturnTypeCases : [],
                returnHiddenCases: Array.isArray(json.returnHiddenCases) ? json.returnHiddenCases : [],
            });
        } catch {
            /* คงค่าเดิม */
        }
    }, []);

    const loadStagnant = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/tiktok-shipments/stagnant-parcels', { credentials: 'include' });
            if (!res.ok) return;
            const json = (await res.json()) as Partial<StagnantData>;
            setStagnant({
                total: json.total ?? 0,
                cases: Array.isArray(json.cases) ? json.cases : [],
                hidden: Array.isArray(json.hidden) ? json.hidden : [],
            });
        } catch {
            /* คงค่าเดิม */
        }
    }, []);

    const reloadAll = useCallback(async () => {
        setLoading(true);
        await Promise.all([loadIssues(), loadStagnant()]);
        setLoading(false);
    }, [loadIssues, loadStagnant]);

    useEffect(() => {
        void reloadAll();
    }, [reloadAll, refreshToken]);

    /* ─── Copy helpers ─── */
    const copyAwb = useCallback(async (awb: string) => {
        const value = awb.trim();
        if (!value || value === '-') return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedAwb(value);
            setCopyMessage(`คัดลอก AWB ${value} แล้ว`);
            window.setTimeout(() => setCopiedAwb((prev) => (prev === value ? null : prev)), 1800);
            window.setTimeout(() => setCopyMessage(null), 2200);
        } catch {
            setCopyMessage('คัดลอกไม่สำเร็จ กรุณาลองใหม่');
            window.setTimeout(() => setCopyMessage(null), 2200);
        }
    }, []);

    const copyAwbList = useCallback(async (awbs: string[]) => {
        const clean = awbs.map((x) => x.trim()).filter((x) => x && x !== '-');
        if (clean.length === 0) return;
        try {
            await navigator.clipboard.writeText(clean.join('\n'));
            setCopyMessage(`คัดลอก AWB ${clean.length.toLocaleString('th-TH')} รายการแล้ว`);
            window.setTimeout(() => setCopyMessage(null), 2500);
        } catch {
            setCopyMessage('คัดลอกชุด AWB ไม่สำเร็จ');
            window.setTimeout(() => setCopyMessage(null), 2200);
        }
    }, []);

    /* ─── Return ack ─── */
    function openReturnAck(awb: string) {
        setAckReturnAwb(awb);
        setAckPreset(RETURN_ACK_PRESETS[0].label);
        setAckReason(RETURN_ACK_PRESETS[0].label);
        setAckMuteAging(RETURN_ACK_PRESETS[0].mute);
        setAckError(null);
    }
    function handleAckPresetChange(next: string) {
        setAckPreset(next);
        const preset = RETURN_ACK_PRESETS.find((p) => p.label === next);
        if (!preset) return;
        if (preset.label === ACK_CUSTOM_LABEL) {
            setAckReason('');
        } else {
            setAckReason(preset.label);
            setAckMuteAging(preset.mute);
        }
    }
    async function submitReturnAck() {
        const awb = ackReturnAwb.trim();
        const reason = ackReason.trim();
        if (!awb || ackLoading) return;
        if (!reason) {
            setAckError('กรุณาใส่เหตุผลที่รับทราบ');
            return;
        }
        setAckLoading(true);
        setAckError(null);
        try {
            const res = await fetch(ACK_ENDPOINT, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ awb_number: awb, kind: 'return', reason, mute_aging: ackMuteAging, action: 'hide' }),
            });
            if (!res.ok) {
                const o = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(o.error || 'บันทึกการรับทราบไม่สำเร็จ');
            }
            setAckReturnAwb('');
            await reloadAll();
        } catch (e) {
            setAckError(e instanceof Error ? e.message : 'บันทึกการรับทราบไม่สำเร็จ');
        } finally {
            setAckLoading(false);
        }
    }
    async function restoreReturn(awb: string) {
        const value = awb.trim();
        if (!value || restoringReturnAwb) return;
        setRestoringReturnAwb(value);
        try {
            const res = await fetch(ACK_ENDPOINT, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ awb_number: value, kind: 'return', action: 'restore' }),
            });
            if (!res.ok) {
                const o = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(o.error || 'ดึงกลับไม่สำเร็จ');
            }
            await reloadAll();
        } catch (e) {
            setCopyMessage(e instanceof Error ? e.message : 'ดึงกลับไม่สำเร็จ');
            window.setTimeout(() => setCopyMessage(null), 2200);
        } finally {
            setRestoringReturnAwb(null);
        }
    }

    /* ─── Stagnant ack ─── */
    function openStagnantAck(awb: string) {
        setStagnantAckAwb(awb);
        setStagnantAckPreset(STAGNANT_ACK_PRESETS[0]);
        setStagnantAckReason(STAGNANT_ACK_PRESETS[0]);
        setStagnantAckError(null);
    }
    function handleStagnantPresetChange(next: string) {
        setStagnantAckPreset(next);
        setStagnantAckReason(next === ACK_CUSTOM_LABEL ? '' : next);
    }
    async function submitStagnantAck() {
        const awb = stagnantAckAwb.trim();
        const reason = stagnantAckReason.trim();
        if (!awb || stagnantAckLoading) return;
        if (!reason) {
            setStagnantAckError('กรุณาใส่เหตุผลที่รับทราบ');
            return;
        }
        setStagnantAckLoading(true);
        setStagnantAckError(null);
        try {
            const res = await fetch(ACK_ENDPOINT, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ awb_number: awb, kind: 'stagnant', reason, action: 'hide' }),
            });
            if (!res.ok) {
                const o = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(o.error || 'บันทึกการรับทราบไม่สำเร็จ');
            }
            setStagnantAckAwb('');
            await reloadAll();
        } catch (e) {
            setStagnantAckError(e instanceof Error ? e.message : 'บันทึกการรับทราบไม่สำเร็จ');
        } finally {
            setStagnantAckLoading(false);
        }
    }
    async function restoreStagnant(awb: string) {
        const value = awb.trim();
        if (!value || restoringStagnantAwb) return;
        setRestoringStagnantAwb(value);
        try {
            const res = await fetch(ACK_ENDPOINT, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ awb_number: value, kind: 'stagnant', action: 'restore' }),
            });
            if (!res.ok) {
                const o = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(o.error || 'ดึงกลับไม่สำเร็จ');
            }
            await reloadAll();
        } catch (e) {
            setCopyMessage(e instanceof Error ? e.message : 'ดึงกลับไม่สำเร็จ');
            window.setTimeout(() => setCopyMessage(null), 2200);
        } finally {
            setRestoringStagnantAwb(null);
        }
    }

    const exceptionCount = issues?.exceptionCount ?? 0;
    const returnCount = issues?.returnCount ?? 0;
    const stagnantCount = stagnant?.total ?? 0;
    const exceptionCases = issues?.topExceptionCases ?? [];
    const returnCases = issues?.topReturnTypeCases ?? [];
    const returnHidden = issues?.returnHiddenCases ?? [];
    const stagnantCases = stagnant?.cases ?? [];
    const stagnantHidden = stagnant?.hidden ?? [];

    return (
        <section className="space-y-3" aria-label="ติดตามปัญหา TikTok Shop">
            <div className="flex items-center gap-2 px-1">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${loading ? 'animate-pulse bg-slate-600' : 'bg-rose-400'}`} aria-hidden />
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">ติดตามปัญหา</h3>
                <span className="text-[10px] text-slate-600">มีปัญหา / ตกค้าง / ตีกลับ — ตรวจสอบและรับทราบเพื่อซ่อน (ดึงกลับได้)</span>
                {loading ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> กำลังโหลด…
                    </span>
                ) : null}
            </div>

            {/* ── Cards ── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                <IssueCard
                    icon={<AlertCircle className="h-5 w-5" aria-hidden />}
                    tone="rose"
                    label="พัสดุมีปัญหา"
                    value={exceptionCount}
                    hint={exceptionCases[0]?.exception_reason && exceptionCases[0].exception_reason !== '-' ? exceptionCases[0].exception_reason : 'นับเฉพาะรายการที่ยังไม่มีรหัสสาขาปลายทาง'}
                    tooltip="นับจากพัสดุที่ยังไม่มีรหัสสาขาปลายทาง (sign_branch_code ว่าง) และมีเหตุผลปัญหา (exception_reason ไม่ว่าง)"
                    isActive={activeDrilldown === 'exception'}
                    onClick={() => setActiveDrilldown((p) => (p === 'exception' ? null : 'exception'))}
                />
                <IssueCard
                    icon={<Hourglass className="h-5 w-5" aria-hidden />}
                    tone="amber"
                    label="พัสดุตกค้างไม่เคลื่อนไหว"
                    value={stagnantCount}
                    hint="ไม่มี scan ≥ 2 วัน · ยังไม่ปิดงาน"
                    tooltip="พัสดุที่ยังไม่ปิดงาน (signer_name ว่าง) และไม่มีการ scan ≥ 2 วัน (หรือไม่มี scan เลย) — ตัดรายการที่รับทราบและซ่อนไว้แล้ว"
                    isActive={activeDrilldown === 'stagnant'}
                    onClick={() => setActiveDrilldown((p) => (p === 'stagnant' ? null : 'stagnant'))}
                />
                <IssueCard
                    icon={<RotateCcw className="h-5 w-5" aria-hidden />}
                    tone="rose"
                    label="พัสดุถูกตีกลับ"
                    value={returnCount}
                    hint="นับจากรายการที่มีสถานะตีกลับ (ตัดที่รับทราบแล้ว)"
                    tooltip="นับจาก return_type ที่มีค่าจริง (ไม่นับ EMPTY/NULL/-) — ตัดรายการที่รับทราบแล้ว และสาขา/พนักงานคืนที่ยกเว้น"
                    isActive={activeDrilldown === 'return'}
                    onClick={() => setActiveDrilldown((p) => (p === 'return' ? null : 'return'))}
                />
            </div>

            {/* ── Exception drilldown (ดูอย่างเดียว) ── */}
            {activeDrilldown === 'exception' ? (
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 p-3 ring-1 ring-white/[0.03]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">รายการพัสดุมีปัญหา (ยังไม่มีรหัสสาขาปลายทาง)</p>
                        <CopyAllButton onClick={() => void copyAwbList((showAllIssues ? exceptionCases : exceptionCases.slice(0, 3)).map((r) => r.awb_number))} />
                    </div>
                    {exceptionCases.length > 0 ? (
                        <>
                            <div className="mt-2 space-y-1.5 overflow-x-auto">
                                <div className="grid min-w-[940px] grid-cols-[1.6rem_1fr_1.1fr_1fr_1.7fr_1fr] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    <span>#</span><span>เลขพัสดุ</span><span>ผู้ส่ง</span><span>เบอร์ติดต่อ</span><span>เหตุผล</span><span className="text-right">เวลา</span>
                                </div>
                                {(showAllIssues ? exceptionCases : exceptionCases.slice(0, 3)).map((r, idx) => (
                                    <div key={`${r.awb_number}-${idx}`} className="grid min-w-[940px] grid-cols-[1.6rem_1fr_1.1fr_1fr_1.7fr_1fr] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]">
                                        <span className="tabular-nums text-slate-500">{idx + 1}</span>
                                        <AwbCell awb={r.awb_number} copied={copiedAwb === r.awb_number} onCopy={() => void copyAwb(r.awb_number)} />
                                        <span className="min-w-0 truncate text-slate-300" title={r.sender_name}>{r.sender_name}</span>
                                        <span className="min-w-0 truncate tabular-nums text-slate-400" title={r.receiver_phone}>{r.receiver_phone}</span>
                                        <span className="min-w-0 truncate text-rose-200" title={r.exception_reason}>{r.exception_reason}</span>
                                        <span className="min-w-0 truncate text-right tabular-nums text-slate-400" title={r.issue_registered_time}>{r.issue_registered_time !== '-' ? r.issue_registered_time.slice(0, 16) : '-'}</span>
                                    </div>
                                ))}
                            </div>
                            {exceptionCases.length > 3 ? <ShowMoreButton expanded={showAllIssues} extra={exceptionCases.length - 3} onClick={() => setShowAllIssues(!showAllIssues)} /> : null}
                        </>
                    ) : (
                        <p className="mt-2 text-xs text-slate-500">ยังไม่พบรายการที่มีเหตุผลปัญหาและยังไม่มีรหัสสาขาปลายทาง</p>
                    )}
                </div>
            ) : null}

            {/* ── Stagnant drilldown (รับทราบ/ซ่อน/ดึงกลับ) ── */}
            {activeDrilldown === 'stagnant' ? (
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 p-3 ring-1 ring-white/[0.03]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">พัสดุตกค้างไม่เคลื่อนไหว (ไม่มี scan ≥ 2 วัน · ยังไม่ปิดงาน)</p>
                        <div className="flex items-center gap-2">
                            <HiddenToggle active={showStagnantHidden} count={stagnantHidden.length} onClick={() => setShowStagnantHidden((v) => !v)} />
                            <CopyAllButton onClick={() => void copyAwbList((showAllStagnant ? stagnantCases : stagnantCases.slice(0, 5)).map((r) => r.awb_number))} />
                        </div>
                    </div>
                    {stagnantCases.length > 0 ? (
                        <>
                            <div className="mt-2 space-y-1.5 overflow-x-auto">
                                <div className="grid min-w-[1180px] grid-cols-[1.6rem_1fr_0.9fr_1fr_1fr_4.5rem_4.5rem_4.5rem_5rem_5.5rem_1fr_5rem] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    <span>#</span><span>เลขพัสดุ</span><span>วันคีย์</span><span>ผู้ส่ง</span><span>เบอร์ผู้ส่ง</span><span className="text-right">กว้าง</span><span className="text-right">สูง</span><span className="text-right">ยาว</span><span className="text-right">น้ำหนัก</span><span className="text-right">น้ำหนักปริมาตร</span><span className="text-right">scan ล่าสุด</span><span className="text-right">จัดการ</span>
                                </div>
                                {(showAllStagnant ? stagnantCases : stagnantCases.slice(0, 5)).map((r, idx) => (
                                    <div key={`${r.awb_number}-${idx}`} className="grid min-w-[1180px] grid-cols-[1.6rem_1fr_0.9fr_1fr_1fr_4.5rem_4.5rem_4.5rem_5rem_5.5rem_1fr_5rem] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]">
                                        <span className="tabular-nums text-slate-500">{idx + 1}</span>
                                        <AwbCell awb={r.awb_number} copied={copiedAwb === r.awb_number} onCopy={() => void copyAwb(r.awb_number)} />
                                        <span className="min-w-0 truncate tabular-nums text-slate-400">{r.booking_date !== '-' ? r.booking_date.slice(0, 10) : '-'}</span>
                                        <span className="min-w-0 truncate text-slate-300" title={r.sender_name}>{r.sender_name}</span>
                                        <span className="min-w-0 truncate tabular-nums text-slate-400">{r.sender_phone}</span>
                                        <span className="text-right tabular-nums text-slate-400">{r.gateway_width}</span>
                                        <span className="text-right tabular-nums text-slate-400">{r.gateway_height}</span>
                                        <span className="text-right tabular-nums text-slate-400">{r.gateway_length}</span>
                                        <span className="text-right tabular-nums text-slate-300">{r.gateway_weight}</span>
                                        <span className="text-right tabular-nums text-amber-300">{r.gateway_vol_weight}</span>
                                        <span className="min-w-0 truncate text-right tabular-nums text-slate-500">{r.latest_scan_time !== '-' ? r.latest_scan_time.slice(0, 16) : '(ไม่มี scan)'}</span>
                                        <button type="button" onClick={() => openStagnantAck(r.awb_number)} className="justify-self-end rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 transition-colors hover:border-amber-400/50 hover:bg-amber-500/20">รับทราบ</button>
                                    </div>
                                ))}
                            </div>
                            {stagnantCases.length > 5 ? <ShowMoreButton expanded={showAllStagnant} extra={stagnantCases.length - 5} onClick={() => setShowAllStagnant(!showAllStagnant)} /> : null}
                        </>
                    ) : (
                        <p className="mt-2 text-xs text-slate-500">ไม่พบพัสดุที่ตกค้างไม่เคลื่อนไหว ≥ 2 วัน (อาจถูกรับทราบและซ่อนไว้แล้ว)</p>
                    )}
                    {showStagnantHidden ? (
                        <HiddenList
                            title={`รายการที่ซ่อนไว้ (${stagnantHidden.length}) — กด "ดึงกลับ" เพื่อนำกลับเข้ารายการ`}
                            rows={stagnantHidden}
                            expanded={showAllStagnantHidden}
                            onToggleExpand={() => setShowAllStagnantHidden(!showAllStagnantHidden)}
                            copiedAwb={copiedAwb}
                            onCopy={(a) => void copyAwb(a)}
                            restoringAwb={restoringStagnantAwb}
                            onRestore={(a) => void restoreStagnant(a)}
                        />
                    ) : null}
                </div>
            ) : null}

            {/* ── Return drilldown (รับทราบ/ซ่อน/ดึงกลับ) ── */}
            {activeDrilldown === 'return' ? (
                <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 p-3 ring-1 ring-white/[0.03]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">รายการพัสดุถูกตีกลับ (ตัดรายการที่รับทราบแล้ว)</p>
                        <div className="flex items-center gap-2">
                            <HiddenToggle active={showReturnHidden} count={returnHidden.length} onClick={() => setShowReturnHidden((v) => !v)} />
                            <CopyAllButton onClick={() => void copyAwbList((showAllReturns ? returnCases : returnCases.slice(0, 3)).map((r) => r.awb_number))} />
                        </div>
                    </div>
                    {returnCases.length > 0 ? (
                        <>
                            <div className="mt-2 space-y-1.5 overflow-x-auto">
                                <div className="grid min-w-[1040px] grid-cols-[1.6rem_1fr_1.1fr_1fr_1.7fr_1fr_6rem] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    <span>#</span><span>เลขพัสดุ</span><span>ผู้ส่ง</span><span>เบอร์ติดต่อ</span><span>เหตุผล</span><span className="text-right">เวลา</span><span className="text-right">จัดการ</span>
                                </div>
                                {(showAllReturns ? returnCases : returnCases.slice(0, 3)).map((r, idx) => (
                                    <div key={`${r.awb_number}-${idx}`} className="grid min-w-[1040px] grid-cols-[1.6rem_1fr_1.1fr_1fr_1.7fr_1fr_6rem] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]">
                                        <span className="tabular-nums text-slate-500">{idx + 1}</span>
                                        <AwbCell awb={r.awb_number} copied={copiedAwb === r.awb_number} onCopy={() => void copyAwb(r.awb_number)} />
                                        <span className="min-w-0 truncate text-slate-300" title={r.sender_name}>{r.sender_name}</span>
                                        <span className="min-w-0 truncate tabular-nums text-slate-400" title={r.receiver_phone}>{r.receiver_phone}</span>
                                        <span className="min-w-0 truncate text-rose-200" title={r.exception_reason}>{r.exception_reason}</span>
                                        <span className="min-w-0 truncate text-right tabular-nums text-slate-400" title={r.issue_registered_time}>{r.issue_registered_time !== '-' ? r.issue_registered_time.slice(0, 16) : '-'}</span>
                                        <button type="button" onClick={() => openReturnAck(r.awb_number)} className="justify-self-end rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/20">รับทราบ</button>
                                    </div>
                                ))}
                            </div>
                            {returnCases.length > 3 ? <ShowMoreButton expanded={showAllReturns} extra={returnCases.length - 3} onClick={() => setShowAllReturns(!showAllReturns)} /> : null}
                        </>
                    ) : (
                        <p className="mt-2 text-xs text-slate-500">ยังไม่พบรายการพัสดุตีกลับที่ยังไม่ได้รับทราบ</p>
                    )}
                    {showReturnHidden ? (
                        <HiddenList
                            title={`ที่ซ่อนไว้ (${returnHidden.length}) — กด "ดึงกลับ" เพื่อนำกลับเข้ารายการ`}
                            rows={returnHidden}
                            expanded={showAllReturnHidden}
                            onToggleExpand={() => setShowAllReturnHidden(!showAllReturnHidden)}
                            copiedAwb={copiedAwb}
                            onCopy={(a) => void copyAwb(a)}
                            restoringAwb={restoringReturnAwb}
                            onRestore={(a) => void restoreReturn(a)}
                        />
                    ) : null}
                </div>
            ) : null}

            {/* ── Return ack modal ── */}
            {ackReturnAwb ? (
                <AckModal
                    title="รับทราบพัสดุตีกลับ"
                    awb={ackReturnAwb}
                    awbTone="text-emerald-300"
                    note="จะไม่แสดงในรายการตีกลับอีกหลังบันทึก"
                    accent="emerald"
                    loading={ackLoading}
                    error={ackError}
                    onClose={() => setAckReturnAwb('')}
                    onSubmit={() => void submitReturnAck()}
                    canSubmit={Boolean(ackReason.trim())}
                >
                    <PresetSelect value={ackPreset} accent="emerald" options={RETURN_ACK_PRESETS.map((p) => p.label)} onChange={handleAckPresetChange} />
                    {ackPreset === ACK_CUSTOM_LABEL ? (
                        <CustomReasonTextarea value={ackReason} accent="emerald" placeholder="เช่น ตรวจสอบแล้วเป็นรายการที่ดำเนินการเรียบร้อย" onChange={setAckReason} />
                    ) : null}
                    <label className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                        <input type="checkbox" checked={ackMuteAging} onChange={(e) => setAckMuteAging(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/40" />
                        <span className="text-xs text-slate-300">
                            <span className="font-medium text-slate-200">ปิดเรื่องแล้ว — ซ่อนจากรายการ</span>
                            <span className="mt-0.5 block text-slate-500">ติ๊กถ้าเคสนี้ดำเนินการเสร็จ (เคลม/ส่งคืน/ไปส่ง/สูญหาย). ถอดถ้ายังต้องตามต่อ (เช่น &quot;รอตีกลับมา&quot;)</span>
                        </span>
                    </label>
                </AckModal>
            ) : null}

            {/* ── Stagnant ack modal ── */}
            {stagnantAckAwb ? (
                <AckModal
                    title="รับทราบพัสดุตกค้าง"
                    awb={stagnantAckAwb}
                    awbTone="text-amber-300"
                    note="จะถูกซ่อนจากการ์ดหลังบันทึก (ดึงกลับได้ภายหลัง)"
                    accent="amber"
                    loading={stagnantAckLoading}
                    error={stagnantAckError}
                    onClose={() => setStagnantAckAwb('')}
                    onSubmit={() => void submitStagnantAck()}
                    canSubmit={Boolean(stagnantAckReason.trim())}
                >
                    <PresetSelect value={stagnantAckPreset} accent="amber" options={[...STAGNANT_ACK_PRESETS]} onChange={handleStagnantPresetChange} />
                    {stagnantAckPreset === ACK_CUSTOM_LABEL ? (
                        <CustomReasonTextarea value={stagnantAckReason} accent="amber" placeholder="เช่น ตรวจสอบแล้ว ขนส่งยืนยันกำลังนำจ่าย" onChange={setStagnantAckReason} />
                    ) : null}
                </AckModal>
            ) : null}

            {copyMessage ? (
                <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs font-medium text-slate-200 shadow-xl shadow-black/30">{copyMessage}</div>
            ) : null}
        </section>
    );
}
