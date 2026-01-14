UPDATE public.products
SET image_urls = ARRAY[
    'https://placehold.co/600x400/252f3f/white?text=Main+Angle',
    'https://placehold.co/600x400/252f3f/white?text=Side+View',
    'https://placehold.co/600x400/252f3f/white?text=Top+View',
    'https://placehold.co/600x400/252f3f/white?text=Inside',
    'https://placehold.co/600x400/252f3f/white?text=Dimension'
]
WHERE name = 'Test Product (สินค้าทดสอบ)';
