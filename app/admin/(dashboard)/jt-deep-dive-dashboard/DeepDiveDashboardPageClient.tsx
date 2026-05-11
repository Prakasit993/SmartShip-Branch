'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@app/admin/components/AdminPageHeader';
import { AiFinancialReportCard } from './AiFinancialReportCard';
import { DeepDiveDashboardTabs } from './DeepDiveDashboardTabs';
import { N8nWebhookFileUpload } from './N8nWebhookFileUpload';

type Props = {
    /** false เมื่อตั้ง ENABLE_N8N_FILE_UPLOAD=false */
    showN8nFileUpload?: boolean;
};

export function DeepDiveDashboardPageClient({ showN8nFileUpload = true }: Props) {
    const [hideAllNumbers, setHideAllNumbers] = useState(true);

    return (
        <div className="space-y-6 pb-20">
            <div className="relative">
                <AdminPageHeader
                    className="pr-14"
                    title="แดชบอร์ดวิเคราะห์เชิงลึกด้านขนส่ง"
                    description="แยกมุมมองเป็น 2 ส่วน คือ วิเคราะห์กำไร และวิเคราะห์การจัดส่ง เพื่อให้ติดตามตัวเลขสำคัญได้ง่าย อ่านเข้าใจเร็ว และใช้คำอธิบายมาตรฐานเดียวกัน"
                    tone="dark"
                    meta={
                        <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/30">
                            ขนส่ง · วิเคราะห์เชิงลึก
                        </span>
                    }
                />
                {showN8nFileUpload ? (
                    <div className="absolute right-0 top-0 z-10">
                        <N8nWebhookFileUpload />
                    </div>
                ) : null}
            </div>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/45 p-4 ring-1 ring-white/[0.03]">
                <p className="text-xs leading-relaxed text-slate-400">
                    หน้านี้เริ่มต้นด้วยโหมดซ่อนตัวเลขทุกครั้ง กดปุ่มเพื่อแสดงหรือซ่อนตัวเลขทั้งหมดได้ทันที
                </p>
                <button
                    type="button"
                    onClick={() => setHideAllNumbers((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white"
                    aria-pressed={hideAllNumbers}
                >
                    {hideAllNumbers ? (
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {hideAllNumbers ? 'แสดงตัวเลขทั้งหมด' : 'ซ่อนตัวเลขทั้งหมด'}
                </button>
            </section>

            <AiFinancialReportCard />

            <div className="relative">
                <div
                    className={hideAllNumbers ? 'pointer-events-none select-none blur-[6px]' : ''}
                    aria-hidden={hideAllNumbers}
                >
                    <DeepDiveDashboardTabs />
                </div>

                {hideAllNumbers ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-950/35 p-4">
                        <div className="max-w-md rounded-xl border border-slate-700 bg-slate-950/95 px-4 py-3 text-center shadow-xl shadow-black/25">
                            <p className="text-sm font-semibold text-white">ซ่อนข้อมูลตัวเลขอยู่</p>
                            <p className="mt-1 text-xs leading-relaxed text-slate-400">
                                กดปุ่ม &quot;แสดงตัวเลขทั้งหมด&quot; ด้านบนเพื่อเปิดดู KPI และรายละเอียดการคำนวณ
                            </p>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
