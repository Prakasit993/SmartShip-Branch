'use client';

import { useRef, useEffect, useState } from 'react';

type HomeRevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Extra delay after element enters viewport (ms) */
  delayMs?: number;
};

export default function HomeReveal({ children, className = '', delayMs = 0 }: HomeRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`home-reveal ${visible ? 'home-reveal-visible' : ''} ${className}`.trim()}
      style={
        visible && delayMs > 0
          ? { transitionDelay: `${delayMs}ms` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
