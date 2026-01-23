-- ================================================================
-- Sync Bundle Dimensions from Products
-- ================================================================
-- This script updates bundles table with dimensions from the 
-- first product in each bundle's bundle_items
-- ================================================================

-- Update bundles with dimensions from the first product in bundle_items
UPDATE bundles b
SET 
    width_cm = p.width,
    length_cm = p.length,
    height_cm = p.height
FROM (
    SELECT DISTINCT ON (bi.bundle_id) 
        bi.bundle_id,
        pr.width,
        pr.length,
        pr.height
    FROM bundle_items bi
    JOIN products pr ON bi.product_id = pr.id
    WHERE pr.width IS NOT NULL 
      AND pr.length IS NOT NULL 
      AND pr.height IS NOT NULL
    ORDER BY bi.bundle_id, bi.id
) p
WHERE b.id = p.bundle_id
  AND (b.width_cm IS NULL OR b.length_cm IS NULL OR b.height_cm IS NULL);

-- Show results
SELECT 
    id, 
    name, 
    width_cm, 
    length_cm, 
    height_cm 
FROM bundles 
ORDER BY id;
