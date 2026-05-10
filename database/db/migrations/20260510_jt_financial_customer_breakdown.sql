CREATE OR REPLACE FUNCTION public.get_financial_customer_breakdown_billable_weight(
    start_date date,
    end_date date,
    row_limit integer DEFAULT 10
)
RETURNS TABLE(
    customer_name text,
    shipment_count bigint,
    total_revenue numeric,
    total_cost numeric,
    total_profit numeric,
    avg_profit_per_shipment numeric
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
            COALESCE(NULLIF(trim(j.sender_name::text), ''), 'ไม่ระบุลูกค้า') AS customer_name,
            public.jt_numeric_text(j.shipping_fee::text) AS shipping_fee_numeric,
            public.jt_numeric_text(j.total_shipping_fee::text) AS total_shipping_fee_numeric,
            public.jt_clean_province(j.dest_province::text) AS normalized_dest_province,
            COALESCE(
                public.jt_numeric_text(j.billed_weight::text),
                public.jt_numeric_text(j.gateway_weight::text),
                public.jt_numeric_text(j.gateway_received_weight::text),
                public.jt_numeric_text(j.received_weight::text),
                public.jt_numeric_text(j.center_weight::text),
                public.jt_numeric_text(j.order_weight::text),
                public.jt_numeric_text(j.avg_weight::text)
            ) AS actual_weight_kg,
            COALESCE(public.jt_numeric_text(j.gateway_length::text), public.jt_numeric_text(j.received_length::text), public.jt_numeric_text(j.length::text)) AS length_cm,
            COALESCE(public.jt_numeric_text(j.gateway_width::text), public.jt_numeric_text(j.received_width::text), public.jt_numeric_text(j.width::text)) AS width_cm,
            COALESCE(public.jt_numeric_text(j.gateway_height::text), public.jt_numeric_text(j.received_height::text), public.jt_numeric_text(j.total_height::text)) AS height_cm,
            COALESCE(
                public.jt_numeric_text(j.gateway_vol_weight::text),
                public.jt_numeric_text(j.total_received_vol_weight::text),
                public.jt_numeric_text(j.total_vol_weight::text),
                public.jt_numeric_text(j.volumetric_weight::text)
            ) AS imported_volumetric_weight_kg,
            public.jt_numeric_text(j.remote_area_fee::text) AS remote_area_fee_cost,
            public.jt_numeric_text(j.other_fees::text) AS other_fee_cost,
            public.jt_numeric_text(j.insurance_fee::text) AS insurance_fee_cost,
            public.jt_numeric_text(j.return_fee::text) AS return_fee_cost,
            public.jt_numeric_text(j.cod_amount::text) AS cod_amount_numeric
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text from 1 for 10) >= $1::text
          AND substring(j.booking_date::text from 1 for 10) <= $2::text
    ),
    billable_shipments AS (
        SELECT
            s.customer_name,
            COALESCE(s.shipping_fee_numeric, 0) AS shipping_fee_numeric,
            COALESCE(NULLIF(s.total_shipping_fee_numeric, 0), s.shipping_fee_numeric, 0) AS revenue_numeric,
            z.zone_code,
            NULLIF(
                GREATEST(
                    COALESCE(s.actual_weight_kg, 0),
                    COALESCE(public.jt_normalized_volumetric_weight_kg(
                        s.imported_volumetric_weight_kg,
                        s.length_cm,
                        s.width_cm,
                        s.height_cm
                    ), 0)
                ),
                0
            ) AS billable_weight_kg,
            COALESCE(s.remote_area_fee_cost, 0) AS remote_area_fee_cost,
            COALESCE(s.other_fee_cost, 0) AS other_fee_cost,
            COALESCE(s.insurance_fee_cost, 0) AS insurance_fee_cost,
            COALESCE(s.return_fee_cost, 0) AS return_fee_cost,
            COALESCE(cod_fee.cost, 0) AS cod_fee_cost
        FROM normalized_shipments s
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = s.normalized_dest_province
         AND z.is_active IS TRUE
        LEFT JOIN LATERAL (
            SELECT CASE
                WHEN r.fee_type = 'percent' THEN COALESCE(s.cod_amount_numeric, 0) * r.fee_value / 100
                ELSE r.fee_value
            END AS cost
            FROM public.jt_cod_fee_rules r
            WHERE r.is_active IS TRUE
              AND COALESCE(s.cod_amount_numeric, 0) > 0
              AND COALESCE(s.cod_amount_numeric, 0) >= r.min_cod_amount
              AND (r.max_cod_amount IS NULL OR COALESCE(s.cod_amount_numeric, 0) <= r.max_cod_amount)
              AND (r.effective_from IS NULL OR r.effective_from <= $2)
              AND (r.effective_to IS NULL OR r.effective_to >= $1)
            ORDER BY r.min_cod_amount DESC, r.id ASC
            LIMIT 1
        ) cod_fee ON TRUE
    ),
    normalized_costs AS (
        SELECT
            public.jt_numeric_text(c.sale_price::text) AS sale_price_numeric,
            public.jt_numeric_text(c.cost::text) AS cost_numeric
        FROM public.shipping_cost_master c
        WHERE c.is_active IS TRUE
    ),
    priced_shipments AS (
        SELECT
            s.customer_name,
            s.revenue_numeric,
            COALESCE(weight_cost.cost, sale_price_cost.cost_numeric, 15)
                + s.remote_area_fee_cost
                + s.other_fee_cost
                + s.insurance_fee_cost
                + s.return_fee_cost
                + s.cod_fee_cost AS cost_numeric
        FROM billable_shipments s
        LEFT JOIN LATERAL (
            SELECT r.cost
            FROM public.jt_shipping_cost_rates r
            WHERE r.carrier = 'J&T'
              AND r.zone_code = s.zone_code
              AND r.is_active IS TRUE
              AND (r.effective_from IS NULL OR r.effective_from <= $2)
              AND (r.effective_to IS NULL OR r.effective_to >= $1)
              AND s.billable_weight_kg IS NOT NULL
              AND r.max_billable_weight_kg >= s.billable_weight_kg
            ORDER BY r.max_billable_weight_kg ASC, r.id ASC
            LIMIT 1
        ) weight_cost ON TRUE
        LEFT JOIN LATERAL (
            SELECT c.cost_numeric
            FROM normalized_costs c
            WHERE c.sale_price_numeric = s.shipping_fee_numeric
              AND c.cost_numeric IS NOT NULL
            LIMIT 1
        ) sale_price_cost ON TRUE
    ),
    grouped AS (
        SELECT
            p.customer_name,
            COUNT(*) AS shipment_count,
            COALESCE(SUM(p.revenue_numeric), 0) AS total_revenue,
            COALESCE(SUM(p.cost_numeric), 0) AS total_cost,
            COALESCE(SUM(p.revenue_numeric - p.cost_numeric), 0) AS total_profit
        FROM priced_shipments p
        GROUP BY p.customer_name
    )
    SELECT
        g.customer_name,
        g.shipment_count,
        g.total_revenue,
        g.total_cost,
        g.total_profit,
        CASE WHEN g.shipment_count > 0 THEN g.total_profit / g.shipment_count ELSE 0 END AS avg_profit_per_shipment
    FROM grouped g
    ORDER BY g.shipment_count DESC, g.total_profit DESC, g.customer_name ASC
    LIMIT LEAST(GREATEST(COALESCE(row_limit, 10), 1), 50);
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.get_financial_customer_breakdown_billable_weight(date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_financial_customer_breakdown_billable_weight(date, date, integer) TO service_role;
