-- 2026-05-28: Refactor "ปิดงาน" definition for warehouse_jt_parcels
--
-- Business rule change: "ปิดงาน" ต้องมีข้อมูลครบทั้ง 6 ฟิลด์ signed_*
--   (signed_time, sign_branch_name, signed_record_time,
--    signed_by_staff, signer_name, sign_time_status)
-- — เปลี่ยนจากเดิม signed_flag = 'Y' ที่ไม่แม่นพอ
--
-- Single source of truth: see memory project-jt-warehouse-business-rules

-- 1. Helper: text field "มีค่าจริง" (ไม่ใช่ NULL / '' / '-')
CREATE OR REPLACE FUNCTION public.jt_text_is_filled(t text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT t IS NOT NULL AND t <> '' AND t <> '-';
$$;

-- 2. Predicate: พัสดุ J&T "ปิดงาน" หรือยัง — รับ 6 ฟิลด์ signed_*
CREATE OR REPLACE FUNCTION public.jt_parcel_is_closed(
    p_signed_time        text,
    p_sign_branch_name   text,
    p_signed_record_time text,
    p_signed_by_staff    text,
    p_signer_name        text,
    p_sign_time_status   text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT public.jt_text_is_filled(p_signed_time)
       AND public.jt_text_is_filled(p_sign_branch_name)
       AND public.jt_text_is_filled(p_signed_record_time)
       AND public.jt_text_is_filled(p_signed_by_staff)
       AND public.jt_text_is_filled(p_signer_name)
       AND public.jt_text_is_filled(p_sign_time_status);
$$;

GRANT EXECUTE ON FUNCTION public.jt_text_is_filled(text)          TO service_role;
GRANT EXECUTE ON FUNCTION public.jt_parcel_is_closed(text, text, text, text, text, text) TO service_role;

-- 3. Partial index ช่วย count ปิดงาน เร็วขึ้น (table อาจขยายในอนาคต)
CREATE INDEX IF NOT EXISTS warehouse_jt_parcels_closed_idx
    ON public.warehouse_jt_parcels (delivery_branch_code, delivery_staff_id)
    WHERE  signed_time        IS NOT NULL AND signed_time        NOT IN ('', '-')
       AND sign_branch_name   IS NOT NULL AND sign_branch_name   NOT IN ('', '-')
       AND signed_record_time IS NOT NULL AND signed_record_time NOT IN ('', '-')
       AND signed_by_staff    IS NOT NULL AND signed_by_staff    NOT IN ('', '-')
       AND signer_name        IS NOT NULL AND signer_name        NOT IN ('', '-')
       AND sign_time_status   IS NOT NULL AND sign_time_status   NOT IN ('', '-');

-- 4. Refactor RPC: สรุปต่อพนักงาน (ใช้ predicate ใหม่)
CREATE OR REPLACE FUNCTION public.get_warehouse_jt_branch_staff_summary()
RETURNS TABLE (
    delivery_branch_code text,
    delivery_branch_name text,
    delivery_staff_id text,
    delivery_staff_name text,
    delivery_staff_position text,
    delivery_staff_phone text,
    parcel_count bigint,
    delivered_count bigint,
    pending_count bigint,
    stuck_count bigint,
    cod_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        delivery_branch_code,
        MAX(delivery_branch_name)        AS delivery_branch_name,
        delivery_staff_id,
        MAX(delivery_staff_name)         AS delivery_staff_name,
        MAX(delivery_staff_position)     AS delivery_staff_position,
        MAX(delivery_staff_phone)        AS delivery_staff_phone,
        COUNT(*)                                                    AS parcel_count,
        COUNT(*) FILTER (
            WHERE public.jt_parcel_is_closed(
                signed_time, sign_branch_name, signed_record_time,
                signed_by_staff, signer_name, sign_time_status
            )
        )                                                           AS delivered_count,
        COUNT(*) FILTER (
            WHERE NOT public.jt_parcel_is_closed(
                signed_time, sign_branch_name, signed_record_time,
                signed_by_staff, signer_name, sign_time_status
            )
        )                                                           AS pending_count,
        COUNT(*) FILTER (WHERE stuck_flag = 'Y')                    AS stuck_count,
        COALESCE(SUM(NULLIF(cod_amount, '')::numeric), 0)           AS cod_total
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code IS NOT NULL
      AND delivery_branch_code <> ''
    GROUP BY delivery_branch_code, delivery_staff_id
    ORDER BY delivery_branch_code, parcel_count DESC;
$$;

-- 5. Refactor RPC: สรุปต่อสาขา (ใช้ predicate ใหม่)
CREATE OR REPLACE FUNCTION public.get_warehouse_jt_branch_summary()
RETURNS TABLE (
    delivery_branch_code text,
    delivery_branch_name text,
    parcel_count bigint,
    staff_count bigint,
    delivered_count bigint,
    pending_count bigint,
    stuck_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        delivery_branch_code,
        MAX(delivery_branch_name)        AS delivery_branch_name,
        COUNT(*)                         AS parcel_count,
        COUNT(DISTINCT delivery_staff_id) FILTER (
            WHERE delivery_staff_id IS NOT NULL AND delivery_staff_id <> ''
        )                                AS staff_count,
        COUNT(*) FILTER (
            WHERE public.jt_parcel_is_closed(
                signed_time, sign_branch_name, signed_record_time,
                signed_by_staff, signer_name, sign_time_status
            )
        )                                AS delivered_count,
        COUNT(*) FILTER (
            WHERE NOT public.jt_parcel_is_closed(
                signed_time, sign_branch_name, signed_record_time,
                signed_by_staff, signer_name, sign_time_status
            )
        )                                AS pending_count,
        COUNT(*) FILTER (WHERE stuck_flag = 'Y')                    AS stuck_count
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code IS NOT NULL
      AND delivery_branch_code <> ''
    GROUP BY delivery_branch_code
    ORDER BY parcel_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_branch_staff_summary() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_branch_summary()       TO service_role;

-- หมายเหตุ:
-- 1. ไม่ต้องแก้ frontend — schema ของ RPC ไม่เปลี่ยน, return columns เหมือนเดิม
-- 2. ตัวเลข delivered_count / pending_count อาจเปลี่ยนหลัง apply migration นี้
--    เป็นพฤติกรรมที่คาดไว้ — definition แม่นยำขึ้น
-- 3. signed_flag ยังคงอยู่ในตาราง แต่ไม่ใช้ใน count แล้ว (อาจใช้ debug)
