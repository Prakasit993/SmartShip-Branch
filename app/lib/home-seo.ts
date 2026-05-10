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
  const heroImages = Array.isArray(heroImagesRaw) && heroImagesRaw.length > 0 ? heroImagesRaw : ['/smartship-storefront.png'];
  const first = heroImages[0];
  const ogImagePath = typeof first === 'string' && first.length > 0 ? first : '/smartship-storefront.png';

  return {
    siteName,
    title,
    description,
    ogImagePath,
    contactPhone: getSetting(settings, 'contact_phone'),
    contactAddress: getSetting(settings, 'contact_address'),
  };
}

/** Hero carousel paths (same rules as previous inline `getJsonSetting('hero_images')`). */
export function getHeroImagesFromSettings(settings: SettingsRow[] | null | undefined): string[] {
  const heroImagesRaw = getJsonSetting(settings, 'hero_images');
  if (Array.isArray(heroImagesRaw) && heroImagesRaw.length > 0) {
    return heroImagesRaw.map((x) => (typeof x === 'string' ? x : String(x)));
  }
  return ['/smartship-storefront.png'];
}
