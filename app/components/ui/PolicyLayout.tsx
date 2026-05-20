import type { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Shared layout for policy / info pages (cookie-policy, privacy-policy, terms,
 * future warranty / shipping-info).
 *
 * Brings the lab-style hero treatment (used on /contact and home FAQ/Services)
 * to long-form prose pages so the brand identity stays consistent without
 * imposing card chrome on multi-paragraph content.
 *
 * Pure server component, CSS-only. Caller passes the policy body as children
 * and wraps it in their own `.prose` block if desired.
 */

interface PolicyLayoutProps {
  /** Breadcrumb label for current page, e.g. "นโยบายคุกกี้" / "Cookie Policy" */
  breadcrumb: string;
  /** Mono lab pill text — e.g. "// COOKIE.POLICY" or "// TERMS.V1" */
  labTag: string;
  /** Page title — h1 */
  title: string;
  /** Optional last-updated timestamp shown below title */
  lastUpdated?: string;
  /** Optional intro paragraph below title (helpful for SEO + skim-reading) */
  lead?: ReactNode;
  /** Optional tiny mark below the dashed line — e.g. "V.1 · 2026.05" */
  versionMark?: string;
  /** Home breadcrumb label override (defaults to "หน้าแรก") */
  homeLabel?: string;
  /** Page body — usually a .prose wrapper with section blocks */
  children: ReactNode;
}

export default function PolicyLayout({
  breadcrumb,
  labTag,
  title,
  lastUpdated,
  lead,
  versionMark,
  homeLabel = 'หน้าแรก',
  children,
}: PolicyLayoutProps) {
  return (
    <div className="home-typography min-h-[70vh] bg-[var(--background)] font-sans">
      {/* Hero — matches /contact lab-style */}
      <header className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black">
        {/* Ambient cyan blobs */}
        <div className="hidden md:block absolute top-0 -left-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" aria-hidden />
        <div className="hidden md:block absolute bottom-0 -right-32 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl" aria-hidden />

        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10">
          {/* Breadcrumb */}
          <nav aria-label="ตำแหน่งในหน้าเว็บ" className="mb-6">
            <ol className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-500 dark:text-zinc-400">
              <li>
                <Link
                  href="/"
                  className="font-medium text-zinc-600 hover:text-cyan-600 underline-offset-4 hover:underline dark:text-zinc-300"
                >
                  {homeLabel}
                </Link>
              </li>
              <li aria-hidden className="text-zinc-300 dark:text-zinc-600">
                /
              </li>
              <li className="font-semibold text-zinc-800 dark:text-zinc-100" aria-current="page">
                {breadcrumb}
              </li>
            </ol>
          </nav>

          {/* Lab pill */}
          <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 font-mono text-[11px] font-bold tracking-[0.25em] uppercase mb-5 ring-1 ring-cyan-500/30 shadow-[0_0_24px_-8px_rgb(34_211_238/0.5)]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {labTag}
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
              style={{ animationDelay: '0.4s' }}
            />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 dark:text-white text-balance tracking-tight">
            {title}
          </h1>

          {lastUpdated && (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{lastUpdated}</p>
          )}

          {lead && (
            <p className="mt-4 max-w-2xl text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed text-pretty">
              {lead}
            </p>
          )}

          {versionMark && (
            <div className="mt-5 flex items-center gap-3">
              <span className="h-px w-12 bg-cyan-500/40" />
              <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-600 dark:text-cyan-400">
                {versionMark}
              </span>
              <span className="h-px w-12 bg-cyan-500/40" />
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <section className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {children}

        {/* Footer nav — back to home + shop */}
        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 border-t border-zinc-200 dark:border-zinc-800 pt-10">
          <Link
            href="/"
            className="text-sm font-semibold text-zinc-600 hover:text-cyan-600 dark:text-zinc-400 dark:hover:text-cyan-400 transition-colors"
          >
            ← {homeLabel}
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-full border-2 border-cyan-500 bg-transparent px-6 py-2.5 text-sm font-bold text-cyan-600 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-950/40 transition-colors"
          >
            มีคำถาม? ติดต่อเรา
          </Link>
        </div>
      </section>
    </div>
  );
}
