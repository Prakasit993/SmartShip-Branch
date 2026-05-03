'use client';

import { useCallback, useState } from 'react';
import {
    Banknote,
    BarChart3,
    MapPin,
    Package,
    Pencil,
    Plus,
    RotateCcw,
    Scale,
    Trash2,
    Truck,
    X,
} from 'lucide-react';
import type { JtCustomMetricCardDefinition, JtCustomMetricIcon } from '@/lib/jtCustomMetricCards';
import {
    JT_SHIPMENT_FILTER_COLUMNS,
    JT_SHIPMENT_VALUE_COLUMNS,
    MAX_CUSTOM_METRIC_CARDS,
} from '@/lib/jtCustomMetricCards';
import {
    CUSTOM_METRIC_ICON_TH,
    optionFilterColumn,
    optionValueColumn,
    labelValueColumn,
} from './jtCustomMetricUiTh';

type ComputedRow = {
    id: string;
    title: string;
    subtitle?: string;
    icon: string;
    display: string;
};

const ICON_META: Record<
    JtCustomMetricIcon,
    { Icon: typeof Package; box: string; ring: string; fg: string }
> = {
    package: { Icon: Package, box: 'bg-sky-500/15', ring: 'ring-sky-500/25', fg: 'text-sky-400' },
    banknote: { Icon: Banknote, box: 'bg-amber-500/15', ring: 'ring-amber-500/25', fg: 'text-amber-400' },
    scale: { Icon: Scale, box: 'bg-violet-500/15', ring: 'ring-violet-500/25', fg: 'text-violet-400' },
    'rotate-ccw': { Icon: RotateCcw, box: 'bg-rose-500/15', ring: 'ring-rose-500/25', fg: 'text-rose-400' },
    truck: { Icon: Truck, box: 'bg-emerald-500/15', ring: 'ring-emerald-500/25', fg: 'text-emerald-400' },
    'bar-chart': { Icon: BarChart3, box: 'bg-cyan-500/15', ring: 'ring-cyan-500/25', fg: 'text-cyan-400' },
    'map-pin': { Icon: MapPin, box: 'bg-orange-500/15', ring: 'ring-orange-500/25', fg: 'text-orange-400' },
};

const ICON_KEYS = Object.keys(ICON_META) as JtCustomMetricIcon[];

function emptyForm(): Omit<JtCustomMetricCardDefinition, 'id'> & { id?: string } {
    return {
        title: '',
        subtitle: '',
        icon: 'package',
        agg: 'count',
        valueColumn: 'shipping_fee',
        nonZeroOnly: false,
        filter: undefined,
    };
}

type ModalState =
    | { open: false }
    | { open: true; mode: 'add' }
    | { open: true; mode: 'edit'; id: string };

export function JtDashboardCustomMetrics({
    definitions,
    computed,
    disabled,
    onSave,
}: {
    definitions: JtCustomMetricCardDefinition[];
    computed: ComputedRow[];
    /** โหลดหรือบันทึก */
    disabled?: boolean;
    onSave: (next: JtCustomMetricCardDefinition[]) => Promise<void>;
}) {
    const [modal, setModal] = useState<ModalState>({ open: false });
    const [form, setForm] = useState(() => emptyForm());
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const openAdd = useCallback(() => {
        if (definitions.length >= MAX_CUSTOM_METRIC_CARDS) return;
        setForm(emptyForm());
        setErr(null);
        setModal({ open: true, mode: 'add' });
    }, [definitions.length]);

    const openEdit = useCallback((id: string) => {
        const d = definitions.find((x) => x.id === id);
        if (!d) return;
        setForm({
            id: d.id,
            title: d.title,
            subtitle: d.subtitle ?? '',
            icon: d.icon,
            agg: d.agg,
            valueColumn: d.valueColumn ?? 'shipping_fee',
            nonZeroOnly: d.nonZeroOnly ?? false,
            filter: d.filter,
        });
        setErr(null);
        setModal({ open: true, mode: 'edit', id: d.id });
    }, [definitions]);

    const close = useCallback(() => {
        setModal({ open: false });
        setErr(null);
    }, []);

    const buildDefFromForm = useCallback((): JtCustomMetricCardDefinition | null => {
        const title = form.title.trim();
        if (!title) {
            setErr('กรุณาใส่ชื่อการ์ด');
            return null;
        }
        const id = form.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cm-${Date.now()}`);
        let filter: JtCustomMetricCardDefinition['filter'];
        const fc = form.filter?.column?.trim();
        const fp = form.filter?.pattern?.trim();
        if (fc && fp && (JT_SHIPMENT_FILTER_COLUMNS as readonly string[]).includes(fc)) {
            filter = {
                column: fc,
                mode: form.filter?.mode === 'regex' ? 'regex' : 'contains',
                pattern: fp.slice(0, 500),
            };
            if (filter.mode === 'regex') {
                try {
                    new RegExp(filter.pattern, 'i');
                } catch {
                    setErr('รูปแบบ Regex ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
                    return null;
                }
            }
        }
        const agg = form.agg;
        let valueColumn: string | undefined;
        if (agg === 'sum' || agg === 'avg') {
            const vc = form.valueColumn?.trim() ?? '';
            if (!(JT_SHIPMENT_VALUE_COLUMNS as readonly string[]).includes(vc)) {
                setErr('กรุณาเลือกชนิดยอดเงิน (สำหรับผลรวมหรือค่าเฉลี่ย)');
                return null;
            }
            valueColumn = vc;
        }
        return {
            id,
            title: title.slice(0, 80),
            subtitle: form.subtitle?.trim().slice(0, 200) || undefined,
            icon: form.icon,
            agg,
            valueColumn,
            nonZeroOnly: agg === 'avg' ? Boolean(form.nonZeroOnly) : undefined,
            filter,
        };
    }, [form]);

    const submit = useCallback(async () => {
        const built = buildDefFromForm();
        if (!built) return;
        setSaving(true);
        setErr(null);
        try {
            let next: JtCustomMetricCardDefinition[];
            if (modal.open && modal.mode === 'edit') {
                next = definitions.map((d) => (d.id === built.id ? built : d));
            } else {
                next = [...definitions, built];
            }
            await onSave(next);
            close();
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    }, [buildDefFromForm, close, definitions, modal, onSave]);

    const remove = useCallback(
        async (id: string) => {
            if (!window.confirm('ลบการ์ดนี้?')) return;
            setSaving(true);
            try {
                await onSave(definitions.filter((d) => d.id !== id));
            } finally {
                setSaving(false);
            }
        },
        [definitions, onSave],
    );

    const mapComputed = new Map(computed.map((c) => [c.id, c]));

    return (
        <>
            {definitions.map((def) => {
                const row = mapComputed.get(def.id);
                const meta = ICON_META[def.icon] ?? ICON_META.package;
                const IconC = meta.Icon;
                return (
                    <article
                        key={def.id}
                        className="group relative rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg shadow-black/20 ring-1 ring-white/5 backdrop-blur-sm transition hover:border-slate-700/80"
                    >
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                                type="button"
                                disabled={disabled || saving}
                                onClick={() => openEdit(def.id)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-sky-400"
                                aria-label="แก้ไข"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                disabled={disabled || saving}
                                onClick={() => void remove(def.id)}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                                aria-label="ลบ"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                        <div
                            className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${meta.box} ${meta.fg} ring-1 ${meta.ring}`}
                        >
                            <IconC className="h-5 w-5" aria-hidden />
                        </div>
                        <p className="pr-8 text-sm font-medium leading-snug text-slate-300">{def.title}</p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                            {row?.display ?? '—'}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500">
                            {def.subtitle ||
                                (def.agg === 'count'
                                    ? def.filter
                                        ? 'นับเฉพาะรายการที่ตรงเงื่อนไขกรอง (ช่วงวันตามด้านบน)'
                                        : 'นับรายการทั้งหมดในช่วงวันที่เลือก'
                                    : def.agg === 'sum'
                                      ? `ผลรวม: ${labelValueColumn(def.valueColumn ?? '')}`
                                      : `ค่าเฉลี่ย: ${labelValueColumn(def.valueColumn ?? '')}${
                                            def.nonZeroOnly ? ' · เฉพาะรายการที่มียอดมากกว่า 0' : ''
                                        }`)}
                        </p>
                    </article>
                );
            })}

            {definitions.length < MAX_CUSTOM_METRIC_CARDS ? (
                <button
                    type="button"
                    disabled={disabled || saving}
                    onClick={openAdd}
                    className="flex min-h-[11rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-600/90 bg-slate-950/40 p-5 text-center ring-1 ring-white/[0.04] transition hover:border-sky-500/45 hover:bg-slate-900/50 hover:ring-sky-500/20"
                >
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/90 text-sky-400 ring-1 ring-slate-700">
                        <Plus className="h-7 w-7" strokeWidth={2} aria-hidden />
                    </div>
                    <span className="text-sm font-medium text-slate-300">เพิ่มการ์ดสรุป</span>
                    <span className="mt-1 text-[11px] text-slate-500">
                        ตั้งชื่อ · เลขคำนวณตามช่วงวันที่กรองด้านบน
                    </span>
                </button>
            ) : null}

            {modal.open ? (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="jt-custom-metric-title"
                >
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl ring-1 ring-white/10">
                        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                            <h3 id="jt-custom-metric-title" className="text-lg font-semibold text-white">
                                {modal.mode === 'edit' ? 'แก้ไขการ์ด' : 'เพิ่มการ์ดสรุป'}
                            </h3>
                            <button
                                type="button"
                                onClick={close}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
                                aria-label="ปิด"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-4 px-4 py-4">
                            <label className="block">
                                <span className="text-xs font-medium text-slate-400">ชื่อที่แสดงบนการ์ด</span>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/30 focus:border-sky-500/50 focus:ring-2"
                                    placeholder="ตัวอย่าง: พัสดุตีกลับ, ยอด COD รวม"
                                    maxLength={80}
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-medium text-slate-400">
                                    คำอธิบายใต้ตัวเลข (ถ้าไม่ใส่ ระบบจะสรุปให้อัตโนมัติ)
                                </span>
                                <input
                                    type="text"
                                    value={form.subtitle ?? ''}
                                    onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none ring-sky-500/30 focus:border-sky-500/50 focus:ring-2"
                                    placeholder="ตัวอย่าง: เฉพาะที่สถานะมีคำว่า “ตีกลับ”"
                                    maxLength={200}
                                />
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                    <span className="text-xs font-medium text-slate-400">รูปประกอบ</span>
                                    <select
                                        value={form.icon}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                icon: e.target.value as JtCustomMetricIcon,
                                            }))
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                                    >
                                        {ICON_KEYS.map((k) => (
                                            <option key={k} value={k}>
                                                {CUSTOM_METRIC_ICON_TH[k]}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block">
                                    <span className="text-xs font-medium text-slate-400">วิธีคำนวณ</span>
                                    <select
                                        value={form.agg}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                agg: e.target.value as JtCustomMetricCardDefinition['agg'],
                                            }))
                                        }
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                                    >
                                        <option value="count">นับจำนวนรายการ (พัสดุ)</option>
                                        <option value="sum">รวมยอดเงิน (เลือกชนิดยอดด้านล่าง)</option>
                                        <option value="avg">เฉลี่ยยอดเงิน (เลือกชนิดยอดด้านล่าง)</option>
                                    </select>
                                </label>
                            </div>
                            {(form.agg === 'sum' || form.agg === 'avg') ? (
                                <>
                                    <label className="block">
                                        <span className="text-xs font-medium text-slate-400">ชนิดยอดเงิน</span>
                                        <select
                                            value={form.valueColumn}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, valueColumn: e.target.value }))
                                            }
                                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                                        >
                                            {JT_SHIPMENT_VALUE_COLUMNS.map((c) => (
                                                <option key={c} value={c}>
                                                    {optionValueColumn(c)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {form.agg === 'avg' ? (
                                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(form.nonZeroOnly)}
                                                onChange={(e) =>
                                                    setForm((f) => ({ ...f, nonZeroOnly: e.target.checked }))
                                                }
                                                className="rounded border-slate-600"
                                            />
                                            ใช้เฉพาะรายการที่มียอดมากกว่า 0 (แบบเดียวกับ “ค่าส่งเฉลี่ย” ด้านบน)
                                        </label>
                                    ) : null}
                                </>
                            ) : null}

                            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                                <p className="text-xs font-medium text-slate-400">กรองรายการก่อนคำนวณ (ไม่บังคับ)</p>
                                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                    เฉพาะแถวที่ช่องที่เลือกตรงตามข้อความหรือรูปแบบด้านล่าง · ช่วงวันที่ใช้ชุดเดียวกับช่องกรองด้านบนของหน้านี้
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                    <select
                                        value={form.filter?.column ?? ''}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                filter: {
                                                    column: e.target.value,
                                                    mode: f.filter?.mode ?? 'contains',
                                                    pattern: f.filter?.pattern ?? '',
                                                },
                                            }))
                                        }
                                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white"
                                    >
                                        <option value="">ไม่กรอง — ใช้ทุกแถวในช่วงวันที่</option>
                                        {JT_SHIPMENT_FILTER_COLUMNS.map((c) => (
                                            <option key={c} value={c}>
                                                {optionFilterColumn(c)}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={form.filter?.mode ?? 'contains'}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                filter: {
                                                    column: f.filter?.column ?? 'latest_scan_type',
                                                    mode: e.target.value as 'contains' | 'regex',
                                                    pattern: f.filter?.pattern ?? '',
                                                },
                                            }))
                                        }
                                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white"
                                    >
                                        <option value="contains">มีข้อความนี้</option>
                                        <option value="regex">รูปแบบขั้นสูง (Regex)</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={form.filter?.pattern ?? ''}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                filter: {
                                                    column: f.filter?.column ?? 'latest_scan_type',
                                                    mode: f.filter?.mode ?? 'contains',
                                                    pattern: e.target.value,
                                                },
                                            }))
                                        }
                                        className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs text-white sm:col-span-1"
                                        placeholder="เช่น ตีกลับ หรือคำภาษาอังกฤษ"
                                    />
                                </div>
                            </div>

                            {err ? <p className="text-sm text-rose-400">{err}</p> : null}

                            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                                <button
                                    type="button"
                                    onClick={close}
                                    className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => void submit()}
                                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                                >
                                    {saving ? 'กำลังบันทึก…' : 'บันทึก'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
