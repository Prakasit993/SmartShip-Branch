'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, Hourglass, RefreshCw, RotateCcw } from 'lucide-react';

/* ─── Types (สอดคล้องกับ /api/admin/tiktok-shipments/issues + /stagnant-parcels) ─── */
type ExceptionCase = {
    awb_number: string;
    sender_name: string;
    receiver_name: string;
    receiver_phone: string;
    exception_reason: string;
    issue_registered_time: string;
};
type ReturnCase = ExceptionCase & { return_branch_name: string };
type HiddenCase = {
    awb_number: string;
    reason: string;
    acknowledged_at: string;
    acknowledged_by: string;
};
type StagnantCase = {
    awb_number: string;
    booking_date: string;
    sender_name: string;
    sender_phone: string;
    gateway_width: string;
    gateway_height: string;
    gateway_length: string;
    gateway_weight: string;
    gateway_vol_weight: string;
    latest_scan_time: string;
};

type IssuesData = {
    exceptionCount: number;
    returnCount: number;
    topExceptionCases: ExceptionCase[];
    topReturnTypeCases: ReturnCase[];
    returnHiddenCases: HiddenCase[];
};
type StagnantData = {
    total: number;
    cases: StagnantCase[];
    hidden: HiddenCase[];
};

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
                    isActive={activeDrilldown === 'exception'}
                    onClick={() => setActiveDrilldown((p) => (p === 'exception' ? null : 'exception'))}
                />
                <IssueCard
                    icon={<Hourglass className="h-5 w-5" aria-hidden />}
                    tone="amber"
                    label="พัสดุตกค้างไม่เคลื่อนไหว"
                    value={stagnantCount}
                    hint="ไม่มี scan ≥ 2 วัน · ยังไม่ปิดงาน"
                    isActive={activeDrilldown === 'stagnant'}
                    onClick={() => setActiveDrilldown((p) => (p === 'stagnant' ? null : 'stagnant'))}
                />
                <IssueCard
                    icon={<RotateCcw className="h-5 w-5" aria-hidden />}
                    tone="rose"
                    label="พัสดุถูกตีกลับ"
                    value={returnCount}
                    hint="นับจากรายการที่มีสถานะตีกลับ (ตัดที่รับทราบแล้ว)"
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

/* ─────────── sub-components ─────────── */

const TONE: Record<'rose' | 'amber', { iconBg: string; iconRing: string; iconFg: string; glow: string; active: string }> = {
    rose: { iconBg: 'bg-rose-500/15', iconRing: 'ring-rose-500/25', iconFg: 'text-rose-300', glow: 'bg-rose-500/40', active: 'border-rose-500/60 ring-rose-500/35' },
    amber: { iconBg: 'bg-amber-500/15', iconRing: 'ring-amber-500/25', iconFg: 'text-amber-400', glow: 'bg-amber-500/40', active: 'border-amber-500/60 ring-amber-500/35' },
};

function IssueCard({ icon, tone, label, value, hint, isActive, onClick }: { icon: React.ReactNode; tone: 'rose' | 'amber'; label: string; value: number; hint: string; isActive: boolean; onClick: () => void }) {
    const t = TONE[tone];
    return (
        <article
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            onClick={onClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            className={`group relative flex min-h-0 cursor-pointer flex-col overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900/60 via-slate-900/50 to-slate-950/80 p-4 shadow-lg shadow-black/20 ring-1 backdrop-blur-sm transition-all duration-300 sm:p-5 ${isActive ? `${t.active} shadow-black/20` : 'border-slate-800/80 ring-white/[0.06] hover:-translate-y-0.5 hover:border-slate-600/60 hover:shadow-xl hover:shadow-black/30'}`}
        >
            <div className={`pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full ${t.glow} opacity-20 blur-2xl`} />
            <div className={`relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${t.iconBg} ${t.iconFg} ring-1 ${t.iconRing} transition-transform duration-300 group-hover:scale-110 sm:mb-4 sm:h-11 sm:w-11`}>{icon}</div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-[11px]">{label}</p>
            <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-white sm:mt-2 sm:text-2xl">{value.toLocaleString('th-TH')}</p>
            <p className="mt-auto pt-1.5 text-[10px] leading-snug text-slate-500 sm:pt-2 sm:text-[11px]">{hint}</p>
        </article>
    );
}

function AwbCell({ awb, copied, onCopy }: { awb: string; copied: boolean; onCopy: () => void }) {
    return (
        <button type="button" onClick={onCopy} className="inline-flex min-w-0 items-center gap-1 truncate text-left text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline" title={`คลิกเพื่อคัดลอก ${awb}`}>
            {awb}
            {copied ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden /> : <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />}
        </button>
    );
}

function CopyAllButton({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-600 hover:text-white">
            <Copy className="h-3.5 w-3.5" aria-hidden /> คัดลอก AWB ทั้งชุด
        </button>
    );
}

function HiddenToggle({ active, count, onClick }: { active: boolean; count: number; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${active ? 'border-sky-500/50 bg-sky-500/10 text-sky-200' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:text-white'}`}>
            {active ? 'ซ่อนรายการที่ซ่อนไว้' : `ดูที่ซ่อนไว้ (${count})`}
        </button>
    );
}

function ShowMoreButton({ expanded, extra, onClick }: { expanded: boolean; extra: number; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="mt-2 w-full rounded-lg bg-slate-900/50 py-1.5 text-xs font-medium text-slate-400 ring-1 ring-white/[0.04] transition-colors hover:bg-slate-800/60 hover:text-slate-300">
            {expanded ? 'แสดงน้อยลง' : `ดูเพิ่มเติมอีก ${extra} รายการ`}
        </button>
    );
}

function HiddenList({ title, rows, expanded, onToggleExpand, copiedAwb, onCopy, restoringAwb, onRestore }: {
    title: string;
    rows: HiddenCase[];
    expanded: boolean;
    onToggleExpand: () => void;
    copiedAwb: string | null;
    onCopy: (awb: string) => void;
    restoringAwb: string | null;
    onRestore: (awb: string) => void;
}) {
    return (
        <div className="mt-3 rounded-lg border border-slate-800/70 bg-slate-900/30 p-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            {rows.length > 0 ? (
                <>
                    <div className="space-y-1.5 overflow-x-auto">
                        <div className="grid min-w-[720px] grid-cols-[1.6rem_1fr_1.7fr_1fr_5rem] items-center gap-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            <span>#</span><span>เลขพัสดุ</span><span>เหตุผล</span><span>รับทราบเมื่อ</span><span className="text-right">จัดการ</span>
                        </div>
                        {(expanded ? rows : rows.slice(0, 5)).map((h, idx) => (
                            <div key={`${h.awb_number}-${idx}`} className="grid min-w-[720px] grid-cols-[1.6rem_1fr_1.7fr_1fr_5rem] items-center gap-2 rounded-lg bg-slate-900/45 px-2.5 py-1.5 text-[12px]">
                                <span className="tabular-nums text-slate-500">{idx + 1}</span>
                                <AwbCell awb={h.awb_number} copied={copiedAwb === h.awb_number} onCopy={() => onCopy(h.awb_number)} />
                                <span className="min-w-0 truncate text-slate-300" title={h.reason}>{h.reason}</span>
                                <span className="min-w-0 truncate text-right tabular-nums text-slate-400">{h.acknowledged_at !== '-' ? h.acknowledged_at.slice(0, 16) : '—'}</span>
                                <button type="button" disabled={restoringAwb === h.awb_number} onClick={() => onRestore(h.awb_number)} className="justify-self-end rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200 transition-colors hover:border-sky-400/50 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50">
                                    {restoringAwb === h.awb_number ? '...' : 'ดึงกลับ'}
                                </button>
                            </div>
                        ))}
                    </div>
                    {rows.length > 5 ? <ShowMoreButton expanded={expanded} extra={rows.length - 5} onClick={onToggleExpand} /> : null}
                </>
            ) : (
                <p className="text-xs text-slate-500">ยังไม่มีรายการที่ซ่อนไว้</p>
            )}
        </div>
    );
}

function AckModal({ title, awb, awbTone, note, accent, loading, error, canSubmit, onClose, onSubmit, children }: {
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
    children: React.ReactNode;
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

function PresetSelect({ value, accent, options, onChange }: { value: string; accent: 'emerald' | 'amber'; options: string[]; onChange: (v: string) => void }) {
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

function CustomReasonTextarea({ value, accent, placeholder, onChange }: { value: string; accent: 'emerald' | 'amber'; placeholder: string; onChange: (v: string) => void }) {
    const ring = accent === 'emerald' ? 'ring-emerald-500/25 focus:border-emerald-500/50' : 'ring-amber-500/25 focus:border-amber-500/50';
    return (
        <label className="block">
            <span className="text-xs font-medium text-slate-400">รายละเอียดเพิ่มเติม</span>
            <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={500} placeholder={placeholder} className={`mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:ring-2 ${ring}`} />
        </label>
    );
}
