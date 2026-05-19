import { HOME_DEFAULTS } from '@/lib/home-defaults';

type SettingsRow = { key: string; value: unknown };

function getSetting(settings: SettingsRow[] | null | undefined, key: string): string | null {
  const item = settings?.find((s) => s.key === key);
  return item ? String(item.value).replace(/^"|"$/g, '') : null;
}

function getJsonSetting(settings: SettingsRow[] | null | undefined, key: string): unknown {
  const item = settings?.find((s) => s.key === key);
  if (!item) return null;
  try {
    const val = item.value;
    if (Array.isArray(val)) return val;
    if (typeof val === 'object' && val !== null) return val;
    if (typeof val === 'string') {
      if (val.startsWith('[') || val.startsWith('{')) {
        return JSON.parse(val);
      }
      return [val.replace(/^"|"$/g, '')];
    }
    return val;
  } catch {
    return null;
  }
}

const DEFAULT_TITLE = HOME_DEFAULTS.heroTitle;
const DEFAULT_DESCRIPTION = HOME_DEFAULTS.heroSubtitle;

/** One hero carousel slide (stored in `settings.hero_images` JSON). */
export type HeroSlide = {
  url: string;
  /** Accessibility + SEO — shown as img alt on the storefront */
  alt: string;
  /** Optional browser tooltip (use sparingly; prefer meaningful alt) */
  title?: string;
};

const DEFAULT_SLIDE: HeroSlide = {
  url: '/nyxel-hero.svg',
  alt: 'NYXEL — สินค้า IT พรีเมียม',
};

/**
 * Normalizes legacy formats:
 * - `["url1","url2"]`
 * - `[{ url, alt?, title? }]`
 */
export function normalizeHeroSlidesFromRaw(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [DEFAULT_SLIDE];
  }
  const out: HeroSlide[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    let url = '';
    let alt = '';
    let title: string | undefined;
    if (typeof item === 'string') {
      url = item.trim();
      alt = `ภาพโปรโมชันหน้าแรก — รูปที่ ${i + 1}`;
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      url = String(o.url ?? o.src ?? '').trim();
      if (typeof o.alt === 'string' && o.alt.trim()) {
        alt = o.alt.trim();
      } else {
        alt = `ภาพโปรโมชันหน้าแรก — รูปที่ ${i + 1}`;
      }
      if (typeof o.title === 'string' && o.title.trim()) {
        title = o.title.trim();
      }
    }
    if (!url) continue;
    const slide: HeroSlide = { url, alt };
    if (title) slide.title = title;
    out.push(slide);
  }
  return out.length > 0 ? out : [DEFAULT_SLIDE];
}

/** Values for metadata + JSON-LD from the same `settings` rows as the home page. */
export function getHomeSeoFromSettings(settings: SettingsRow[] | null | undefined) {
  const siteName = getSetting(settings, 'site_name') || HOME_DEFAULTS.siteName;
  const title = getSetting(settings, 'hero_title') || DEFAULT_TITLE;
  const description =
    getSetting(settings, 'site_description') ||
    getSetting(settings, 'seo_description') ||
    getSetting(settings, 'hero_subtitle') ||
    DEFAULT_DESCRIPTION;

  const heroImagesRaw = getJsonSetting(settings, 'hero_images');
  const slides = normalizeHeroSlidesFromRaw(heroImagesRaw);
  const first = slides[0];
  const ogImagePath = first?.url?.trim() ? first.url : '/nyxel-hero.svg';
  const ogImageAlt = first?.alt?.trim() || title;

  return {
    siteName,
    title,
    description,
    ogImagePath,
    ogImageAlt,
    contactPhone: getSetting(settings, 'contact_phone'),
    contactAddress: getSetting(settings, 'contact_address'),
  };
}

/** Hero carousel slides for the home page (URLs + alt/title). */
export function getHeroSlidesFromSettings(settings: SettingsRow[] | null | undefined): HeroSlide[] {
  const raw = getJsonSetting(settings, 'hero_images');
  return normalizeHeroSlidesFromRaw(raw);
}

/** @deprecated Use `getHeroSlidesFromSettings` — URLs only */
export function getHeroImagesFromSettings(settings: SettingsRow[] | null | undefined): string[] {
  return getHeroSlidesFromSettings(settings).map((s) => s.url);
}
