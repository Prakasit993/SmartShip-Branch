'use client';

import { Fragment, useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, Eye, EyeOff, MapPin, Scale } from 'lucide-react';

/**
 * ตรวจต้นทุน / พื้นที่ปิดงานช้า (ราย AWB)
 * - มุมมอง "ต้นทุน / ปรับน้ำหนัก": จับชิ้นที่ gateway ปรับน้ำหนักผิดปกติ (anomaly)
 * - มุมมอง "พื้นที่ปิดงานช้า": รายการพร้อมจังหวัด/อำเภอ + จำนวนวันที่ใช้ปิดงาน
 *
 * ดึงข้อมูลจาก /api/admin/jt-shipments/cost-area-detail (migration 20260521).
 * ย้ายมาจาก jt-deep-dive-dashboard/SLATab.tsx เพื่อรวมไว้กับ J&T dashboard.
 */

function formatThb(value: number): string {
    return value.toLocaleString('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 0,
    });
}

type CostAreaRow = {
    awbNumber: string;
    senderName: string | null;
    bookingDate: string;
    latestScanTime: string | null;
    destSubdistrict: string | null;
    destDistrict: string | null;
    destProvince: string | null;
    receiverAddress: string | null;
    billableWeightKg: number | null;
    adminBillable: number;
    gatewayBillable: number;
    anomalyRatio: number | null;
    anomalyDiffKg: number;
    isAnomaly: boolean;
    ourCost: number;
    adjustedCost: number;
    signerName: string | null;
    isClosed: boolean;
    daysPending: number | null;
};

const COST_AREA_PAGE = 10;

function ClosedBadge({ isClosed, signerName }: { isClosed: boolean; signerName?: string | null }) {
    if (isClosed) {
        return (
            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                ปิดงานแล้ว{signerName ? ` · ${signerName}` : ''}
            </span>
        );
    }
    return (
        <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            ยังไม่ปิด
        </span>
    );
}

export function CostAreaInspectionSection({
    range,
    apiPath = '/api/admin/jt-shipments/cost-area-detail',
    showCostView = true,
    title = 'ตรวจต้นทุน / พื้นที่ปิดงานช้า',
    subtitle,
}: {
    range: { from: string; to: string };
    /** endpoint ที่ดึงข้อมูล (default = jt) — tiktok ส่ง path ของ tiktok */
    apiPath?: string;
    /** แสดงมุมมอง "ต้นทุน/ปรับน้ำหนัก" ไหม — tiktok ไม่มีต้นทุน ส่ง false (เหลือเฉพาะพื้นที่) */
    showCostView?: boolean;
    title?: string;
    subtitle?: string;
}) {
    const [show, setShow] = useState(false);
    const [viewMode, setViewMode] = useState<'cost' | 'area'>(showCostView ? 'cost' : 'area');
    const [rows, setRows] = useState<CostAreaRow[]>([]);
    const [loadState, setLoadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [openAddr, setOpenAddr] = useState<Set<string>>(new Set());
    const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

    const filterMode = viewMode === 'cost' ? 'anomaly' : 'all';

    const copyAwb = async (awb: string) => {
        const v = awb.trim();
        if (!v) return;
        try {
            await navigator.clipboard.writeText(v);
            setCopiedAwb(v);
            window.setTimeout(() => setCopiedAwb((cur) => (cur === v ? null : cur)), 1500);
        } catch {
            /* ignore clipboard errors */
        }
    };

    useEffect(() => {
        if (!show) return;
        const ctrl = new AbortController();
        setLoadState('loading');
        setError(null);
        const params = new URLSearchParams({
            date_from: range.from,
            date_to: range.to,
            filter: filterMode,
            limit: '300',
            offset: '0',
        });
        fetch(`${apiPath}?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: ctrl.signal,
        })
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ');
                setRows(Array.isArray(json.data) ? json.data : []);
                setPage(0);
                setLoadState('success');
            })
            .catch((e: unknown) => {
                if ((e as { name?: string }).name === 'AbortError') return;
                setError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ');
                setLoadState('error');
            });
        return () => ctrl.abort();
    }, [show, range.from, range.to, filterMode, apiPath]);

    const totalPages = Math.max(1, Math.ceil(rows.length / COST_AREA_PAGE));
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * COST_AREA_PAGE;
    const pageRows = rows.slice(start, start + COST_AREA_PAGE);

    const toggleAddr = (awb: string) =>
        setOpenAddr((prev) => {
            const next = new Set(prev);
            if (next.has(awb)) next.delete(awb);
            else next.add(awb);
            return next;
        });

    return (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        <MapPin className="h-4 w-4 text-sky-400" aria-hidden />
                        {title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                        {subtitle ??
                            `ราย AWB ช่วง ${range.from} – ${range.to} · ${
                                showCostView
                                    ? 'จับชิ้นที่ gateway ปรับน้ำหนักผิดปกติ และพื้นที่ที่ยังไม่ปิดงาน'
                                    : 'พื้นที่ปลายทาง + จำนวนวันที่ใช้ปิดงาน'
                            }`}
                    </p>
                </div>
                {show && (
                    <button
                        type="button"
                        onClick={() => setShow(false)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                        ซ่อน
                    </button>
                )}
            </div>

            {!show ? (
                <div className="mt-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center">
                    <p className="mb-3 text-sm text-slate-400">ข้อมูลถูกซ่อนไว้ กดเพื่อโหลด</p>
                    <button
                        type="button"
                        onClick={() => setShow(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-sky-400"
                    >
                        <Eye className="h-4 w-4" aria-hidden />
                        แสดงข้อมูล
                    </button>
                </div>
            ) : (
                <div className="mt-4 space-y-3">
                    {/* View toggle — ซ่อนเมื่อไม่มีมุมมองต้นทุน (tiktok) */}
                    {showCostView ? (
                        <div className="inline-flex rounded-lg bg-slate-950/70 p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('cost')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                    viewMode === 'cost' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <Scale className="h-3.5 w-3.5" aria-hidden />
                                ต้นทุน / ปรับน้ำหนัก
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('area')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                                    viewMode === 'area' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <MapPin className="h-3.5 w-3.5" aria-hidden />
                                พื้นที่ปิดงานช้า
                            </button>
                        </div>
                    ) : null}

                    {loadState === 'error' ? (
                        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
                            <p className="font-semibold">โหลดข้อมูลไม่สำเร็จ</p>
                            {error && <p className="mt-1 text-red-200/80">{error}</p>}
                            <p className="mt-1 text-xs text-red-200/60">
                                ตรวจสอบว่ารัน migration ของฟังก์ชันรายละเอียดต้นทุน/พื้นที่ใน Supabase แล้ว
                            </p>
                        </div>
                    ) : loadState === 'loading' && rows.length === 0 ? (
                        <div className="space-y-2">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-slate-800/50" />
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/35 p-5 text-center text-sm text-slate-500">
                            {viewMode === 'cost' ? 'ไม่พบชิ้นที่ปรับน้ำหนักผิดปกติในช่วงนี้' : 'ไม่พบรายการในช่วงนี้'}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                {viewMode === 'cost' ? (
                                    <table className="min-w-full text-left text-xs">
                                        <thead className="text-slate-500">
                                            <tr className="border-b border-slate-800 bg-slate-900/30">
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">AWB</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Booking</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ผู้ส่ง</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">admin (กก.)</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">gateway (กก.)</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-rose-300">ปรับเกิน</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-sky-300">ต้นทุนเรา</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-amber-300">ต้นทุนที่ปรับปรุงแล้ว</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">SCAN ล่าสุด</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-900/50 text-slate-300">
                                            {pageRows.map((r) => (
                                                <tr key={r.awbNumber} className={r.isAnomaly ? 'bg-rose-500/[0.06] hover:bg-rose-500/10' : 'hover:bg-slate-900/50'}>
                                                    <td className="whitespace-nowrap px-3 py-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => void copyAwb(r.awbNumber)}
                                                            title={`คลิกเพื่อคัดลอก ${r.awbNumber}`}
                                                            className="inline-flex items-center gap-1 font-mono text-sky-300 underline-offset-2 transition hover:text-sky-200 hover:underline"
                                                        >
                                                            {r.awbNumber}
                                                            {copiedAwb === r.awbNumber ? (
                                                                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.bookingDate || '—'}</td>
                                                    <td className="max-w-[160px] truncate px-3 py-2" title={r.senderName ?? undefined}>{r.senderName || '—'}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.adminBillable.toFixed(2)}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.gatewayBillable.toFixed(2)}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-rose-300">{r.anomalyRatio != null ? `${r.anomalyRatio.toFixed(1)}×` : '—'}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-sky-200">{formatThb(r.ourCost)}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-amber-200">{formatThb(r.adjustedCost)}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.latestScanTime ? r.latestScanTime.slice(0, 16) : '—'}</td>
                                                    <td className="whitespace-nowrap px-3 py-2"><ClosedBadge isClosed={r.isClosed} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="min-w-full text-left text-xs">
                                        <thead className="text-slate-500">
                                            <tr className="border-b border-slate-800 bg-slate-900/30">
                                                <th className="w-8 px-3 py-2.5" />
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">AWB</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Booking</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">สแกนล่าสุด</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">ตำบล</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">อำเภอ</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">จังหวัด</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-amber-300">ใช้เวลาปิด (วัน)</th>
                                                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">สถานะ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-900/50 text-slate-300">
                                            {pageRows.map((r) => {
                                                const open = openAddr.has(r.awbNumber);
                                                return (
                                                    <Fragment key={r.awbNumber}>
                                                        <tr className="hover:bg-slate-900/50">
                                                            <td className="px-3 py-2 text-slate-500">
                                                                {r.receiverAddress ? (
                                                                    <button type="button" onClick={() => toggleAddr(r.awbNumber)} aria-label="ดูที่อยู่">
                                                                        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
                                                                    </button>
                                                                ) : null}
                                                            </td>
                                                            <td className="whitespace-nowrap px-3 py-2 font-mono text-sky-300">{r.awbNumber}</td>
                                                            <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.bookingDate || '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2 text-slate-400">{r.latestScanTime ? r.latestScanTime.slice(0, 16) : '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2">{r.destSubdistrict || '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2">{r.destDistrict || '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2">{r.destProvince || '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums text-amber-300">{r.daysPending ?? '—'}</td>
                                                            <td className="whitespace-nowrap px-3 py-2"><ClosedBadge isClosed={r.isClosed} signerName={r.signerName} /></td>
                                                        </tr>
                                                        {open && r.receiverAddress && (
                                                            <tr className="bg-slate-950/60">
                                                                <td colSpan={9} className="px-4 py-2 text-xs leading-relaxed text-slate-400">
                                                                    <span className="text-slate-500">ที่อยู่ผู้รับ:</span> {r.receiverAddress}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {rows.length > COST_AREA_PAGE && (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                                    <span>
                                        แสดง {start + 1}–{Math.min(start + COST_AREA_PAGE, rows.length)} จาก {rows.length.toLocaleString('th-TH')} รายการ
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                                            disabled={safePage === 0}
                                            className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            ก่อนหน้า
                                        </button>
                                        <span className="tabular-nums text-slate-300">หน้า {safePage + 1}/{totalPages}</span>
                                        <button
                                            type="button"
                                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                            disabled={safePage >= totalPages - 1}
                                            className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            ถัดไป
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
