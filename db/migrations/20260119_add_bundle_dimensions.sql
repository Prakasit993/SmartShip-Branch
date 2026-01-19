-- Migration: Add dimension columns to bundles table
-- Purpose: Enable accurate dimension-based product search
-- Date: 2026-01-19

-- Add dimension columns (in centimeters)
ALTER TABLE public.bundles
ADD COLUMN IF NOT EXISTS width_cm DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS length_cm DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS height_cm DECIMAL(10,2);

-- Add SKU column for product code search
ALTER TABLE public.bundles
ADD COLUMN IF NOT EXISTS sku TEXT;

-- Add weight column for shipping calculation (in grams)
ALTER TABLE public.bundles
ADD COLUMN IF NOT EXISTS weight_g DECIMAL(10,2);

-- Create index for dimension searches
CREATE INDEX IF NOT EXISTS idx_bundles_dimensions 
ON public.bundles (width_cm, length_cm, height_cm);

-- Create index for SKU search
CREATE INDEX IF NOT EXISTS idx_bundles_sku 
ON public.bundles (sku);

-- Comment on columns
COMMENT ON COLUMN public.bundles.width_cm IS 'Box width in centimeters';
COMMENT ON COLUMN public.bundles.length_cm IS 'Box length in centimeters';
COMMENT ON COLUMN public.bundles.height_cm IS 'Box height in centimeters';
COMMENT ON COLUMN public.bundles.weight_g IS 'Product weight in grams';
COMMENT ON COLUMN public.bundles.sku IS 'Stock Keeping Unit code';
