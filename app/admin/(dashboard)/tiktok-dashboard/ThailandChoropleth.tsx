'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { EN_TO_TH } from './thaiProvinces';

type Geometry =
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
type GeoFeature = { type: 'Feature'; properties: { name: string }; geometry: Geometry };
type GeoJson = { type: 'FeatureCollection'; features: GeoFeature[] };

export type MapMetrics = {
    provinces: Record<string, { total: number; notClosed: number; issue: number }>;
    reasons: { reason: string; total: number }[];
    reasonByProvince: Record<string, Record<string, number>>;
};

type Hover = { en: string; x: number; y: number } | null;
type Mode = 'volume' | 'rate';
type Option = { key: string; label: string; mode: Mode };
type Cell = { en: string; value: number; total: number; rate: number };

const W = 520;
const MIN_SAMPLE = 5; // จังหวัดที่พัสดุน้อยกว่านี้ ไม่นำมาคิดสีอัตรา (กัน 1/1=100%)

function makeProjection(features: GeoFeature[]) {
    let minLon = 999, minLat = 999, maxLon = -999, maxLat = -999;
    for (const f of features) {
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        for (const poly of polys) for (const ring of poly) for (const [lon, lat] of ring) {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
    }
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const kx = Math.cos(midLat);
    const lonRange = (maxLon - minLon) * kx || 1;
    const latRange = maxLat - minLat || 1;
    const scale = W / lonRange;
    const H = latRange * scale;
    const project = (lon: number, lat: number): [number, number] => [
        (lon - minLon) * kx * scale,
        (maxLat - lat) * scale,
    ];
    return { project, H };
}

function ringToPath(ring: number[][], project: (lon: number, lat: number) => [number, number]): string {
    let d = '';
    for (let i = 0; i < ring.length; i++) {
        const [x, y] = project(ring[i][0], ring[i][1]);
        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d + 'Z';
}

function featureToPath(geom: Geometry, project: (lon: number, lat: number) => [number, number]): string {
    const rings: number[][][] = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
    return rings.map((r) => ringToPath(r, project)).join(' ');
}

function fillFor(intensity: number): string {
    if (intensity <= 0) return '#1e293b';
    const t = 0.18 + 0.82 * Math.sqrt(Math.min(intensity, 1));
    return `rgba(56, 189, 248, ${t.toFixed(3)})`;
}

export function ThailandChoropleth({
    data,
    fallbackTotals,
}: {
    data: MapMetrics | null;
    fallbackTotals: Record<string, number>;
}) {
    const [geo, setGeo] = useState<GeoJson | null>(null);
    const [hover, setHover] = useState<Hover>(null);
    const [selected, setSelected] = useState('total');

    useEffect(() => {
        let alive = true;
        fetch('/geo/thailand-provinces.json')
            .then((r) => r.json())
            .then((j: GeoJson) => { if (alive) setGeo(j); })
            .catch(() => { /* fallback ด้านล่าง */ });
        return () => { alive = false; };
    }, []);

    // ตัวเลือก dropdown
    const options = useMemo<Option[]>(() => {
        if (!data) return [{ key: 'total', label: 'พัสดุทั้งหมด', mode: 'volume' }];
        const base: Option[] = [
            { key: 'total', label: 'พัสดุทั้งหมด', mode: 'volume' },
            { key: 'notClosed', label: 'ยังไม่ปิดงาน', mode: 'rate' },
            { key: 'issue', label: 'พัสดุมีปัญหา', mode: 'rate' },
        ];
        const reasons = data.reasons.map((r) => ({ key: `r:${r.reason}`, label: r.reason, mode: 'rate' as Mode }));
        return [...base, ...reasons];
    }, [data]);

    const current = options.find((o) => o.key === selected) ?? options[0];

    // คำนวณ value/total/rate รายจังหวัด ตามเมตริกที่เลือก
    const cells = useMemo<Record<string, Cell>>(() => {
        const out: Record<string, Cell> = {};
        const valueOf = (en: string): { value: number; total: number } => {
            if (!data) return { value: fallbackTotals[en] || 0, total: 0 };
            const m = data.provinces[en] ?? { total: 0, notClosed: 0, issue: 0 };
            if (current.key === 'total') return { value: m.total, total: m.total };
            if (current.key === 'notClosed') return { value: m.notClosed, total: m.total };
            if (current.key === 'issue') return { value: m.issue, total: m.total };
            const reason = current.key.slice(2);
            return { value: data.reasonByProvince[reason]?.[en] || 0, total: m.total };
        };
        const allEn = new Set<string>([
            ...Object.keys(data?.provinces ?? {}),
            ...Object.keys(fallbackTotals),
        ]);
        for (const en of allEn) {
            const { value, total } = valueOf(en);
            const rate = total > 0 ? value / total : 0;
            out[en] = { en, value, total, rate };
        }
        return out;
    }, [data, fallbackTotals, current.key]);

    // ค่าสูงสุดสำหรับ normalize สี
    const { maxValue, maxRate } = useMemo(() => {
        let mv = 0, mr = 0;
        for (const c of Object.values(cells)) {
            if (c.value > mv) mv = c.value;
            if (c.total >= MIN_SAMPLE && c.rate > mr) mr = c.rate;
        }
        return { maxValue: mv || 1, maxRate: mr || 1 };
    }, [cells]);

    const intensityOf = (c: Cell): number => {
        if (current.mode === 'volume') return c.value / maxValue;
        if (c.total < MIN_SAMPLE) return 0; // กันสัญญาณรบกวนจากกลุ่มตัวอย่างเล็ก
        return c.rate / maxRate;
    };

    const built = useMemo(() => {
        if (!geo) return null;
        const { project, H } = makeProjection(geo.features);
        return {
            paths: geo.features.map((f) => ({ en: f.properties.name, d: featureToPath(f.geometry, project) })),
            H,
        };
    }, [geo]);

    // รายการข้าง — เรียงตามเมตริก
    const ranked = useMemo(() => {
        const arr = Object.values(cells).filter((c) => c.value > 0);
        if (current.mode === 'rate') {
            arr.sort((a, b) => {
                const aOk = a.total >= MIN_SAMPLE ? 1 : 0;
                const bOk = b.total >= MIN_SAMPLE ? 1 : 0;
                if (aOk !== bOk) return bOk - aOk;
                return b.rate - a.rate;
            });
        } else {
            arr.sort((a, b) => b.value - a.value);
        }
        return arr.slice(0, 15);
    }, [cells, current.mode]);

    const hoverCell = hover ? cells[hover.en] : null;

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/95 shadow-lg shadow-black/20 ring-1 ring-white/[0.04]">
            {/* header + dropdown */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
                        <MapPin className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">แผนที่ปลายทางรายจังหวัด</h3>
                        <p className="text-[10px] leading-snug text-slate-600">
                            {current.mode === 'rate' ? 'เข้มมาก = สัดส่วนปัญหาสูง (% ต่อพัสดุในจังหวัด)' : 'เข้มมาก = พัสดุเยอะ'}
                        </p>
                    </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                    เหตุผล:
                    <select
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                        className="max-w-[200px] truncate rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                    >
                        {options.map((o) => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-5">
                {/* แผนที่ */}
                <div className="relative lg:col-span-3">
                    {!built && <div className="flex h-64 items-center justify-center text-sm text-slate-500">กำลังโหลดแผนที่…</div>}
                    {built && (
                        <svg
                            viewBox={`0 0 ${W} ${Math.ceil(built.H)}`}
                            className="mx-auto block h-auto w-full max-w-[420px]"
                            role="img"
                            aria-label="แผนที่จำนวนพัสดุรายจังหวัด"
                            onMouseLeave={() => setHover(null)}
                        >
                            {built.paths.map((p) => {
                                const c = cells[p.en] ?? { en: p.en, value: 0, total: 0, rate: 0 };
                                const isHover = hover?.en === p.en;
                                return (
                                    <path
                                        key={p.en}
                                        d={p.d}
                                        fill={fillFor(intensityOf(c))}
                                        stroke={isHover ? '#f9fafb' : '#0f172a'}
                                        strokeWidth={isHover ? 1.2 : 0.4}
                                        className="cursor-pointer transition-[stroke] duration-100"
                                        onMouseMove={(e) => {
                                            const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                            setHover({ en: p.en, x: rect ? e.clientX - rect.left : 0, y: rect ? e.clientY - rect.top : 0 });
                                        }}
                                    />
                                );
                            })}
                        </svg>
                    )}
                    {hover && hoverCell && (
                        <div
                            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 text-xs shadow-lg"
                            style={{ left: hover.x, top: hover.y - 6 }}
                        >
                            <p className="font-semibold text-white">{EN_TO_TH[hover.en] ?? hover.en}</p>
                            <p className="tabular-nums text-slate-300">
                                {hoverCell.value.toLocaleString('th-TH')} เคส
                                {current.mode === 'rate' && hoverCell.total > 0 ? (
                                    <span className="text-slate-500"> · {((hoverCell.value / hoverCell.total) * 100).toFixed(1)}% ของ {hoverCell.total.toLocaleString('th-TH')}</span>
                                ) : null}
                            </p>
                        </div>
                    )}
                </div>

                {/* รายการข้าง */}
                <div className="lg:col-span-2">
                    <div className="mb-1.5 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        <span>จังหวัด</span>
                        <span>{current.mode === 'rate' ? 'เคส · %' : 'พัสดุ'}</span>
                    </div>
                    <ol className="max-h-[360px] space-y-0.5 overflow-y-auto pr-1">
                        {ranked.map((c, i) => {
                            const pct = c.total > 0 ? (c.value / c.total) * 100 : 0;
                            const small = current.mode === 'rate' && c.total < MIN_SAMPLE;
                            return (
                                <li key={c.en} className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px] hover:bg-slate-800/40">
                                    <span className="w-4 shrink-0 tabular-nums text-slate-600">{i + 1}</span>
                                    <span className={`min-w-0 flex-1 truncate ${small ? 'text-slate-500' : 'text-slate-200'}`} title={EN_TO_TH[c.en] ?? c.en}>
                                        {EN_TO_TH[c.en] ?? c.en}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-slate-300">{c.value.toLocaleString('th-TH')}</span>
                                    {current.mode === 'rate' && (
                                        <span className={`w-12 shrink-0 text-right tabular-nums ${small ? 'text-slate-600' : 'text-rose-300'}`}>
                                            {pct.toFixed(1)}%
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                        {ranked.length === 0 && <li className="px-2 py-6 text-center text-slate-500">ไม่มีข้อมูล</li>}
                    </ol>
                    {current.mode === 'rate' && (
                        <p className="mt-2 px-1 text-[10px] leading-snug text-slate-600">
                            * จังหวัดที่พัสดุน้อยกว่า {MIN_SAMPLE} ชิ้น (สีจาง) ไม่นำมาคิดความเข้มสี เพื่อกันสัดส่วนที่เพี้ยนจากกลุ่มตัวอย่างเล็ก
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
