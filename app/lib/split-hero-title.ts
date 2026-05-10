/**
 * Splits a hero headline into a leading segment (gradient) and the remainder.
 * Uses Thai word boundaries when the text contains Thai script; otherwise whitespace.
 */
export function splitHeroTitle(headline: string): { first: string; rest: string } {
  const t = headline.trim();
  if (!t) return { first: '', rest: '' };

  const hasThai = /[\u0E00-\u0E7F]/.test(t);
  if (hasThai && typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const iter = new Intl.Segmenter('th', { granularity: 'word' });
    for (const seg of iter.segment(t)) {
      if (seg.isWordLike && seg.segment.trim()) {
        const first = seg.segment;
        const end = seg.index + first.length;
        const rest = t.slice(end).trimStart();
        return { first, rest };
      }
    }
    return { first: t, rest: '' };
  }

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: t, rest: '' };
  return { first: parts[0]!, rest: parts.slice(1).join(' ') };
}
