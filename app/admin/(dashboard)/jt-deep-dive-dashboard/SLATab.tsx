'use client';

import { AlertTriangle, Clock3, PackageCheck } from 'lucide-react';

export function SLATab() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <SlaMetricCard
                    label="ส่งสำเร็จแล้ว"
                    value="รอต่อ API"
                    hint="มีชื่อผู้เซ็นรับแล้ว"
                    icon={<PackageCheck className="h-5 w-5" aria-hidden />}
                />
                <SlaMetricCard
                    label="COD ยังไม่เข้า"
                    value="รอต่อข้อมูล"
                    hint="มียอด COD แต่สถานะยังไม่ชำระ"
                    icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
                />
                <SlaMetricCard
                    label="เกิน 24 ชั่วโมง"
                    value="รอต่อข้อมูล"
                    hint="เซ็นรับเกิน 24 ชั่วโมงแล้ว"
                    icon={<Clock3 className="h-5 w-5" aria-hidden />}
                />
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-white">
                            วิเคราะห์การจัดส่งและ SLA
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">
                            พื้นที่นี้เตรียมไว้สำหรับเคส COD ผิดปกติ รายการส่งสำเร็จแต่เงินยังไม่เข้า และงานติดตามจากทีม Operation
                        </p>
                    </div>
                    <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                        SLA & Operations
                    </span>
                </div>

                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm text-slate-500">
                    ต่อไปสามารถแยก API สำหรับดึงเฉพาะเคสที่ส่งสำเร็จแล้ว มียอด COD แต่เงินยังไม่เข้าเกิน 24 ชั่วโมง
                </div>
            </section>
        </div>
    );
}

function SlaMetricCard({
    label,
    value,
    hint,
    icon,
}: {
    label: string;
    value: string;
    hint: string;
    icon: React.ReactNode;
}) {
    return (
        <article className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/75 to-slate-950/80 p-3 ring-1 ring-white/[0.03]">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/25">
                {icon}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-white">{value}</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>
        </article>
    );
}
