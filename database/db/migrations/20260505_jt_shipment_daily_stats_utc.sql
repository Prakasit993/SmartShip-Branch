-- Daily count + sum(shipping_fee) by UTC calendar day.
-- booking_date / shipping_fee may be stored as text in some deployments — parse safely.
CREATE OR REPLACE FUNCTION public.jt_shipment_daily_stats_utc(p_start date, p_end date)
RETURNS TABLE(day date, cnt bigint, fee_sum numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH rows AS (
        SELECT
            (substring(trim(bs.booking_date::text) FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})'))::date AS day,
            CASE
                WHEN trim(COALESCE(bs.shipping_fee::text, '')) = '' THEN 0::numeric
                WHEN regexp_replace(trim(COALESCE(bs.shipping_fee::text, '')), '[^0-9.\-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN regexp_replace(trim(COALESCE(bs.shipping_fee::text, '')), '[^0-9.\-]', '', 'g')::numeric
                ELSE 0::numeric
            END AS fee_num
        FROM public.jt_shipments bs
        WHERE bs.booking_date IS NOT NULL
          AND trim(bs.booking_date::text) <> ''
          AND substring(trim(bs.booking_date::text) FROM '^([0-9]{4}-[0-9]{2}-[0-9]{2})') IS NOT NULL
    )
    SELECT
        r.day,
        COUNT(*)::bigint AS cnt,
        ROUND(COALESCE(SUM(r.fee_num), 0), 2)::numeric AS fee_sum
    FROM rows r
    WHERE r.day >= p_start
      AND r.day <= p_end
    GROUP BY r.day
    ORDER BY r.day;
$$;

REVOKE ALL ON FUNCTION public.jt_shipment_daily_stats_utc(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_shipment_daily_stats_utc(date, date) TO service_role;
