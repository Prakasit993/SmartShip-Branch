'use client';

import { Calculator, Database, TrendingUp } from 'lucide-react';

export function FinancialTab() {
    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
                <FinancialMetricCard
                    label="ยอดขายค่าขนส่ง"
                    value="รอต่อ API"
                    hint="รวมค่าขนส่งหลังแปลง shipping_fee เป็นตัวเลข"
                    icon={<TrendingUp className="h-5 w-5" aria-hidden />}
                />
                <FinancialMetricCard
                    label="ต้นทุนรวม"
                    value="รอต่อตารางต้นทุน"
                    hint="จับคู่ราคาขายกับต้นทุนจาก shipping_cost_master"
                    icon={<Database className="h-5 w-5" aria-hidden />}
                />
                <FinancialMetricCard
                    label="กำไรรวม"
                    value="รอต่อข้อมูล"
                    hint="กำไร = ค่าขนส่ง - ต้นทุน"
                    icon={<Calculator className="h-5 w-5" aria-hidden />}
                />
            </div>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-white">
                            วิเคราะห์กำไรค่าขนส่ง
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-400">
                            พื้นที่นี้เตรียมไว้สำหรับกราฟกำไรรายวัน ตารางราคาขายที่ยังไม่มีต้นทุน และรายละเอียดกำไรแยกตามช่วงวันที่
                        </p>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                        Financial
                    </span>
                </div>

                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-5 text-sm text-slate-500">
                    ต่อไปสามารถเรียก View/RPC หรือ API เฉพาะแท็บนี้ เพื่อไม่ให้ query หนักปนกับหน้าแดชบอร์ดหลัก
                </div>
            </section>
        </div>
    );
}

function FinancialMetricCard({
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
        <article className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/75 to-slate-950/80 p-4 ring-1 ring-white/[0.03]">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25">
                {icon}
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold text-white">{value}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p>
        </article>
    );
}
