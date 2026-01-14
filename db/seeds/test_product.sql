-- Insert a test product if it doesn't exist
INSERT INTO public.products (name, description, price, stock_quantity, image_url, category_id, is_active)
VALUES (
    'Test Product (สินค้าทดสอบ)', 
    'This is a test product for verification. สินค้าทดสอบระบบ', 
    100.00, 
    999, 
    'https://placehold.co/600x400?text=Test+Product', 
    NULL, -- Assuming no category is fine, or one needs to be created first?
    true
);
