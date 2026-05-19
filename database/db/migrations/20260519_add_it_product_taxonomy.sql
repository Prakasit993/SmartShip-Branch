-- NYXEL rebrand · IT product taxonomy
-- Date: 2026-05-19
-- See: 20260519_add_it_product_taxonomy.md for rationale + example queries
--
-- Adds product attributes needed to sell IT goods (new + future used GPU/RAM/Notebook):
--   condition (new/used/refurbished), warranty_months, brand, model, spec_json
--
-- Safety:
--   - All ADD COLUMN are IF NOT EXISTS — idempotent
--   - All have safe defaults — existing rows unaffected, no NULL conflicts
--   - No CHECK constraint changes on existing columns
--   - Indexes are CREATE IF NOT EXISTS
--
-- Rollback:
--   ALTER TABLE public.products DROP COLUMN condition, DROP COLUMN condition_note,
--     DROP COLUMN warranty_months, DROP COLUMN brand, DROP COLUMN model, DROP COLUMN spec_json;
--   ALTER TABLE public.bundles DROP COLUMN condition, DROP COLUMN condition_note,
--     DROP COLUMN warranty_months, DROP COLUMN brand, DROP COLUMN model, DROP COLUMN spec_json;
--   DROP INDEX IF EXISTS idx_bundles_condition, idx_bundles_brand,
--     idx_bundles_brand_model, idx_products_brand_model;

-- =============================================================================
-- 1) products: source of truth for atomic item attributes
-- =============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'new'
    CHECK (condition IN ('new', 'used', 'refurbished')),
  ADD COLUMN IF NOT EXISTS condition_note text,
  ADD COLUMN IF NOT EXISTS warranty_months int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS spec_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.condition IS
  'Product condition: new | used | refurbished. Drives JSON-LD itemCondition + storefront badge.';
COMMENT ON COLUMN public.products.condition_note IS
  'Free-text condition detail shown when condition != ''new''. e.g. "95% สภาพดี ผ่านการใช้งาน 3 เดือน"';
COMMENT ON COLUMN public.products.warranty_months IS
  'Warranty period in months (0 = no warranty). For ''new'': manufacturer warranty. For ''used''/''refurbished'': shop warranty.';
COMMENT ON COLUMN public.products.brand IS
  'Brand identifier — e.g. ASUS, NVIDIA, Corsair, Apple, Logitech. Used for filtering + Product.brand JSON-LD.';
COMMENT ON COLUMN public.products.model IS
  'Model identifier — e.g. "RTX 4070", "DDR5-5600 32GB", "ROG Strix G15 G513". Used for catalog search.';
COMMENT ON COLUMN public.products.spec_json IS
  'Flexible spec attributes — e.g. {"cpu":"i7-13700H","ram_gb":32,"vram_gb":12,"storage":"1TB NVMe","year_used":2024,"includes":["adapter","box"]}. Keys are free-form by category.';

-- =============================================================================
-- 2) bundles: denormalized for catalog filter performance
--    Most bundles are 1:1 with a product for IT shop, so denormalizing brand/
--    model/condition lets catalog queries skip the join.
-- =============================================================================
ALTER TABLE public.bundles
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'new'
    CHECK (condition IN ('new', 'used', 'refurbished')),
  ADD COLUMN IF NOT EXISTS condition_note text,
  ADD COLUMN IF NOT EXISTS warranty_months int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS spec_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bundles.condition IS
  'Storefront-displayed condition. Admin must keep in sync with underlying products.condition for fixed single-item bundles.';
COMMENT ON COLUMN public.bundles.warranty_months IS
  'Shop-warranty period shown to customer. May differ from products.warranty_months (e.g. shop adds extra coverage).';
COMMENT ON COLUMN public.bundles.brand IS
  'Bundle-level brand for catalog filtering + JSON-LD Product.brand.';
COMMENT ON COLUMN public.bundles.model IS
  'Bundle-level model identifier. Used in catalog search + Product.mpn (manufacturer part number).';
COMMENT ON COLUMN public.bundles.spec_json IS
  'Flexible spec attributes mirrored from primary product for fast display without joining.';

-- =============================================================================
-- 3) Indexes for catalog filter queries
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_bundles_condition ON public.bundles(condition);
CREATE INDEX IF NOT EXISTS idx_bundles_brand ON public.bundles(brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bundles_brand_model ON public.bundles(brand, model) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_brand_model ON public.products(brand, model) WHERE brand IS NOT NULL;
-- GIN index for spec_json key-value lookup (e.g. find all bundles with ram_gb >= 32)
CREATE INDEX IF NOT EXISTS idx_bundles_spec_json_gin ON public.bundles USING gin(spec_json);

-- =============================================================================
-- 4) Categories seed for IT shop (idempotent)
--    Existing categories left untouched; only inserts what's missing.
--    slug is required + unique — use lower-kebab from name.
-- =============================================================================
INSERT INTO public.categories (name, slug, sort_order)
SELECT v.name, v.slug, v.sort_order
FROM (VALUES
  ('Notebook',       'notebook',       10),
  ('Graphics Card',  'graphics-card',  20),
  ('RAM',            'ram',            30),
  ('Storage',        'storage',        40),
  ('Keyboard',       'keyboard',       50),
  ('Mouse',          'mouse',          60),
  ('Headphones',     'headphones',     70),
  ('Monitor',        'monitor',        80),
  ('Accessories',    'accessories',    90),
  ('Used IT',        'used-it',       100)
) AS v(name, slug, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.slug = v.slug
);
