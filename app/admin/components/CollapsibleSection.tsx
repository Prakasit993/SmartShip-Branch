'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * CollapsibleSection — reusable wrapper สำหรับย่อ/ขยาย card
 *
 * - Persist state ใน localStorage (`jt-warehouse-section:{id}`)
 * - คลิกที่ header → toggle
 * - Default collapsed/expanded ตาม prop — ถ้าผู้ใช้กดเปลี่ยน จะจำใน localStorage
 * - Summary แสดงข้าง title ตอน collapsed (preview key metrics)
 */

const STORAGE_PREFIX = 'jt-warehouse-section:';

function useCollapsibleState(id: string, defaultCollapsed: boolean): [boolean, () => void] {
    const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);
    const [hydrated, setHydrated] = useState(false);

    // Read localStorage on mount
    useEffect(() => {
        try {
            const saved = window.localStorage.getItem(STORAGE_PREFIX + id);
            if (saved === 'collapsed') setCollapsed(true);
            else if (saved === 'expanded') setCollapsed(false);
            else setCollapsed(defaultCollapsed);
        } catch {
            setCollapsed(defaultCollapsed);
        }
        setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const toggle = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(STORAGE_PREFIX + id, next ? 'collapsed' : 'expanded');
            } catch {
                /* ignore */
            }
            return next;
        });
    }, [id]);

    // Before hydration → trust default to avoid SSR flicker
    return [hydrated ? collapsed : defaultCollapsed, toggle];
}

type Props = {
    id: string;
    icon?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    summary?: ReactNode;            // compact preview เมื่อ collapsed
    badge?: ReactNode;              // status badge เช่น "ผ่านเป้า"
    defaultCollapsed?: boolean;
    children: ReactNode;
    /** override className สำหรับ outer section */
    className?: string;
    /** ถ้า true แสดง border สีตาม tone */
    accentBorderClass?: string;
};

export function CollapsibleSection({
    id,
    icon,
    title,
    subtitle,
    summary,
    badge,
    defaultCollapsed = false,
    children,
    className,
    accentBorderClass,
}: Props) {
    const [collapsed, toggle] = useCollapsibleState(id, defaultCollapsed);

    return (
        <section
            className={
                className ??
                `overflow-hidden rounded-2xl border bg-slate-950/40 transition ${
                    accentBorderClass ?? 'border-slate-800/70'
                }`
            }
        >
            <button
                type="button"
                onClick={toggle}
                aria-expanded={!collapsed}
                aria-controls={`collapsible-${id}-content`}
                className="group flex w-full items-center justify-between gap-3 border-b border-slate-800/40 px-4 py-2.5 text-left transition hover:bg-slate-900/30"
            >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {icon ? <span className="shrink-0">{icon}</span> : null}
                    <h2 className="text-sm font-semibold text-white">{title}</h2>
                    {subtitle ? (
                        <span className="text-xs text-slate-500">{subtitle}</span>
                    ) : null}
                    {badge ? <span className="shrink-0">{badge}</span> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {collapsed && summary ? (
                        <span className="hidden text-xs text-slate-400 sm:inline-flex sm:items-center sm:gap-1">
                            {summary}
                        </span>
                    ) : null}
                    <span className="rounded-lg p-1 text-slate-400 transition group-hover:bg-slate-800/60 group-hover:text-white">
                        {collapsed ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                        ) : (
                            <ChevronUp className="h-4 w-4" aria-hidden />
                        )}
                    </span>
                </div>
            </button>

            {/* Summary บน mobile (เมื่อ collapsed) */}
            {collapsed && summary ? (
                <div className="border-b border-slate-800/40 px-4 py-2 text-xs text-slate-400 sm:hidden">
                    {summary}
                </div>
            ) : null}

            <div
                id={`collapsible-${id}-content`}
                hidden={collapsed}
                className={collapsed ? 'hidden' : 'block'}
            >
                {children}
            </div>
        </section>
    );
}
