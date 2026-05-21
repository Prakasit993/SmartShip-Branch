'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { EN_TO_TH } from './thaiProvinces';

type Geometry =
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] };
type GeoFeature = { type: 'Feature'; properties: { name: string }; geometry: Geometry };
type GeoJson = { type: 'FeatureCollection'; features: GeoFeature[] };

type Hover = { en: string; count: number; x: number; y: number } | null;

const W = 520; // viewBox width (height คำนวณตาม bbox)

/** equirectangular projection ปรับ aspect ด้วย cos(lat กลาง) */
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
        (maxLat - lat) * scale, // invert (SVG y ลงล่าง)
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
    const rings: number[][][] =
        geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
    return rings.map((r) => ringToPath(r, project)).join(' ');
}

/** เติมสีตามความเข้ม (sqrt scale ให้จังหวัดเล็กยังเห็น) บนพื้นมืด */
function fillFor(count: number, max: number): string {
    if (!count || max <= 0) return '#1e293b'; // slate-800 — ไม่มีข้อมูล
    const t = 0.18 + 0.82 * Math.sqrt(count / max);
    return `rgba(56, 189, 248, ${t.toFixed(3)})`; // sky-400 ramp
}

export function ThailandChoropleth({ counts }: { counts: Record<string, number> }) {
    const [geo, setGeo] = useState<GeoJson | null>(null);
    const [hover, setHover] = useState<Hover>(null);

    useEffect(() => {
        let alive = true;
        fetch('/geo/thailand-provinces.json')
            .then((r) => r.json())
            .then((j: GeoJson) => { if (alive) setGeo(j); })
            .catch(() => { /* แสดง fallback ด้านล่าง */ });
        return () => { alive = false; };
    }, []);

    const max = useMemo(() => Math.max(0, ...Object.values(counts)), [counts]);
    const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

    const built = useMemo(() => {
        if (!geo) return null;
        const { project, H } = makeProjection(geo.features);
        const paths = geo.features.map((f) => ({
            en: f.properties.name,
            d: featureToPath(f.geometry, project),
        }));
        return { paths, H };
    }, [geo]);

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/80 to-slate-950/95 shadow-lg shadow-black/20 ring-1 ring-white/[0.04]">
            <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25">
                        <MapPin className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">แผนที่ปลายทางรายจังหวัด</h3>
                        <p className="text-[10px] leading-snug text-slate-600">เข้มมาก = พัสดุเยอะ · จากช่อง dest_province</p>
                    </div>
                </div>
                {/* legend */}
                <div className="hidden items-center gap-2 sm:flex">
                    <span className="text-[10px] text-slate-500">น้อย</span>
                    <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(to right, #1e293b, rgba(56,189,248,1))' }} />
                    <span className="text-[10px] text-slate-500">มาก</span>
                </div>
            </div>

            <div className="relative p-3">
                {!built && (
                    <div className="flex h-64 items-center justify-center text-sm text-slate-500">กำลังโหลดแผนที่…</div>
                )}

                {built && (
                    <svg
                        viewBox={`0 0 ${W} ${Math.ceil(built.H)}`}
                        className="mx-auto block h-auto w-full max-w-[460px]"
                        role="img"
                        aria-label="แผนที่จำนวนพัสดุรายจังหวัด"
                        onMouseLeave={() => setHover(null)}
                    >
                        {built.paths.map((p) => {
                            const count = counts[p.en] || 0;
                            const isHover = hover?.en === p.en;
                            return (
                                <path
                                    key={p.en}
                                    d={p.d}
                                    fill={fillFor(count, max)}
                                    stroke={isHover ? '#f9fafb' : '#0f172a'}
                                    strokeWidth={isHover ? 1.2 : 0.4}
                                    className="cursor-pointer transition-[stroke] duration-100"
                                    onMouseMove={(e) => {
                                        const svg = e.currentTarget.ownerSVGElement;
                                        const rect = svg?.getBoundingClientRect();
                                        setHover({
                                            en: p.en,
                                            count,
                                            x: rect ? e.clientX - rect.left : 0,
                                            y: rect ? e.clientY - rect.top : 0,
                                        });
                                    }}
                                />
                            );
                        })}
                    </svg>
                )}

                {hover && (
                    <div
                        className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-950/95 px-2.5 py-1.5 text-xs shadow-lg"
                        style={{ left: hover.x, top: hover.y - 6 }}
                    >
                        <p className="font-semibold text-white">{EN_TO_TH[hover.en] ?? hover.en}</p>
                        <p className="tabular-nums text-slate-300">
                            {hover.count.toLocaleString('th-TH')} พัสดุ
                            {total > 0 ? <span className="text-slate-500"> · {((hover.count / total) * 100).toFixed(1)}%</span> : null}
                        </p>
                    </div>
                )}
            </div>
        </section>
    );
}
