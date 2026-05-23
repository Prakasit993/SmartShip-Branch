-- TikTok dashboard totals — รองรับตัวกรองช่วง booking_date (หน้าต่าง 14 วัน)
-- Date: 2026-05-23
-- Pairs with: app/api/admin/tiktok-shipments/stats/route.ts
--             src/lib/bookingDateWindow.ts
--
-- เดิม tiktok_dashboard_totals() นับทั้งตาราง. เพิ่มพารามิเตอร์ช่วงวันที่ (optional)
-- เพื่อให้ dashboard ขอเฉพาะ 14 วันได้ — ส่ง NULL = นับทั้งตาราง (AI tool เดิม).
--
-- p_to เป็น "exclusive upper bound" (วันถัดจากวันสิ้นสุด) → booking_date < p_to
-- ครอบคลุมทั้งวันสิ้นสุด. booking_date เป็น text "YYYY-MM-DD HH:MM:SS"
-- จึงเทียบแบบ string ได้ตรง.

-- ต้อง DROP ก่อนเพราะเปลี่ยน signature (เดิมไม่มีพารามิเตอร์).
DROP FUNCTION IF EXISTS public.tiktok_dashboard_totals();

CREATE OR REPLACE FUNCTION public.tiktok_dashboard_totals(
    p_from text DEFAULT NULL,
    p_to   text DEFAULT NULL   -- exclusive (วันถัดจากวันสิ้นสุด)
)
RETURNS TABLE(total bigint, closed_count bigint)
LANGUAGE sql STABLE AS $$
    SELECT
        count(*)::bigint AS total,
        count(*) FILTER (
            WHERE signer_name IS NOT NULL
              AND btrim(signer_name) <> ''
              AND upper(btrim(signer_name)) <> 'NULL'
        )::bigint AS closed_count
    FROM public.tiktok_shipments
    WHERE (p_from IS NULL OR booking_date >= p_from)
      AND (p_to   IS NULL OR booking_date <  p_to);
$$;

GRANT EXECUTE ON FUNCTION public.tiktok_dashboard_totals(text, text) TO service_role;

-- index ช่วยกรองตาม booking_date (stats / issues / stagnant ใช้หน้าต่างวันที่)
CREATE INDEX IF NOT EXISTS tiktok_shipments_booking_date_idx
    ON public.tiktok_shipments (booking_date);
