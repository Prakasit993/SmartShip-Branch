-- 2026-05-28: COD bucket summary RPC + drill-down list
--
-- ใช้ใน /admin/jt-warehouse — card "COD ค้างเก็บ" หน้าหลัก
-- COD bucket ตาม [[project-jt-warehouse-business-rules]] § 3:
--   <1k / 1k–2k / 2k–5k / >5k
-- เฉพาะพัสดุที่ "ยังไม่ปิดงาน" (jt_parcel_is_closed = false)
-- — รวมพัสดุที่อยู่ในคลัง (staff_id ว่าง) ด้วย เพราะแอดมินต้องมองภาพรวม

-- 1. Summary: counts + sums แยก bucket — สำหรับ card หน้าหลัก
CREATE OR REPLACE FUNCTION public.get_warehouse_jt_cod_summary(
    p_delivery_branch_code text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH pending AS (
        SELECT
            COALESCE(NULLIF(cod_amount, '')::numeric, 0) AS cod_num
        FROM public.warehouse_jt_parcels
        WHERE delivery_branch_code = p_delivery_branch_code
          AND NOT public.jt_parcel_is_closed(
              signed_time, sign_branch_name, signed_record_time,
              signed_by_staff, signer_name, sign_time_status
          )
    )
    SELECT jsonb_build_object(
        'branch_code',   p_delivery_branch_code,
        'pending_total', COALESCE(SUM(cod_num), 0),
        'pending_count', COUNT(*),
        'buckets', jsonb_build_object(
            'low',       jsonb_build_object(
                'label', '< ฿1,000',
                'count', COUNT(*) FILTER (WHERE cod_num <  1000),
                'sum',   COALESCE(SUM(cod_num) FILTER (WHERE cod_num <  1000), 0)
            ),
            'mid',       jsonb_build_object(
                'label', '฿1,000 – ฿2,000',
                'count', COUNT(*) FILTER (WHERE cod_num >= 1000 AND cod_num <  2000),
                'sum',   COALESCE(SUM(cod_num) FILTER (WHERE cod_num >= 1000 AND cod_num <  2000), 0)
            ),
            'high',      jsonb_build_object(
                'label', '฿2,000 – ฿5,000',
                'count', COUNT(*) FILTER (WHERE cod_num >= 2000 AND cod_num <  5000),
                'sum',   COALESCE(SUM(cod_num) FILTER (WHERE cod_num >= 2000 AND cod_num <  5000), 0)
            ),
            'very_high', jsonb_build_object(
                'label', '> ฿5,000',
                'count', COUNT(*) FILTER (WHERE cod_num >= 5000),
                'sum',   COALESCE(SUM(cod_num) FILTER (WHERE cod_num >= 5000), 0)
            )
        )
    )
    FROM pending;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_cod_summary(text) TO service_role;

-- 2. Drill-down: list AWB ของ bucket ที่เลือก
-- p_bucket: 'low' | 'mid' | 'high' | 'very_high'
CREATE OR REPLACE FUNCTION public.get_warehouse_jt_cod_bucket_list(
    p_delivery_branch_code text,
    p_bucket               text,
    p_limit                int DEFAULT 100
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH base AS (
        SELECT
            awb_number,
            cod_amount,
            COALESCE(NULLIF(cod_amount, '')::numeric, 0) AS cod_num,
            delivery_staff_id,
            delivery_staff_name,
            receiver_name,
            receiver_phone,
            receiver_address,
            stuck_flag,
            stuck_reason,
            problem_reason,
            arrived_branch_time
        FROM public.warehouse_jt_parcels
        WHERE delivery_branch_code = p_delivery_branch_code
          AND NOT public.jt_parcel_is_closed(
              signed_time, sign_branch_name, signed_record_time,
              signed_by_staff, signer_name, sign_time_status
          )
    ),
    filtered AS (
        SELECT *
        FROM base
        WHERE
            (p_bucket = 'low'       AND cod_num <  1000) OR
            (p_bucket = 'mid'       AND cod_num >= 1000 AND cod_num <  2000) OR
            (p_bucket = 'high'      AND cod_num >= 2000 AND cod_num <  5000) OR
            (p_bucket = 'very_high' AND cod_num >= 5000)
    )
    SELECT jsonb_build_object(
        'bucket', p_bucket,
        'total',  (SELECT COUNT(*) FROM filtered),
        'sum',    COALESCE((SELECT SUM(cod_num) FROM filtered), 0),
        'parcels', COALESCE(
            (SELECT jsonb_agg(p)
             FROM (
                SELECT
                    awb_number,
                    cod_amount,
                    cod_num,
                    delivery_staff_id,
                    delivery_staff_name,
                    receiver_name,
                    receiver_phone,
                    receiver_address,
                    stuck_flag,
                    stuck_reason,
                    problem_reason,
                    arrived_branch_time
                FROM filtered
                ORDER BY cod_num DESC NULLS LAST, awb_number
                LIMIT GREATEST(p_limit, 1)
             ) p),
            '[]'::jsonb
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_cod_bucket_list(text, text, int) TO service_role;
