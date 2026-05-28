-- 2026-05-28: RPC สำหรับโหลด detail รายพนักงาน (lazy-load)
--
-- ใช้ใน /admin/jt-warehouse → คลิกชื่อพนักงานในตาราง → modal/drawer
-- คืน jsonb เดียวจบครบ: staff info + counts + COD breakdown + top 20 pending
--
-- COD bucket ตาม [[project-jt-warehouse-business-rules]] § 3:
--   <1k / 1k–2k / 2k–5k / >5k
-- "ปิดงาน" = jt_parcel_is_closed() (6 ฟิลด์ครบ)

CREATE OR REPLACE FUNCTION public.get_warehouse_jt_staff_detail(
    p_delivery_branch_code text,
    p_delivery_staff_id    text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH base AS (
        SELECT
            *,
            public.jt_parcel_is_closed(
                signed_time, sign_branch_name, signed_record_time,
                signed_by_staff, signer_name, sign_time_status
            ) AS is_closed,
            COALESCE(NULLIF(cod_amount, '')::numeric, 0) AS cod_num
        FROM public.warehouse_jt_parcels
        WHERE delivery_branch_code = p_delivery_branch_code
          AND delivery_staff_id    = p_delivery_staff_id
    )
    SELECT jsonb_build_object(
        'staff', (
            SELECT jsonb_build_object(
                'delivery_staff_id',       p_delivery_staff_id,
                'delivery_staff_name',     MAX(delivery_staff_name),
                'delivery_staff_position', MAX(delivery_staff_position),
                'delivery_staff_phone',    MAX(delivery_staff_phone),
                'delivery_branch_code',    p_delivery_branch_code,
                'delivery_branch_name',    MAX(delivery_branch_name)
            )
            FROM base
        ),
        'counts', (
            SELECT jsonb_build_object(
                'total',     COUNT(*),
                'delivered', COUNT(*) FILTER (WHERE is_closed),
                'pending',   COUNT(*) FILTER (WHERE NOT is_closed),
                'stuck',     COUNT(*) FILTER (WHERE stuck_flag = 'Y'),
                'problem',   COUNT(*) FILTER (WHERE public.jt_text_is_filled(problem_time))
            )
            FROM base
        ),
        'cod', (
            SELECT jsonb_build_object(
                'total',           COALESCE(SUM(cod_num), 0),
                'pending_total',   COALESCE(SUM(cod_num) FILTER (WHERE NOT is_closed), 0),
                'low_count',       COUNT(*) FILTER (WHERE NOT is_closed AND cod_num <  1000),
                'mid_count',       COUNT(*) FILTER (WHERE NOT is_closed AND cod_num >= 1000 AND cod_num <  2000),
                'high_count',      COUNT(*) FILTER (WHERE NOT is_closed AND cod_num >= 2000 AND cod_num <  5000),
                'very_high_count', COUNT(*) FILTER (WHERE NOT is_closed AND cod_num >= 5000)
            )
            FROM base
        ),
        'pending_parcels', COALESCE(
            (SELECT jsonb_agg(p) FROM (
                SELECT
                    awb_number,
                    cod_amount,
                    cod_num,
                    receiver_name,
                    receiver_phone,
                    receiver_address,
                    stuck_flag,
                    stuck_reason,
                    problem_reason,
                    arrived_branch_time
                FROM base
                WHERE NOT is_closed
                ORDER BY cod_num DESC NULLS LAST, awb_number
                LIMIT 20
            ) p),
            '[]'::jsonb
        )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_staff_detail(text, text) TO service_role;
