-- ======================================================================
-- SLA Calendar: aggregate COD-pending, exception, and return counts
-- per booking_date day — replaces the JS pagination loop in the
-- sla-calendar API route with a single SQL query.
--
-- IMPORTANT: "return" filtering relies on the jt_return_acknowledgements
-- table AND hard-coded exclusion rules (sign_branch_name / delivery_staff_id).
-- The acknowledged-returns exclusion is performed via a LEFT JOIN so that
-- all logic runs inside PostgreSQL.
-- ======================================================================

CREATE OR REPLACE FUNCTION public.get_sla_calendar_daily_stats(
    p_start date,
    p_end    date,
    p_excluded_sign_branch_name  text   DEFAULT '04Lam Luk Ka067',
    p_excluded_delivery_staff_ids text[] DEFAULT ARRAY['604911501','604911502','604911503']
)
RETURNS TABLE(
    day           date,
    cod_pending   bigint,
    exceptions    bigint,
    returns       bigint,
    total         bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH
    /* Parse booking_date text → date, filter to the requested range */
    base AS (
        SELECT
            s.*,
            (substring(trim(s.booking_date::text) FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})'))::date AS bday
        FROM public.jt_shipments s
        WHERE s.booking_date IS NOT NULL
          AND trim(s.booking_date::text) <> ''
          AND substring(trim(s.booking_date::text) FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})') IS NOT NULL
          AND (substring(trim(s.booking_date::text) FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})'))::date
              BETWEEN p_start AND p_end
    ),

    /* Find acknowledged returns (active status) */
    ack AS (
        SELECT trim(a.awb_number::text) AS awb
        FROM public.jt_return_acknowledgements a
        WHERE a.status = 'active'
          AND trim(COALESCE(a.awb_number::text, '')) <> ''
    ),

    /* Classify each row */
    classified AS (
        SELECT
            b.bday,

            /* COD pending: cod_amount > 0 AND cod_status is NOT paid */
            CASE
                WHEN (
                    CASE
                        WHEN trim(COALESCE(b.cod_amount::text, '')) = '' THEN 0
                        WHEN regexp_replace(trim(COALESCE(b.cod_amount::text, '')), '[^0-9.\-]', '', 'g')
                             ~ '^-?[0-9]+(\.[0-9]+)?$'
                            THEN regexp_replace(trim(COALESCE(b.cod_amount::text, '')), '[^0-9.\-]', '', 'g')::numeric
                        ELSE 0
                    END
                ) > 0
                AND NOT (
                    lower(trim(COALESCE(b.cod_status::text, ''))) LIKE 'ชำระ%'
                    OR lower(trim(COALESCE(b.cod_status::text, ''))) = 'paid'
                    OR lower(trim(COALESCE(b.cod_status::text, ''))) = 'cod paid'
                )
                THEN 1 ELSE 0
            END AS is_cod_pending,

            /* Exception open: has reason AND reason <> 'null' AND sign_branch_code is empty */
            CASE
                WHEN trim(COALESCE(b.exception_reason::text, '')) <> ''
                 AND lower(trim(COALESCE(b.exception_reason::text, ''))) <> 'null'
                 AND trim(COALESCE(b.sign_branch_code::text, '')) = ''
                THEN 1 ELSE 0
            END AS is_exception,

            /* Return open: meaningful return_type AND not acknowledged AND not excluded */
            CASE
                WHEN trim(COALESCE(b.return_type::text, '')) <> ''
                 AND upper(trim(COALESCE(b.return_type::text, ''))) NOT IN ('EMPTY', 'NULL', '-')
                 AND ack.awb IS NULL  -- not acknowledged
                 AND trim(COALESCE(b.sign_branch_name::text, '')) <> p_excluded_sign_branch_name
                 AND NOT (trim(COALESCE(b.delivery_staff_id::text, '')) = ANY(p_excluded_delivery_staff_ids))
                THEN 1 ELSE 0
            END AS is_return

        FROM base b
        LEFT JOIN ack ON ack.awb = trim(COALESCE(b.awb_number::text, ''))
    )

    SELECT
        c.bday                       AS day,
        SUM(c.is_cod_pending)::bigint AS cod_pending,
        SUM(c.is_exception)::bigint   AS exceptions,
        SUM(c.is_return)::bigint      AS returns,
        (SUM(c.is_cod_pending) + SUM(c.is_exception) + SUM(c.is_return))::bigint AS total
    FROM classified c
    GROUP BY c.bday
    HAVING (SUM(c.is_cod_pending) + SUM(c.is_exception) + SUM(c.is_return)) > 0
    ORDER BY c.bday;
$$;

REVOKE ALL ON FUNCTION public.get_sla_calendar_daily_stats(date, date, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sla_calendar_daily_stats(date, date, text, text[]) TO service_role;
