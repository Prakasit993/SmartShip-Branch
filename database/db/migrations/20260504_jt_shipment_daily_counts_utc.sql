-- Aggregate shipment counts by UTC calendar day (matches app utcDayKey bucketing)
CREATE OR REPLACE FUNCTION public.jt_shipment_daily_counts_utc(p_start date, p_end date)
RETURNS TABLE(day date, cnt bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT ((booking_date AT TIME ZONE 'UTC')::date) AS day, COUNT(*)::bigint AS cnt
    FROM public.jt_shipments
    WHERE booking_date IS NOT NULL
      AND ((booking_date AT TIME ZONE 'UTC')::date) >= p_start
      AND ((booking_date AT TIME ZONE 'UTC')::date) <= p_end
    GROUP BY 1
    ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION public.jt_shipment_daily_counts_utc(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_shipment_daily_counts_utc(date, date) TO service_role;
