import type { CSSProperties } from 'react';

type Props = {
  className?: string;
  style?: CSSProperties;
  /** Override accent color (defaults to var(--nyxel-accent)) */
  accentColor?: string;
};

/**
 * NYXEL geometric mark — rotated-square frame with stylized "N" stroke.
 * Uses currentColor for the frame and var(--nyxel-accent) for the accent stroke,
 * so it adapts to light/dark theme and any inherited text color.
 */
export default function NyxelMark({ className, style, accentColor }: Props) {
  const accent = accentColor ?? 'var(--nyxel-accent)';
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {/* Hexagonal chip frame */}
      <path
        d="M16 3 L27 9 L27 23 L16 29 L5 23 L5 9 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
      {/* Stylized N inside — two verticals + cyan diagonal */}
      <path
        d="M10.5 11 L10.5 21"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M21.5 11 L21.5 21"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="M10.5 11 L21.5 21"
        stroke={accent}
        strokeWidth="2.75"
        strokeLinecap="round"
      />
      {/* Chip pins — top & bottom anchor dots */}
      <circle cx="16" cy="3" r="1.1" fill={accent} />
      <circle cx="16" cy="29" r="1.1" fill={accent} />
    </svg>
  );
}
