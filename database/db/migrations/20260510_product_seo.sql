-- SEO fields for admin product editor (slug, meta tags, primary image alt)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_alt text;

COMMENT ON COLUMN public.products.slug IS 'URL slug — ASCII a-z0-9 hyphens; unique when set';
COMMENT ON COLUMN public.products.meta_title IS 'Optional <title> override for storefront / sharing';
COMMENT ON COLUMN public.products.meta_description IS 'Optional meta description for search & previews';
COMMENT ON COLUMN public.products.image_alt IS 'Primary image alt text (accessibility + SEO)';

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique_not_null
    ON public.products (slug)
    WHERE slug IS NOT NULL AND btrim(slug) <> '';
