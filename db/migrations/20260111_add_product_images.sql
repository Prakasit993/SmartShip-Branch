-- 1. Add image_urls column
ALTER TABLE public.products
ADD COLUMN image_urls text[] DEFAULT '{}';

-- 2. Migrate existing single image to array (if it exists)
UPDATE public.products
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND image_url != '';

-- 3. (Optional) We can keep `image_url` as a quick thumbnail reference or deprecated. 
-- For now, we will leave it but primarily use image_urls in the future.
