import type { ReactNode } from 'react';

/**
 * NYXEL unified card — used across home, product, contact, warranty.
 *
 * Variants:
 *   - "lab" (default): full cyber-lab effects — corner brackets, scan-line on
 *     hover, optional index badge + sub-label header. For tech-y sections
 *     (FAQ, Services, feature highlights).
 *   - "calm": stripped — only border-color change + hover lift + soft glow.
 *     For policy / info / warranty / contact cards where the eye needs to
 *     land on copy, not effects.
 *
 * Both variants share rounded-2xl + gradient background + group-hover
 * cyan accent treatment for consistency.
 *
 * Composition: NyxelCard owns the FRAME (border, hover, optional ornaments).
 * Caller provides the BODY via children. Body can use `group-hover:*`
 * Tailwind utilities to respond to card hover (e.g. dividers that grow).
 *
 * Performance: pure server component, CSS-only effects. No JS island.
 * Animations honor prefers-reduced-motion via globals.css.
 */

type Variant = 'lab' | 'calm';

interface NyxelCardProps {
  variant?: Variant;
  /** 1-based index — renders as "01", "02"… in the badge. Omit to hide. Only shown on `lab`. */
  index?: number;
  /** Small uppercase mono label above the divider — e.g. "Q.01", "SERVICE", "STEP". Only shown on `lab`. */
  subLabel?: string;
  /** Right-side text of the mono sub-label (defaults to "NYXEL // CARD"). */
  subLabelTag?: string;
  className?: string;
  /** Set to true for tall cards where extra top padding helps balance the index badge. */
  paddedHeader?: boolean;
  children: ReactNode;
}

export default function NyxelCard({
  variant = 'lab',
  index,
  subLabel,
  subLabelTag = 'NYXEL // CARD',
  className = '',
  paddedHeader = false,
  children,
}: NyxelCardProps) {
  const isLab = variant === 'lab';
  const showHeader = isLab && (index !== undefined || subLabel);

  const variantClasses = isLab
    ? // lab — full effects
      'border-zinc-200 dark:border-zinc-800 hover:border-cyan-400/80 dark:hover:border-cyan-500/60 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/20 dark:hover:shadow-cyan-400/15'
    : // calm — subdued
      'border-zinc-200 dark:border-zinc-800 hover:border-cyan-400/50 dark:hover:border-cyan-500/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-500/10';

  return (
    <article
      className={[
        'nyxel-card group relative h-full rounded-2xl border bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-950 dark:to-black overflow-hidden transition-all duration-300',
        paddedHeader ? 'p-5 sm:p-6' : 'p-5 sm:p-6',
        variantClasses,
        className,
      ].join(' ')}
    >
      {/* Radial gradient on hover (both variants — gentler on calm) */}
      <div
        className={[
          'absolute inset-0 pointer-events-none transition-opacity duration-500',
          isLab
            ? 'opacity-0 group-hover:opacity-100'
            : 'opacity-0 group-hover:opacity-60',
        ].join(' ')}
        aria-hidden
        style={{
          background:
            'radial-gradient(circle at top right, rgb(34 211 238 / 0.08), transparent 60%)',
        }}
      />

      {/* Scan line — lab only */}
      {isLab && (
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-faq-scan pointer-events-none"
          aria-hidden
        />
      )}

      {/* Corner brackets — lab only */}
      {isLab && (
        <>
          <span
            aria-hidden
            className="absolute top-2.5 right-2.5 h-3 w-3 border-t-2 border-r-2 border-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
          <span
            aria-hidden
            className="absolute bottom-2.5 left-2.5 h-3 w-3 border-b-2 border-l-2 border-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        </>
      )}

      {/* Header: index badge + mono sub-label */}
      {showHeader && (
        <div className="flex items-center gap-3 mb-3 relative">
          {index !== undefined && (
            <span
              className="font-mono font-black tabular-nums text-[2.75rem] leading-none text-zinc-200 dark:text-zinc-800 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors duration-300 select-none"
              aria-hidden
            >
              {String(index).padStart(2, '0')}
            </span>
          )}
          {subLabel && (
            <div className="flex flex-col">
              <span className="font-mono text-[10px] tracking-[0.25em] text-cyan-600 dark:text-cyan-400 font-bold uppercase">
                {subLabel}
              </span>
              <span className="font-mono text-[9px] tracking-wider text-zinc-400 dark:text-zinc-600">
                {subLabelTag}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="relative">{children}</div>
    </article>
  );
}
