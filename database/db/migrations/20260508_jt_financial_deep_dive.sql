CREATE OR REPLACE FUNCTION public.get_financial_daily_profit(start_date date, end_date date)
RETURNS TABLE(
    day date,
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
            substring(j.booking_date::text from 1 for 10)::date AS shipment_day,
            CASE
                WHEN NULLIF(regexp_replace(COALESCE(j.shipping_fee::text, ''), '[^0-9.-]', '', 'g'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN NULLIF(regexp_replace(COALESCE(j.shipping_fee::text, ''), '[^0-9.-]', '', 'g'), '')::numeric
                ELSE NULL
            END AS shipping_fee_numeric
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text from 1 for 10) >= $1::text
          AND substring(j.booking_date::text from 1 for 10) <= $2::text
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
            s.shipment_day,
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
        p.shipment_day AS day,
        COALESCE(SUM(p.shipping_fee_numeric), 0) AS total_revenue,
        COALESCE(SUM(p.cost_numeric), 0) AS total_cost,
        COALESCE(SUM(p.shipping_fee_numeric - p.cost_numeric), 0) AS total_profit,
        COUNT(*) AS shipment_count
    FROM priced_shipments p
    GROUP BY p.shipment_day
    ORDER BY p.shipment_day;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_financial_missing_cost_prices(start_date date, end_date date)
RETURNS TABLE(
    sale_price numeric,
    shipment_count bigint,
    total_revenue numeric,
    default_cost_total numeric,
    estimated_profit_with_default_cost numeric
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
            CASE
                WHEN NULLIF(regexp_replace(COALESCE(j.shipping_fee::text, ''), '[^0-9.-]', '', 'g'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
                    THEN NULLIF(regexp_replace(COALESCE(j.shipping_fee::text, ''), '[^0-9.-]', '', 'g'), '')::numeric
                ELSE NULL
            END AS shipping_fee_numeric
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text from 1 for 10) >= $1::text
          AND substring(j.booking_date::text from 1 for 10) <= $2::text
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
    )
    SELECT
        s.shipping_fee_numeric AS sale_price,
        COUNT(*) AS shipment_count,
        COALESCE(SUM(s.shipping_fee_numeric), 0) AS total_revenue,
        COUNT(*) * 15::numeric AS default_cost_total,
        COALESCE(SUM(s.shipping_fee_numeric - 15), 0) AS estimated_profit_with_default_cost
    FROM normalized_shipments s
    WHERE s.shipping_fee_numeric IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM normalized_costs c
          WHERE c.sale_price_numeric = s.shipping_fee_numeric
            AND c.cost_numeric IS NOT NULL
      )
    GROUP BY s.shipping_fee_numeric
    ORDER BY shipment_count DESC, sale_price ASC
    LIMIT 25;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.get_financial_daily_profit(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_missing_cost_prices(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_daily_profit(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_missing_cost_prices(date, date) TO service_role;
