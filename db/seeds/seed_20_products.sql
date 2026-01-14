-- Seed 20 test products with varied attributes
-- Using UPSERT to avoid duplicates based on SKU

INSERT INTO public.products (name, description, price, sku, stock_quantity, is_active, width, length, height, dimension_unit, weight, weight_unit, color, size_label, thickness, image_urls)
VALUES
  ('Box A1 - Small Standard', 'Small standard cardboard box for general use.', 15.00, 'BOX-A1', 100, true, 10, 10, 10, 'cm', 0.2, 'kg', 'Brown', 'S', '3 layer', ARRAY['https://placehold.co/600x400?text=Box+A1']),
  ('Box A2 - Medium Standard', 'Medium standard cardboard box.', 25.00, 'BOX-A2', 80, true, 20, 20, 20, 'cm', 0.4, 'kg', 'Brown', 'M', '3 layer', ARRAY['https://placehold.co/600x400?text=Box+A2']),
  ('Box A3 - Large Standard', 'Large standard cardboard box.', 35.00, 'BOX-A3', 60, true, 30, 30, 30, 'cm', 0.6, 'kg', 'Brown', 'L', '3 layer', ARRAY['https://placehold.co/600x400?text=Box+A3']),
  ('Box B1 - Reinforced Small', 'Reinforced small box for heavier items.', 22.00, 'BOX-B1', 50, true, 12, 12, 12, 'cm', 0.3, 'kg', 'Brown', 'S', '5 layer', ARRAY['https://placehold.co/600x400?text=Box+B1']),
  ('Box B2 - Reinforced Medium', 'Reinforced medium box.', 32.00, 'BOX-B2', 40, true, 22, 22, 22, 'cm', 0.5, 'kg', 'Brown', 'M', '5 layer', ARRAY['https://placehold.co/600x400?text=Box+B2']),
  ('Box C1 - White Premium', 'Premium white finish box.', 18.00, 'BOX-C1', 75, true, 15, 15, 10, 'cm', 0.25, 'kg', 'White', 'S', '3 layer', ARRAY['https://placehold.co/600x400?text=Box+C1']),
  ('Box C2 - White Premium Large', 'Premium white finish large box.', 38.00, 'BOX-C2', 45, true, 25, 25, 20, 'cm', 0.55, 'kg', 'White', 'L', '3 layer', ARRAY['https://placehold.co/600x400?text=Box+C2']),
  ('Tape T1 - Clear 2 inch', 'Clear packaging tape, 2 inch width.', 45.00, 'TAPE-T1', 200, true, 10, 10, 5, 'cm', 0.1, 'kg', 'Clear', '2 inch', NULL, ARRAY['https://placehold.co/600x400?text=Tape+T1']),
  ('Tape T2 - Brown 2 inch', 'Brown packaging tape, 2 inch width.', 45.00, 'TAPE-T2', 180, true, 10, 10, 5, 'cm', 0.1, 'kg', 'Brown', '2 inch', NULL, ARRAY['https://placehold.co/600x400?text=Tape+T2']),
  ('Bubble Wrap BUB-50', 'Bubble wrap roll 50cm width.', 120.00, 'BUB-50', 30, true, 50, 50, 100, 'cm', 0.8, 'kg', 'Clear', '50cm x 100m', NULL, ARRAY['https://placehold.co/600x400?text=Bubble+Wrap']),
  ('Stretch Film SF-1', 'Stretch film for pallet wrapping.', 150.00, 'FILM-SF1', 50, true, 50, 10, 10, 'cm', 1.2, 'kg', 'Clear', 'Standard', '15 micron', ARRAY['https://placehold.co/600x400?text=Stretch+Film']),
  ('Mailer Bag M1 - Small', 'Plastic mailer bag, waterproof.', 5.00, 'MAIL-M1', 500, true, 25, 35, 0, 'cm', 0.01, 'kg', 'White', 'A4', NULL, ARRAY['https://placehold.co/600x400?text=Mailer+M1']),
  ('Mailer Bag M2 - Medium', 'Plastic mailer bag, waterproof.', 8.00, 'MAIL-M2', 400, true, 35, 45, 0, 'cm', 0.02, 'kg', 'White', 'A3', NULL, ARRAY['https://placehold.co/600x400?text=Mailer+M2']),
  ('Box D1 - Pizza Box S', 'Small pizza style box.', 12.00, 'BOX-D1', 120, true, 20, 20, 5, 'cm', 0.15, 'kg', 'Brown', '8 inch', '3 layer', ARRAY['https://placehold.co/600x400?text=Pizza+Box+S']),
  ('Box D2 - Pizza Box M', 'Medium pizza style box.', 16.00, 'BOX-D2', 100, true, 30, 30, 5, 'cm', 0.25, 'kg', 'Brown', '12 inch', '3 layer', ARRAY['https://placehold.co/600x400?text=Pizza+Box+M']),
  ('Corner Guard CG-1', 'Cardboard corner guard.', 5.00, 'CG-1', 1000, true, 5, 5, 100, 'cm', 0.05, 'kg', 'Brown', 'Standard', '4 mm', ARRAY['https://placehold.co/600x400?text=Corner+Guard']),
  ('Label Sticker L1', 'Fragile label sticker.', 2.00, 'LAB-L1', 2000, true, 10, 15, 0, 'cm', 0.001, 'kg', 'Red', 'Standard', NULL, ARRAY['https://placehold.co/600x400?text=Label+L1']),
  ('Strapping Band SB-1', 'PP Strapping band roll.', 250.00, 'STRAP-SB1', 20, true, 20, 20, 15, 'cm', 1.5, 'kg', 'Black', '15mm', NULL, ARRAY['https://placehold.co/600x400?text=Strapping+Band']),
  ('Cutter Knife K1', 'Heavy duty cutter knife.', 60.00, 'TOOL-K1', 50, true, 15, 3, 2, 'cm', 0.1, 'kg', 'Red', 'Standard', NULL, ARRAY['https://placehold.co/600x400?text=Cutter+K1']),
  ('Markers MK-1', 'Permanent marker pen.', 15.00, 'PEN-MK1', 150, true, 14, 1, 1, 'cm', 0.02, 'kg', 'Black', 'Standard', NULL, ARRAY['https://placehold.co/600x400?text=Marker'])
ON CONFLICT (sku) 
DO UPDATE SET 
  price = EXCLUDED.price,
  stock_quantity = EXCLUDED.stock_quantity,
  is_active = EXCLUDED.is_active,
  width = EXCLUDED.width,
  length = EXCLUDED.length,
  height = EXCLUDED.height,
  image_urls = EXCLUDED.image_urls;
