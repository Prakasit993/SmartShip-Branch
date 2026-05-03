'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Animated counter hook — เลขนับขึ้นจาก 0 ไปถึง target
 * ใช้ easeOutExpo เพื่อให้ตอนต้นเร็ว ตอนท้ายค่อยๆ ช้าลง
 */
export function useAnimatedCounter(
    target: number,
    opts?: { duration?: number; decimals?: number },
): number {
    const duration = opts?.duration ?? 800;
    const decimals = opts?.decimals ?? 0;
    const [display, setDisplay] = useState(0);
    const prevRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const start = prevRef.current;
        const diff = target - start;
        if (Math.abs(diff) < 0.01) {
            setDisplay(target);
            prevRef.current = target;
            return;
        }

        const startTime = performance.now();

        function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = start + diff * eased;
            const factor = Math.pow(10, decimals);
            setDisplay(Math.round(current * factor) / factor);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                setDisplay(target);
                prevRef.current = target;
            }
        }

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [target, duration, decimals]);

    return display;
}
