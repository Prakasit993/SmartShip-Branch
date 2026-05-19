import NyxelMark from './NyxelMark';

type Props = {
  className?: string;
  /** Hide the wordmark and show only the geometric mark */
  markOnly?: boolean;
  /** Size of the mark in px (default 28) */
  markSize?: number;
};

/**
 * NYXEL brand lockup — geometric mark + wordmark.
 * Wordmark uses inherited font (Geist Sans from layout) so it stays crisp
 * across the site. The "Y" gets the brand accent color.
 */
export default function NyxelLogo({ className, markOnly, markSize = 28 }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ''}`}
      aria-label="NYXEL"
    >
      <NyxelMark
        className="shrink-0"
        style={{ width: markSize, height: markSize }}
      />
      {!markOnly && (
        <span
          className="font-black tracking-tight text-xl sm:text-2xl leading-none select-none"
          style={{ letterSpacing: '0.01em' }}
        >
          N
          <span style={{ color: 'var(--nyxel-accent)' }}>Y</span>
          XEL
        </span>
      )}
    </span>
  );
}
