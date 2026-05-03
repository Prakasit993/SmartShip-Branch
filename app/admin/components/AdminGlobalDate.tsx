'use client';

import { useEffect, useState } from 'react';
import { useAdminLanguage } from '@app/admin/context/AdminLanguageContext';

type AdminGlobalDateProps = {
    /** แถวบนมือถือ — ข้อความสั้นลง */
    compact?: boolean;
    className?: string;
};

/**
 * วันที่และเวลาปัจจุบันตามภาษาแอดมิน (TH/EN) — เรนเดอร์ฝั่ง client หลัง mount เพื่อหลีกเลี่ยง hydration mismatch
 */
export function AdminGlobalDate({ compact, className = '' }: AdminGlobalDateProps) {
    const { language } = useAdminLanguage();
    const [state, setState] = useState<{ iso: string; label: string } | null>(null);

    useEffect(() => {
        const locale = language === 'th' ? 'th-TH' : 'en-US';

        const dateOpts: Intl.DateTimeFormatOptions = compact
            ? { day: 'numeric', month: 'short', year: 'numeric' }
            : {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
              };

        const timeOpts: Intl.DateTimeFormatOptions = compact
            ? { hour: '2-digit', minute: '2-digit', hour12: false }
            : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

        const tick = () => {
            const d = new Date();
            const dateStr = d.toLocaleDateString(locale, dateOpts);
            const timeStr = d.toLocaleTimeString(locale, timeOpts);
            setState({
                iso: d.toISOString(),
                label: `${dateStr} · ${timeStr}`,
            });
        };

        tick();
        const id = window.setInterval(tick, 1_000);
        return () => window.clearInterval(id);
    }, [language, compact]);

    if (!state) {
        return (
            <span className={`inline-block min-h-[1.25em] min-w-[14ch] tabular-nums ${className}`} aria-hidden>
                &nbsp;
            </span>
        );
    }

    return (
        <time
            dateTime={state.iso}
            className={`tabular-nums ${className}`}
            suppressHydrationWarning
        >
            {state.label}
        </time>
    );
}
