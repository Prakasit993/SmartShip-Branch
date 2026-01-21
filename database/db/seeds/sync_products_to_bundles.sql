-- Sync Products to Bundles
-- This script creates a 1:1 Bundle for every Product that doesn't share a name with an existing Bundle.
-- It maps Product fields to Bundle fields to make them sellable in the storefront.

DO $$
DECLARE
    r RECORD;
    v_bundle_id bigint;
    v_slug text;
    v_image_urls text[];
BEGIN
    FOR r IN SELECT * FROM public.products WHERE is_active = true LOOP
        
        -- Check if a bundle with this name already exists
        IF NOT EXISTS (SELECT 1 FROM public.bundles WHERE name = r.name) THEN
            
            -- Generate a basic slug from name + Sku to ensure uniqueness
            -- e.g. "Box A1 - Small Standard" -> "box-a1-small-standard-BOX-A1"
            v_slug := lower(regexp_replace(r.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || lower(coalesce(r.sku, 'sku'));
            
            -- Prepare image_urls array from product.image_url (if exists)
            IF r.image_url IS NOT NULL THEN
                v_image_urls := ARRAY[r.image_url];
            ELSE
                v_image_urls := NULL;
            END IF;

            -- Create the Bundle
            INSERT INTO public.bundles (name, slug, description, price, image_urls, type, is_active)
            VALUES (
                r.name, 
                v_slug, 
                r.description, 
                r.price, 
                v_image_urls, 
                'fixed', 
                true
            )
            RETURNING id INTO v_bundle_id;
            
            -- Link Product to Bundle (1:1 relationship)
            INSERT INTO public.bundle_items (bundle_id, product_id, quantity)
            VALUES (v_bundle_id, r.id, 1);
            
            RAISE NOTICE 'Created Bundle for Product: %', r.name;
        ELSE
            RAISE NOTICE 'Bundle already exists for: %', r.name;
        END IF;
    END LOOP;
END $$;
