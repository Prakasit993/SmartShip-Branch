ALTER TABLE public.products
ADD COLUMN width decimal(10,2) DEFAULT 0,
ADD COLUMN length decimal(10,2) DEFAULT 0,
ADD COLUMN height decimal(10,2) DEFAULT 0,
ADD COLUMN dimension_unit text DEFAULT 'cm',
ADD COLUMN weight decimal(10,2) DEFAULT 0, -- Good to have for shipping
ADD COLUMN weight_unit text DEFAULT 'kg',
ADD COLUMN color text,
ADD COLUMN size_label text, -- e.g. "Size A", "Box 2A"
ADD COLUMN thickness text; -- e.g. "3-ply", "5mm"

-- Commenting for clarity (optional, supported in some clients)
COMMENT ON COLUMN public.products.size_label IS 'Specific size name like Size A, Box 2A';
