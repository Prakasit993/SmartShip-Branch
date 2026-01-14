-- Add columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'width') THEN
        ALTER TABLE public.products ADD COLUMN width decimal(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'length') THEN
        ALTER TABLE public.products ADD COLUMN length decimal(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'height') THEN
        ALTER TABLE public.products ADD COLUMN height decimal(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'dimension_unit') THEN
        ALTER TABLE public.products ADD COLUMN dimension_unit text DEFAULT 'cm';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'weight') THEN
        ALTER TABLE public.products ADD COLUMN weight decimal(10,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'weight_unit') THEN
        ALTER TABLE public.products ADD COLUMN weight_unit text DEFAULT 'kg';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'color') THEN
        ALTER TABLE public.products ADD COLUMN color text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'size_label') THEN
        ALTER TABLE public.products ADD COLUMN size_label text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'thickness') THEN
        ALTER TABLE public.products ADD COLUMN thickness text;
    END IF;
END $$;

-- Update the Test Product with example data
UPDATE public.products
SET 
    width = 30,
    length = 40,
    height = 20,
    color = 'น้ำตาล (Brown)',
    size_label = 'Size C',
    thickness = '3-ply'
WHERE name = 'Test Product (สินค้าทดสอบ)';
