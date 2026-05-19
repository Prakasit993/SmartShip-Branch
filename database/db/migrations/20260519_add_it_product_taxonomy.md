# IT product taxonomy — schema doc

**Migration:** [`20260519_add_it_product_taxonomy.sql`](./20260519_add_it_product_taxonomy.sql)
**Date:** 2026-05-19
**Status:** Draft — review before applying to production

## Why

The site is pivoting from packing-supply shop to NYXEL — premium IT retail with future used-IT support (GPU, RAM, Notebook). Existing `products` / `bundles` schema captures dimensions and SEO but nothing IT-specific. This migration adds the minimum viable attributes to:

1. Sell new IT products with brand/model/warranty info
2. Support future used-IT listings with condition disclosure
3. Power Product / Offer JSON-LD (Phase 3) with `itemCondition`, `brand`, `mpn`
4. Power admin AI search (Phase 6) — "do we have RTX 4070 in stock?"

## New columns

| Column | Type | Default | Notes |
|---|---|---|---|
| `condition` | text + CHECK | `'new'` | One of `new` / `used` / `refurbished`. Maps to schema.org `itemCondition`. |
| `condition_note` | text | NULL | Shown when condition != `new`. e.g. `"95% สภาพดี ผ่านการใช้งาน 3 เดือน"` |
| `warranty_months` | int | `0` | New: manufacturer warranty. Used: shop warranty. `0` means none. |
| `brand` | text | NULL | e.g. `ASUS`, `NVIDIA`, `Corsair`. Used for filters + JSON-LD. |
| `model` | text | NULL | e.g. `RTX 4070`, `DDR5-5600 32GB`. Used for search + JSON-LD `mpn`. |
| `spec_json` | jsonb | `'{}'` | Flexible specs by category (see below). |

Added to **both** `products` and `bundles`. `products` is source of truth; `bundles` is denormalized for fast catalog rendering (most IT bundles are 1:1 with a product, so JOIN is wasteful).

## `spec_json` examples by category

### Notebook
```json
{
  "cpu": "i7-13700H",
  "ram_gb": 32,
  "vram_gb": 8,
  "storage": "1TB NVMe",
  "display": "16\" 240Hz",
  "year": 2024,
  "weight_kg": 2.1
}
```

### Graphics Card (GPU)
```json
{
  "vram_gb": 12,
  "interface": "PCIe 4.0 x16",
  "tdp_w": 200,
  "length_mm": 304,
  "year_used": 2024,
  "includes": ["original box", "adapter"]
}
```

### RAM
```json
{
  "type": "DDR5",
  "speed_mhz": 5600,
  "capacity_gb": 32,
  "modules": 2,
  "cas_latency": 36
}
```

### Used items (any category)
Add these on top of category-specific keys:
```json
{
  "year_used": 2024,
  "hours_used": 1200,
  "cosmetic_grade": "A",
  "missing_accessories": ["original box"]
}
```

## Indexes

- `idx_bundles_condition` — filter "show only used / new"
- `idx_bundles_brand` (partial) — filter by brand on catalog
- `idx_bundles_brand_model` (partial) — exact model lookup
- `idx_products_brand_model` (partial) — admin AI lookup
- `idx_bundles_spec_json_gin` — `WHERE spec_json @> '{"ram_gb":32}'` queries

Partial indexes skip rows where brand is NULL (most pre-existing rows), keeping index size small.

## Example queries

### Catalog filter — "used GPUs"
```sql
SELECT id, slug, name, price, brand, model, condition, warranty_months
FROM public.bundles
WHERE is_active = true
  AND condition = 'used'
  AND category_id = (SELECT id FROM public.categories WHERE slug = 'graphics-card');
```

### Admin AI lookup — "stock for RTX 4070"
```sql
SELECT b.id, b.slug, b.name, b.price, b.condition,
       (SELECT SUM(p.stock_quantity)
        FROM public.bundle_items bi
        JOIN public.products p ON p.id = bi.product_id
        WHERE bi.bundle_id = b.id) AS stock
FROM public.bundles b
WHERE b.is_active = true
  AND b.model ILIKE '%RTX 4070%'
  AND b.brand IN ('NVIDIA', 'ASUS', 'MSI', 'Gigabyte');
```

### JSON-LD Product (Phase 3) — sample mapping
```ts
{
  '@type': 'Product',
  name: bundle.name,
  brand: bundle.brand ? { '@type': 'Brand', name: bundle.brand } : undefined,
  mpn: bundle.model,
  itemCondition: ({
    new: 'https://schema.org/NewCondition',
    used: 'https://schema.org/UsedCondition',
    refurbished: 'https://schema.org/RefurbishedCondition',
  })[bundle.condition],
  offers: {
    '@type': 'Offer',
    priceCurrency: 'THB',
    price: bundle.price,
    availability: stock > 0
      ? 'https://schema.org/InStock'
      : 'https://schema.org/OutOfStock',
    warranty: bundle.warranty_months > 0
      ? { '@type': 'WarrantyPromise', durationOfWarranty: { '@type': 'QuantitativeValue', value: bundle.warranty_months, unitCode: 'MON' } }
      : undefined,
  },
}
```

## Rollback

```sql
ALTER TABLE public.products
  DROP COLUMN condition,
  DROP COLUMN condition_note,
  DROP COLUMN warranty_months,
  DROP COLUMN brand,
  DROP COLUMN model,
  DROP COLUMN spec_json;

ALTER TABLE public.bundles
  DROP COLUMN condition,
  DROP COLUMN condition_note,
  DROP COLUMN warranty_months,
  DROP COLUMN brand,
  DROP COLUMN model,
  DROP COLUMN spec_json;

DROP INDEX IF EXISTS public.idx_bundles_condition;
DROP INDEX IF EXISTS public.idx_bundles_brand;
DROP INDEX IF EXISTS public.idx_bundles_brand_model;
DROP INDEX IF EXISTS public.idx_products_brand_model;
DROP INDEX IF EXISTS public.idx_bundles_spec_json_gin;

-- Seeded categories: review which to keep before deleting
-- DELETE FROM public.categories WHERE slug IN
--   ('notebook','graphics-card','ram','storage','keyboard',
--    'mouse','headphones','monitor','accessories','used-it');
```

## Decisions to confirm before applying

1. **Should `condition` exist on both tables?** Yes for now (denormalized for speed). Phase 3 admin UI must enforce consistency — fixed-type bundles auto-mirror from primary product.
2. **`spec_json` validation?** Free-form for v1. Phase 3+ could add JSON Schema validation at admin form layer.
3. **Categories seed conflict?** Current categories use Thai names. New IT categories are English. Confirm whether to keep English (matches JSON-LD better) or translate.
4. **Existing rows — confirmed plan:** Section 5 of the migration sets `is_active=false` on every currently-active row in both tables and stamps `condition_note` with `[archived 2026-05-19: pre-NYXEL pivot]`. Order history and reviews stay intact (FK references preserved). After apply, `/shop` will show no products until admin adds new NYXEL inventory.

## Section 5 — legacy archive (IMPORTANT)

The migration archives **all** currently-active products and bundles. This is intentional — the screenshot of `order_items` (21 records of Box A1, Box B2, Bubble Wrap, etc.) confirmed everything currently in DB is pre-NYXEL inventory.

### What survives
- Order history (`orders` + `order_items`) — fully intact
- Customer reviews — fully intact
- All FK references — fully intact
- The archived rows themselves — readable in admin, just `is_active=false`

### What changes after apply
- `/shop` page: empty until new NYXEL products are added
- `/shop/bundle/[slug]` for old slugs: still works if user has bookmark, but admin pages won't list them

### Restore command (if needed)
```sql
UPDATE public.bundles  SET is_active=true WHERE condition_note LIKE '%pre-NYXEL pivot%';
UPDATE public.products SET is_active=true WHERE condition_note LIKE '%pre-NYXEL pivot%';
```

### Audit query
```sql
SELECT id, name, slug, condition_note
FROM public.bundles
WHERE condition_note LIKE '%pre-NYXEL pivot%'
ORDER BY id;
```

## Apply procedure

1. Run on **staging** Supabase project first
2. Verify with: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('products','bundles') ORDER BY table_name, ordinal_position;`
3. Run sample queries above to confirm indexes hit (use `EXPLAIN ANALYZE`)
4. Apply to **production** off-peak hours
5. Admin form update (Phase 3) — separate PR to expose new fields in `/admin/products` and `/admin/bundles`
