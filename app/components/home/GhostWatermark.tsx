'use client';

type GhostWatermarkProps = {
  text?: string;
  className?: string;
};

export default function GhostWatermark({ text = 'NYXEL', className = '' }: GhostWatermarkProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
    >
      <span className="nyxel-ghost-watermark font-black uppercase tracking-tighter whitespace-nowrap">
        {text}
      </span>
    </div>
  );
}
