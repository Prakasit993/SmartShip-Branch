-- SEO overrides for bundles (storefront metadata + primary image alt)
ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE public.bundles ADD COLUMN IF NOT EXISTS image_alt text;

COMMENT ON COLUMN public.bundles.meta_title IS 'Optional <title> / OG title — overrides linked product when set';
COMMENT ON COLUMN public.bundles.meta_description IS 'Optional meta description — overrides linked product when set';
COMMENT ON COLUMN public.bundles.image_alt IS 'Primary bundle image alt (SEO + a11y) — overrides linked product when set';
