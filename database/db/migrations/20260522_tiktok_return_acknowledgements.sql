-- Admin acknowledgements for TikTok Shop parcels (separate table from jt_return_acknowledgements
-- so a tiktok AWB never collides with a J&T AWB on the same kind).
-- Mirrors the final shape of public.jt_return_acknowledgements:
--   kind='return'   → พัสดุถูกตีกลับ (default)
--   kind='stagnant' → พัสดุตกค้างไม่เคลื่อนไหว
-- mute_aging: true = ปิดเรื่องแล้ว ซ่อนจาก aging; false = ยังต้องตามต่อ
-- Active ack (status='active') ซ่อน AWB จากการ์ด "ติดตามปัญหา" ของ tiktok-dashboard.

CREATE TABLE IF NOT EXISTS public.tiktok_return_acknowledgements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    awb_number text NOT NULL,
    kind text NOT NULL DEFAULT 'return',
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    mute_aging boolean NOT NULL DEFAULT true,
    acknowledged_by text,
    acknowledged_at timestamptz NOT NULL DEFAULT now(),
    cancelled_reason text,
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tiktok_return_ack_kind_check CHECK (kind IN ('return', 'stagnant'))
);

-- หนึ่ง AWB มี ack active ได้ 1 รายการต่อ kind (return + stagnant แยกกันได้)
CREATE UNIQUE INDEX IF NOT EXISTS tiktok_return_acknowledgements_active_awb_kind_idx
    ON public.tiktok_return_acknowledgements (awb_number, kind)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS tiktok_return_acknowledgements_kind_status_idx
    ON public.tiktok_return_acknowledgements (kind, status, awb_number);

CREATE INDEX IF NOT EXISTS tiktok_return_acknowledgements_status_ack_at_idx
    ON public.tiktok_return_acknowledgements (status, acknowledged_at DESC);

CREATE INDEX IF NOT EXISTS tiktok_return_acknowledgements_awb_idx
    ON public.tiktok_return_acknowledgements (awb_number);

-- RLS: service_role เท่านั้น (เหมือน jt_return_acknowledgements / tiktok_shipments)
ALTER TABLE public.tiktok_return_acknowledgements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tiktok_return_acknowledgements FROM anon, authenticated;
GRANT ALL ON TABLE public.tiktok_return_acknowledgements TO service_role;
