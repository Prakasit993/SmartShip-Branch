'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';

export default function ProductSearch() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();
    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState(searchParams.get('name') || '');
    const [width, setWidth] = useState(searchParams.get('w') || '');
    const [length, setLength] = useState(searchParams.get('l') || '');
    const [height, setHeight] = useState(searchParams.get('h') || '');

    // Debounce and update URL
    useEffect(() => {
        const handler = setTimeout(() => {
            const params = new URLSearchParams();

            if (name) params.set('name', name);
            if (width) params.set('w', width);
            if (length) params.set('l', length);
            if (height) params.set('h', height);

            startTransition(() => {
                replace(`${pathname}?${params.toString()}`);
            });
        }, 400);

        return () => clearTimeout(handler);
    }, [name, width, length, height, pathname, replace]);

    const clearAll = () => {
        setName('');
        setWidth('');
        setLength('');
        setHeight('');
    };

    const hasFilters = name || width || length || height;

    return (
        <div className="w-full max-w-5xl mx-auto mb-10">
            {/* Search Card */}
            <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-lg">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">ค้นหาสินค้า</h3>
                            <p className="text-xs text-zinc-500">กรอกข้อมูลเพื่อค้นหากล่องที่ต้องการ</p>
                        </div>
                    </div>
                    {isPending && (
                        <div className="flex items-center gap-2 text-blue-600 text-sm">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                            <span>กำลังค้นหา...</span>
                        </div>
                    )}
                </div>

                {/* Search Fields - Single Row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Name Search - Takes 2 columns */}
                    <div className="col-span-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                            <span className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-xs">📦</span>
                            ชื่อสินค้า / รหัส
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-sm font-medium"
                            placeholder="เช่น กล่อง, Box A2, B1..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    {/* Width */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                            <span className="w-5 h-5 rounded-md bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 text-xs">↔</span>
                            กว้าง
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm font-medium"
                                placeholder="30"
                                value={width}
                                onChange={(e) => setWidth(e.target.value)}
                                min="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium">ซม.</span>
                        </div>
                    </div>

                    {/* Length */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                            <span className="w-5 h-5 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 text-xs">↕</span>
                            ยาว
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all text-sm font-medium"
                                placeholder="40"
                                value={length}
                                onChange={(e) => setLength(e.target.value)}
                                min="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium">ซม.</span>
                        </div>
                    </div>

                    {/* Height */}
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                            <span className="w-5 h-5 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 text-xs">↥</span>
                            สูง
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-medium"
                                placeholder="20"
                                value={height}
                                onChange={(e) => setHeight(e.target.value)}
                                min="0"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium">ซม.</span>
                        </div>
                    </div>
                </div>

                {/* Active Filters & Clear Button */}
                {hasFilters && (
                    <div className="flex flex-wrap items-center gap-3 mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-xs text-zinc-500 font-medium">กำลังค้นหา:</span>
                        <div className="flex flex-wrap gap-2 flex-1">
                            {name && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-semibold">
                                    📦 {name}
                                </span>
                            )}
                            {width && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-semibold">
                                    ↔ {width} ซม.
                                </span>
                            )}
                            {length && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-semibold">
                                    ↕ {length} ซม.
                                </span>
                            )}
                            {height && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-semibold">
                                    ↥ {height} ซม.
                                </span>
                            )}
                        </div>
                        <button
                            onClick={clearAll}
                            className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-white hover:bg-red-500 border-2 border-red-200 hover:border-red-500 rounded-xl transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            ล้าง
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
