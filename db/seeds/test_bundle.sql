-- Assumes 'Test Product' exists with ID 1 (from previous step)
-- If not, verify product ID first.

-- 1. Create a Bundle
INSERT INTO public.bundles (name, slug, description, price, image_urls, type, is_active, category_id)
VALUES (
    'Test Bundle Set',
    'test-bundle-set',
    'A bundle containing the Test Product. ชุดสินค้าทดสอบ',
    100.00,
    ARRAY['https://placehold.co/600x400?text=Test+Bundle'],
    'fixed',
    true,
    NULL
) RETURNING id;

-- 2. Link Bundle to Product (Assuming Bundle ID is 1 and Product ID is 1 for fresh DB)
-- If you run this manually, you might need to adjust IDs.
-- But for a fresh dev setup, this usually maps 1-1.

INSERT INTO public.bundle_items (bundle_id, product_id, quantity)
VALUES (
    (SELECT id FROM public.bundles WHERE slug = 'test-bundle-set' LIMIT 1),
    (SELECT id FROM public.products WHERE name = 'Test Product (สินค้าทดสอบ)' LIMIT 1),
    1
);
