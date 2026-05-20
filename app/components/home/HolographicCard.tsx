'use client';

import { useRef, useState, useCallback } from 'react';

type HolographicCardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function HolographicCard({ children, className = '' }: HolographicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glowStyle, setGlowStyle] = useState<React.CSSProperties>({});
  const [active, setActive] = useState(false);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rx = ((y - cy) / cy) * -12;
      const ry = ((x - cx) / cx) * 12;
      const glowX = (x / rect.width) * 100;
      const glowY = (y / rect.height) * 100;

      setStyle({
        transform: `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.03,1.03,1.03)`,
        transition: 'transform 0.08s ease-out',
      });
      setGlowStyle({
        background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(34,211,238,0.18) 0%, rgba(59,130,246,0.10) 40%, transparent 70%)`,
      });
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setActive(false);
    setStyle({ transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)', transition: 'transform 0.45s ease-out' });
    setGlowStyle({});
  }, []);

  return (
    <div
      ref={cardRef}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={handleMouseLeave}
      className={`relative will-change-transform ${className}`}
    >
      {/* Holographic shimmer overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] z-10 transition-opacity duration-300"
        style={{
          ...glowStyle,
          opacity: active ? 1 : 0,
        }}
      />
      {/* Rainbow foil edge */}
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] z-10 nyxel-holo-foil"
        />
      )}
      {children}
    </div>
  );
}
