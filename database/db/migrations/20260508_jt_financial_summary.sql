CREATE OR REPLACE FUNCTION public.get_financial_summary(start_date date, end_date date)
RETURNS TABLE(
    total_revenue numeric,
    total_cost numeric,
    total_profit numeric,
    shipment_count bigint
) AS $$
BEGIN
    IF start_date IS NULL OR end_date IS NULL THEN
        RAISE EXCEPTION 'start_date and end_date are required';
    END IF;

    IF start_date > end_date THEN
        RAISE EXCEPTION 'start_date must be less than or equal to end_date';
    END IF;

    RETURN QUERY
    WITH normalized_shipments AS (
        SELECT
            j.awb_number,
            CASE
                WHEN NULLIF(regexp_replace(COALESCE(j.shipping_fee::text, ''), '[^0-9.-]', '', 'g'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN NULLIF(regexp_replace(COALESCE(j.shipping_fee::text, ''), '[^0-9.-]', '', 'g'), '')::numeric
                ELSE NULL
            END AS shipping_fee_numeric
        FROM public.jt_shipments j
        WHERE j.booking_date IS NOT NULL
          AND j.booking_date::text >= $1::text
          AND j.booking_date::text < ($2 + INTERVAL '1 day')::date::text
    ),
    normalized_costs AS (
        SELECT
            CASE
                WHEN NULLIF(regexp_replace(COALESCE(c.sale_price::text, ''), '[^0-9.-]', '', 'g'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN NULLIF(regexp_replace(COALESCE(c.sale_price::text, ''), '[^0-9.-]', '', 'g'), '')::numeric
                ELSE NULL
            END AS sale_price_numeric,
            CASE
                WHEN NULLIF(regexp_replace(COALESCE(c.cost::text, ''), '[^0-9.-]', '', 'g'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN NULLIF(regexp_replace(COALESCE(c.cost::text, ''), '[^0-9.-]', '', 'g'), '')::numeric
                ELSE NULL
            END AS cost_numeric
        FROM public.shipping_cost_master c
        WHERE c.is_active IS TRUE
    ),
    priced_shipments AS (
        SELECT
            s.awb_number,
            COALESCE(s.shipping_fee_numeric, 0) AS shipping_fee_numeric,
            COALESCE(matched_cost.cost_numeric, 15) AS cost_numeric
        FROM normalized_shipments s
        LEFT JOIN LATERAL (
            SELECT c.cost_numeric
            FROM normalized_costs c
            WHERE c.sale_price_numeric = s.shipping_fee_numeric
              AND c.cost_numeric IS NOT NULL
            LIMIT 1
        ) matched_cost ON TRUE
    )
    SELECT
        COALESCE(SUM(p.shipping_fee_numeric), 0) AS total_revenue,
        COALESCE(SUM(p.cost_numeric), 0) AS total_cost,
        COALESCE(SUM(p.shipping_fee_numeric - p.cost_numeric), 0) AS total_profit,
        COUNT(*) AS shipment_count
    FROM priced_shipments p;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.get_financial_summary(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_summary(date, date) TO service_role;
