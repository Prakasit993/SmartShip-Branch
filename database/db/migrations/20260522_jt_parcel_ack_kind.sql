-- Generalize jt_return_acknowledgements into a parcel-level acknowledgement store.
-- Adds a `kind` discriminator so the same table backs both:
--   kind='return'   → พัสดุถูกตีกลับ (legacy rows, default)
--   kind='stagnant' → พัสดุตกค้างไม่เคลื่อนไหว (new)
--
-- Backward-compatible: table name is kept (existing return feature keeps working).
-- Existing rows default to kind='return'. The unique-active index is widened to
-- (awb_number, kind) so a single AWB can carry one active ack per kind without
-- colliding (a parcel may be both returned and stagnant).

ALTER TABLE public.jt_return_acknowledgements
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'return';

ALTER TABLE public.jt_return_acknowledgements
    DROP CONSTRAINT IF EXISTS jt_parcel_ack_kind_check;
ALTER TABLE public.jt_return_acknowledgements
    ADD CONSTRAINT jt_parcel_ack_kind_check CHECK (kind IN ('return', 'stagnant'));

-- Replace the unique-active index (awb_number) → (awb_number, kind).
DROP INDEX IF EXISTS public.jt_return_acknowledgements_active_awb_idx;
CREATE UNIQUE INDEX IF NOT EXISTS jt_return_acknowledgements_active_awb_kind_idx
    ON public.jt_return_acknowledgements (awb_number, kind)
    WHERE status = 'active';

-- Helps stagnant-card + AI tool lookups (active acks filtered by kind).
CREATE INDEX IF NOT EXISTS jt_return_acknowledgements_kind_status_idx
    ON public.jt_return_acknowledgements (kind, status, awb_number);
