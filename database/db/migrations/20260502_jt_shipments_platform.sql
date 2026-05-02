-- Optional channel / marketplace for reporting (Shopee, Lazada, TikTok, etc.)
ALTER TABLE public.jt_shipments
    ADD COLUMN IF NOT EXISTS platform text;

COMMENT ON COLUMN public.jt_shipments.platform IS 'แหล่งที่มา: Shopee, Lazada, TikTok, Facebook, Line, อื่นๆ, ฯลฯ';
