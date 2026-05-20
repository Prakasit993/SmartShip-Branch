'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTransition, useState, useEffect, useRef } from 'react';

export default function ProductSearch() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();
    const [isPending, startTransition] = useTransition();
    const nameRef = useRef<HTMLInputElement>(null);

    const [name,  setName]  = useState(searchParams.get('name')  || '');
    const [brand, setBrand] = useState(searchParams.get('brand') || '');
    const [pmin,  setPmin]  = useState(searchParams.get('pmin')  || '');
    const [pmax,  setPmax]  = useState(searchParams.get('pmax')  || '');
    const [nameFocused, setNameFocused] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            const p = new URLSearchParams();
            if (name)  p.set('name',  name);
            if (brand) p.set('brand', brand);
            if (pmin)  p.set('pmin',  pmin);
            if (pmax)  p.set('pmax',  pmax);
            startTransition(() => replace(`${pathname}?${p.toString()}`));
        }, 380);
        return () => clearTimeout(t);
    }, [name, brand, pmin, pmax, pathname, replace]);

    const clearAll = () => { setName(''); setBrand(''); setPmin(''); setPmax(''); nameRef.current?.focus(); };

    const removeFilter = (key: 'name' | 'brand' | 'pmin' | 'pmax') => {
        if (key === 'name')  setName('');
        if (key === 'brand') setBrand('');
        if (key === 'pmin')  setPmin('');
        if (key === 'pmax')  setPmax('');
    };

    const hasFilters = name || brand || pmin || pmax;

    const activeFilters = [
        name  && { key: 'name'  as const, label: name,              prefix: '🔍' },
        brand && { key: 'brand' as const, label: `ยี่ห้อ: ${brand}`, prefix: '🏷️' },
        pmin  && { key: 'pmin'  as const, label: `ราคา ≥ ฿${Number(pmin).toLocaleString()}`, prefix: '' },
        pmax  && { key: 'pmax'  as const, label: `ราคา ≤ ฿${Number(pmax).toLocaleString()}`, prefix: '' },
    ].filter(Boolean) as { key: 'name' | 'brand' | 'pmin' | 'pmax'; label: string; prefix: string }[];

    return (
        <div className="w-full max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden bg-zinc-900 dark:bg-zinc-950 ring-1 ring-zinc-800 shadow-xl shadow-black/30">

                {/* Top scan-line */}
                <div
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent transition-opacity duration-300"
                    style={{ opacity: nameFocused ? 0.9 : 0.2 }}
                />
                {/* Left accent bar */}
                <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-cyan-500/60 via-blue-500/40 to-transparent" />

                <div className="p-4 sm:p-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30 flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-white">ค้นหาสินค้า</span>
                                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-cyan-500/70">// SEARCH</span>
                                </div>
                                <p className="text-[11px] text-zinc-500 mt-0.5">กรอกชื่อ ยี่ห้อ หรือช่วงราคาที่ต้องการ</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {isPending ? (
                                <div className="flex items-center gap-1.5 text-cyan-400">
                                    <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="font-mono text-[10px] tracking-widest uppercase text-cyan-400">scanning...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-600">ready</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Row 1: ชื่อสินค้า (full width) */}
                    <div className="relative mb-3">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <svg className={`w-4 h-4 transition-colors duration-200 ${nameFocused ? 'text-cyan-400' : 'text-zinc-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            ref={nameRef}
                            type="text"
                            className="w-full pl-11 pr-10 py-3 rounded-xl bg-zinc-800 dark:bg-black/60 border border-zinc-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none text-white placeholder-zinc-600 text-sm font-medium transition-all duration-200"
                            placeholder="ชื่อสินค้า, รุ่น, รหัส SKU..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onFocus={() => setNameFocused(true)}
                            onBlur={() => setNameFocused(false)}
                        />
                        {name && (
                            <button onClick={() => setName('')} className="absolute inset-y-0 right-3 flex items-center text-zinc-600 hover:text-zinc-300 transition-colors" aria-label="ล้าง">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>

                    {/* Row 2: ยี่ห้อ + ราคาต่ำสุด + ราคาสูงสุด */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">

                        {/* ยี่ห้อ */}
                        <div>
                            <label className="block font-mono text-[10px] tracking-[0.18em] uppercase text-zinc-600 mb-1.5 pl-1">
                                ยี่ห้อ
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                    <span className="text-zinc-600 text-sm">🏷️</span>
                                </div>
                                <input
                                    type="text"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-zinc-800 dark:bg-black/50 border border-zinc-700 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 outline-none text-white placeholder-zinc-700 text-sm font-medium transition-all duration-200"
                                    placeholder="ASUS, Samsung, RTX..."
                                    value={brand}
                                    onChange={(e) => setBrand(e.target.value)}
                                />
                                {brand && (
                                    <button onClick={() => setBrand('')} className="absolute inset-y-0 right-2.5 flex items-center text-zinc-600 hover:text-zinc-300 transition-colors">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ราคาต่ำสุด */}
                        <div>
                            <label className="block font-mono text-[10px] tracking-[0.18em] uppercase text-zinc-600 mb-1.5 pl-1">
                                ราคาต่ำสุด
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-600 text-sm font-mono pointer-events-none select-none">฿</span>
                                <input
                                    type="number"
                                    className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-zinc-800 dark:bg-black/50 border border-zinc-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 outline-none text-white placeholder-zinc-700 text-sm font-medium transition-all duration-200 appearance-none"
                                    placeholder="0"
                                    value={pmin}
                                    onChange={(e) => setPmin(e.target.value)}
                                    min="0"
                                />
                            </div>
                        </div>

                        {/* ราคาสูงสุด */}
                        <div>
                            <label className="block font-mono text-[10px] tracking-[0.18em] uppercase text-zinc-600 mb-1.5 pl-1">
                                ราคาสูงสุด
                            </label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-600 text-sm font-mono pointer-events-none select-none">฿</span>
                                <input
                                    type="number"
                                    className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-zinc-800 dark:bg-black/50 border border-zinc-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 outline-none text-white placeholder-zinc-700 text-sm font-medium transition-all duration-200 appearance-none"
                                    placeholder="100,000"
                                    value={pmax}
                                    onChange={(e) => setPmax(e.target.value)}
                                    min="0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Active filter chips */}
                    {hasFilters && (
                        <div className="flex flex-wrap items-center gap-2 mt-3.5 pt-3.5 border-t border-zinc-800">
                            <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-600 shrink-0">FILTERS:</span>
                            {activeFilters.map((f) => (
                                <button
                                    key={f.key}
                                    onClick={() => removeFilter(f.key)}
                                    className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-red-500/10 hover:ring-red-500/30 hover:text-red-300 transition-all duration-150"
                                >
                                    <span>{f.label}</span>
                                    <span className="w-3.5 h-3.5 rounded-full bg-cyan-500/20 group-hover:bg-red-500/20 flex items-center justify-center transition-colors shrink-0">
                                        <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </span>
                                </button>
                            ))}
                            <button onClick={clearAll} className="ml-auto font-mono text-[10px] tracking-widest uppercase text-zinc-600 hover:text-red-400 transition-colors">
                                CLEAR ALL
                            </button>
                        </div>
                    )}
                </div>

                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
            </div>
        </div>
    );
}
