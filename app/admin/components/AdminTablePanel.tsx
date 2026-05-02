import { type ReactNode } from 'react';

type Props = {
    children: ReactNode;
    className?: string;
};

/**
 * ห่อตารางแอดมิน — เลื่อนแนวนอนบนมือถือ + ขอบ/พื้นหลังสม่ำเสมอ
 */
export function AdminTablePanel({ children, className = '' }: Props) {
    return (
        <div
            className={`rounded-2xl border border-zinc-800/90 bg-zinc-950/45 shadow-sm overflow-hidden overflow-x-auto -mx-0.5 sm:mx-0 ${className}`}
        >
            {children}
        </div>
    );
}
