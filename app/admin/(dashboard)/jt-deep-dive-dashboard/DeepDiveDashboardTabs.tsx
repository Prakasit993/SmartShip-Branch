'use client';

import dynamic from 'next/dynamic';
import { BarChart3, Clock3, GitCompareArrows } from 'lucide-react';
import { useState } from 'react';

const FinancialTab = dynamic(
    () => import('./FinancialTab').then((mod) => mod.FinancialTab),
    {
        loading: () => <TabLoading label="กำลังโหลดแท็บวิเคราะห์กำไร..." />,
    },
);

const SLATab = dynamic(
    () => import('./SLATab').then((mod) => mod.SLATab),
    {
        loading: () => <TabLoading label="กำลังโหลดแท็บวิเคราะห์การจัดส่ง..." />,
    },
);

const ReconciliationTab = dynamic(
    () => import('./ReconciliationTab').then((mod) => mod.ReconciliationTab),
    {
        loading: () => <TabLoading label="กำลังโหลดแท็บกระทบยอด..." />,
    },
);

type DeepDiveTabKey = 'financial' | 'sla' | 'reconciliation';

const TABS: Array<{
    key: DeepDiveTabKey;
    label: string;
    description: string;
    icon: React.ReactNode;
}> = [
    {
        key: 'financial',
        label: 'วิเคราะห์กำไร',
        description: 'รายได้ ต้นทุน และกำไรจากงานขนส่ง',
        icon: <BarChart3 className="h-4 w-4" aria-hidden />,
    },
    {
        key: 'sla',
        label: 'วิเคราะห์การจัดส่ง',
        description: 'เคสล่าช้า COD ผิดปกติ และงานปฏิบัติการ',
        icon: <Clock3 className="h-4 w-4" aria-hidden />,
    },
    {
        key: 'reconciliation',
        label: 'กระทบยอด',
        description: 'เปรียบเทียบต้นทุนเราคำนวณ vs ยอด J\u0026T เรียกเก็บจริง',
        icon: <GitCompareArrows className="h-4 w-4" aria-hidden />,
    },
];

export function DeepDiveDashboardTabs() {
    const [activeTab, setActiveTab] = useState<DeepDiveTabKey>('financial');

    return (
        <section className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-3 shadow-xl shadow-black/10 ring-1 ring-white/[0.03] sm:p-4">
            <div
                role="tablist"
                aria-label="แท็บแดชบอร์ดวิเคราะห์เชิงลึก"
                className="grid gap-2 md:grid-cols-3"
            >
                {TABS.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-controls={`deep-dive-panel-${tab.key}`}
                            id={`deep-dive-tab-${tab.key}`}
                            onClick={() => setActiveTab(tab.key)}
                            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                                active
                                    ? 'border-sky-500/50 bg-sky-500/12 text-white shadow-lg shadow-sky-950/25 ring-1 ring-sky-500/20'
                                    : 'border-slate-800 bg-slate-900/55 text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-200'
                            }`}
                        >
                            <span className="flex items-center gap-2 text-sm font-semibold">
                                <span className={active ? 'text-sky-300' : 'text-slate-500'}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                                {tab.description}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-4">
                {activeTab === 'financial' ? (
                    <div
                        role="tabpanel"
                        id="deep-dive-panel-financial"
                        aria-labelledby="deep-dive-tab-financial"
                    >
                        <FinancialTab />
                    </div>
                ) : null}

                {activeTab === 'sla' ? (
                    <div
                        role="tabpanel"
                        id="deep-dive-panel-sla"
                        aria-labelledby="deep-dive-tab-sla"
                    >
                        <SLATab />
                    </div>
                ) : null}

                {activeTab === 'reconciliation' ? (
                    <div
                        role="tabpanel"
                        id="deep-dive-panel-reconciliation"
                        aria-labelledby="deep-dive-tab-reconciliation"
                    >
                        <ReconciliationTab />
                    </div>
                ) : null}
            </div>
        </section>
    );
}

function TabLoading({ label }: { label: string }) {
    return (
        <div className="space-y-4">
            {/* Header skeleton */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="h-4 w-4 animate-pulse rounded-full bg-slate-700" />
                <span className="text-sm text-slate-400">{label}</span>
            </div>

            {/* Metric cards skeleton — matches the 3-column KPI grid */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/85 to-slate-950/90 p-2.5 ring-1 ring-white/[0.03]"
                    >
                        <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-800" />
                            <div className="h-3 w-16 animate-pulse rounded bg-slate-800" />
                        </div>
                        <div className="h-7 w-32 animate-pulse rounded bg-slate-800" />
                    </div>
                ))}
            </div>

            {/* Content area skeleton */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="space-y-3">
                    <div className="h-4 w-40 animate-pulse rounded bg-slate-800" />
                    <div className="h-3 w-64 animate-pulse rounded bg-slate-800/60" />
                    <div className="mt-4 h-32 w-full animate-pulse rounded-xl bg-slate-800/40" />
                </div>
            </div>
        </div>
    );
}
