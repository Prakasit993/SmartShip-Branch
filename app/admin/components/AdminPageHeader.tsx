import { type ReactNode } from 'react';

export type AdminPageHeaderProps = {
    title: string;
    description?: string;
    /** ตัวเลขสรุป / badge ต่อท้ายหัวข้อ */
    meta?: ReactNode;
    /** กลุ่มปุ่มด้านขวา */
    actions?: ReactNode;
    /** เนื้อหาก่อนชื่อเรื่อง (เช่น กล่องไอคอน) */
    titleLeft?: ReactNode;
    className?: string;
    /** dark = พื้นหลังเข้ม (ค่าเริ่มต้น), light = การ์ด/พื้นหลังสว่าง */
    tone?: 'dark' | 'light';
};

/**
 * หัวข้อหน้าแอดมินแบบเดียวกันทุกหน้า — รองรับมือถือ + จอกว้าง
 */
export function AdminPageHeader({
    title,
    description,
    meta,
    actions,
    titleLeft,
    className = '',
    tone = 'dark',
}: AdminPageHeaderProps) {
    const titleTone =
        tone === 'light'
            ? 'text-zinc-900 dark:text-white'
            : 'text-white';
    const descTone =
        tone === 'light'
            ? 'text-zinc-600 dark:text-zinc-400'
            : 'text-zinc-400';
    const metaTone =
        tone === 'light'
            ? 'text-zinc-500 dark:text-zinc-500'
            : 'text-zinc-500';

    return (
        <div
            className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${className}`}
        >
            <div className="min-w-0 flex-1">
                <h1
                    className={`text-2xl sm:text-3xl md:text-4xl font-black tracking-tight ${titleTone} flex flex-wrap items-center gap-2 sm:gap-3`}
                >
                    {titleLeft}
                    <span className="min-w-0">{title}</span>
                    {meta ? (
                        <span
                            className={`text-sm sm:text-base font-semibold ${metaTone} whitespace-nowrap`}
                        >
                            {meta}
                        </span>
                    ) : null}
                </h1>
                {description ? (
                    <p
                        className={`${descTone} text-sm sm:text-base mt-2 max-w-3xl leading-relaxed`}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto justify-stretch sm:justify-end">
                    {actions}
                </div>
            ) : null}
        </div>
    );
}
