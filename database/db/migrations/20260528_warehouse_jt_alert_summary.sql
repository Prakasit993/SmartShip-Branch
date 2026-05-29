-- 2026-05-28: Alert summary RPC + drill-down list
-- Phase 3.5 — Card 3 tiles: pending / stuck / problem
--
-- ใช้ใน /admin/jt-warehouse — card "🚨 Alert Summary" หน้าหลัก
-- รองรับ date filter เหมือน RPC อื่น ๆ ใน Phase 3.5

-- 1. Summary: 3 counts + cod sum — สำหรับ card หน้าหลัก
CREATE OR REPLACE FUNCTION public.get_warehouse_jt_alert_summary(
    p_delivery_branch_code text,
    p_date_from            date DEFAULT NULL,
    p_date_to              date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH base AS (
        SELECT
            public.jt_parcel_is_closed(
                signed_time, sign_branch_name, signed_record_time,
                signed_by_staff, signer_name, sign_time_status
            ) AS is_closed,
            stuck_flag,
            public.jt_text_is_filled(problem_time) AS has_problem,
            COALESCE(NULLIF(cod_amount, '')::numeric, 0) AS cod_num
        FROM public.warehouse_jt_parcels
        WHERE delivery_branch_code = p_delivery_branch_code
          AND (p_date_from IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) >= p_date_from)
          AND (p_date_to   IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) <= p_date_to)
    )
    SELECT jsonb_build_object(
        'branch_code', p_delivery_branch_code,
        'pending', jsonb_build_object(
            'count',   COUNT(*) FILTER (WHERE NOT is_closed),
            'cod_sum', COALESCE(SUM(cod_num) FILTER (WHERE NOT is_closed), 0)
        ),
        'stuck', jsonb_build_object(
            'count',   COUNT(*) FILTER (WHERE stuck_flag = 'Y'),
            'cod_sum', COALESCE(SUM(cod_num) FILTER (WHERE stuck_flag = 'Y'), 0)
        ),
        'problem', jsonb_build_object(
            'count',   COUNT(*) FILTER (WHERE has_problem),
            'cod_sum', COALESCE(SUM(cod_num) FILTER (WHERE has_problem), 0)
        )
    )
    FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_alert_summary(text, date, date) TO service_role;

-- 2. Drill-down list — รายการ AWB ของ kind ที่เลือก
-- p_kind: 'pending' | 'stuck' | 'problem'
CREATE OR REPLACE FUNCTION public.get_warehouse_jt_alert_list(
    p_delivery_branch_code text,
    p_kind                 text,
    p_limit                int  DEFAULT 100,
    p_date_from            date DEFAULT NULL,
    p_date_to              date DEFAULT NULL
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
            problem_time,
            problem_reason,
            arrived_branch_time,
            public.jt_parcel_is_closed(
                signed_time, sign_branch_name, signed_record_time,
                signed_by_staff, signer_name, sign_time_status
            ) AS is_closed,
            public.jt_text_is_filled(problem_time) AS has_problem
        FROM public.warehouse_jt_parcels
        WHERE delivery_branch_code = p_delivery_branch_code
          AND (p_date_from IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) >= p_date_from)
          AND (p_date_to   IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) <= p_date_to)
    ),
    filtered AS (
        SELECT *
        FROM base
        WHERE
            (p_kind = 'pending' AND NOT is_closed) OR
            (p_kind = 'stuck'   AND stuck_flag = 'Y') OR
            (p_kind = 'problem' AND has_problem)
    )
    SELECT jsonb_build_object(
        'kind',  p_kind,
        'total', (SELECT COUNT(*) FROM filtered),
        'cod_sum', COALESCE((SELECT SUM(cod_num) FROM filtered), 0),
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
                    problem_time,
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

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_alert_list(text, text, int, date, date) TO service_role;
