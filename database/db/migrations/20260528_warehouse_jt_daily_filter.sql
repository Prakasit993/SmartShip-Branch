-- 2026-05-28: Refactor RPC ทุกตัวรับ p_date_from / p_date_to (optional)
--
-- Phase 3.5 — รองรับ toggle "วันนี้ | ทั้งหมด" ในหน้า /admin/jt-warehouse
-- Filter ตาม jt_parse_arrived_date(arrived_branch_time)
--
-- p_date_from / p_date_to NULL = ไม่ filter (= ทั้งหมด)
-- ทั้งสองมีค่า = inclusive BETWEEN
--
-- ⚠️ เนื่องจาก signature เปลี่ยน (เพิ่ม args) ต้อง DROP + CREATE ใหม่
-- รันทั้ง script ใน 1 transaction → atomic, race window 0

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1. Drop functions เก่าทั้งหมด
-- ─────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_warehouse_jt_branch_summary();
DROP FUNCTION IF EXISTS public.get_warehouse_jt_branch_staff_summary();
DROP FUNCTION IF EXISTS public.get_warehouse_jt_cod_summary(text);
DROP FUNCTION IF EXISTS public.get_warehouse_jt_staff_detail(text, text);
DROP FUNCTION IF EXISTS public.get_warehouse_jt_cod_bucket_list(text, text, int);

-- ─────────────────────────────────────────────────────────────────
-- 2. สรุปต่อสาขา — รับ date filter
-- ─────────────────────────────────────────────────────────────────

CREATE FUNCTION public.get_warehouse_jt_branch_summary(
    p_date_from date DEFAULT NULL,
    p_date_to   date DEFAULT NULL
)
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
      AND (p_date_from IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) >= p_date_from)
      AND (p_date_to   IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) <= p_date_to)
    GROUP BY delivery_branch_code
    ORDER BY parcel_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_branch_summary(date, date) TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- 3. สรุปต่อพนักงาน — รับ date filter
-- ─────────────────────────────────────────────────────────────────

CREATE FUNCTION public.get_warehouse_jt_branch_staff_summary(
    p_date_from date DEFAULT NULL,
    p_date_to   date DEFAULT NULL
)
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
      AND (p_date_from IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) >= p_date_from)
      AND (p_date_to   IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) <= p_date_to)
    GROUP BY delivery_branch_code, delivery_staff_id
    ORDER BY delivery_branch_code, parcel_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_branch_staff_summary(date, date) TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- 4. COD summary — รับ date filter
-- ─────────────────────────────────────────────────────────────────

CREATE FUNCTION public.get_warehouse_jt_cod_summary(
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
    WITH pending AS (
        SELECT
            COALESCE(NULLIF(cod_amount, '')::numeric, 0) AS cod_num
        FROM public.warehouse_jt_parcels
        WHERE delivery_branch_code = p_delivery_branch_code
          AND NOT public.jt_parcel_is_closed(
              signed_time, sign_branch_name, signed_record_time,
              signed_by_staff, signer_name, sign_time_status
          )
          AND (p_date_from IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) >= p_date_from)
          AND (p_date_to   IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) <= p_date_to)
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

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_cod_summary(text, date, date) TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- 5. COD bucket drill-down list — รับ date filter
-- ─────────────────────────────────────────────────────────────────

CREATE FUNCTION public.get_warehouse_jt_cod_bucket_list(
    p_delivery_branch_code text,
    p_bucket               text,
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
            problem_reason,
            arrived_branch_time
        FROM public.warehouse_jt_parcels
        WHERE delivery_branch_code = p_delivery_branch_code
          AND NOT public.jt_parcel_is_closed(
              signed_time, sign_branch_name, signed_record_time,
              signed_by_staff, signer_name, sign_time_status
          )
          AND (p_date_from IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) >= p_date_from)
          AND (p_date_to   IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) <= p_date_to)
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

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_cod_bucket_list(text, text, int, date, date) TO service_role;

-- ─────────────────────────────────────────────────────────────────
-- 6. Staff detail (drawer) — รับ date filter
-- ─────────────────────────────────────────────────────────────────

CREATE FUNCTION public.get_warehouse_jt_staff_detail(
    p_delivery_branch_code text,
    p_delivery_staff_id    text,
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
            *,
            public.jt_parcel_is_closed(
                signed_time, sign_branch_name, signed_record_time,
                signed_by_staff, signer_name, sign_time_status
            ) AS is_closed,
            COALESCE(NULLIF(cod_amount, '')::numeric, 0) AS cod_num
        FROM public.warehouse_jt_parcels
        WHERE delivery_branch_code = p_delivery_branch_code
          AND delivery_staff_id    = p_delivery_staff_id
          AND (p_date_from IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) >= p_date_from)
          AND (p_date_to   IS NULL OR public.jt_parse_arrived_date(arrived_branch_time) <= p_date_to)
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

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_staff_detail(text, text, date, date) TO service_role;

COMMIT;

-- หมายเหตุ:
-- 1. ทุก RPC backward compat — เรียกแบบเดิม (ไม่ส่ง date params) ยังทำงานปกติ
-- 2. p_date_from / p_date_to NULL = ไม่ filter
-- 3. ทั้งสองมีค่า = inclusive BETWEEN ตาม jt_parse_arrived_date(arrived_branch_time)
-- 4. ถ้า parcel มี arrived_branch_time ว่าง / '-' / parse ไม่ได้ → จะถูก filter ออกเมื่อใส่ date range
