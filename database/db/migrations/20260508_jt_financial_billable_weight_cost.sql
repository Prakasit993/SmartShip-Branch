-- Phase 1: separate collected shipping revenue from J&T cost calculated by
-- destination zone + latest billable weight. Existing sale-price cost mapping
-- remains as a fallback until all carrier rate rows are filled.

CREATE OR REPLACE FUNCTION public.jt_numeric_text(value text)
RETURNS numeric AS $$
    SELECT CASE
        WHEN NULLIF(regexp_replace(COALESCE(value, ''), '[^0-9.-]', '', 'g'), '') ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN NULLIF(regexp_replace(COALESCE(value, ''), '[^0-9.-]', '', 'g'), '')::numeric
        ELSE NULL
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.jt_clean_province(value text)
RETURNS text AS $$
    SELECT NULLIF(
        regexp_replace(
            replace(replace(replace(lower(trim(COALESCE(value, ''))), 'จังหวัด', ''), ' ', ''), '.', ''),
            '\s+',
            '',
            'g'
        ),
        ''
    );
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.jt_normalized_volumetric_weight_kg(
    imported_value numeric,
    length_cm numeric,
    width_cm numeric,
    height_cm numeric
)
RETURNS numeric AS $$
    SELECT CASE
        WHEN imported_value IS NOT NULL AND imported_value > 500 THEN imported_value / 6000
        WHEN imported_value IS NOT NULL AND imported_value > 0 THEN imported_value
        WHEN length_cm > 0 AND width_cm > 0 AND height_cm > 0 THEN (length_cm * width_cm * height_cm) / 6000
        ELSE NULL
    END;
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS public.jt_shipping_zone_provinces (
    zone_code text NOT NULL,
    province_name text NOT NULL,
    normalized_province_name text GENERATED ALWAYS AS (public.jt_clean_province(province_name)) STORED,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (zone_code, province_name)
);

CREATE INDEX IF NOT EXISTS jt_shipping_zone_provinces_normalized_idx
    ON public.jt_shipping_zone_provinces (normalized_province_name)
    WHERE is_active IS TRUE;

CREATE TABLE IF NOT EXISTS public.jt_shipping_cost_rates (
    id bigserial PRIMARY KEY,
    carrier text NOT NULL DEFAULT 'J&T',
    zone_code text NOT NULL,
    max_billable_weight_kg numeric(10, 2) NOT NULL,
    cost numeric(10, 2) NOT NULL,
    sale_price numeric(10, 2),
    label text,
    is_active boolean NOT NULL DEFAULT true,
    effective_from date,
    effective_to date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jt_shipping_cost_rates_lookup_idx
    ON public.jt_shipping_cost_rates (carrier, zone_code, max_billable_weight_kg)
    WHERE is_active IS TRUE;

COMMENT ON TABLE public.jt_shipping_zone_provinces IS
    'Destination province to J&T cost zone mapping. Used to calculate carrier cost separately from collected shipping revenue.';

COMMENT ON TABLE public.jt_shipping_cost_rates IS
    'J&T carrier cost rates by zone and billable weight. Fill this table from the official rate card.';

INSERT INTO public.jt_shipping_zone_provinces (zone_code, province_name)
VALUES
    ('zone_1', 'กรุงเทพฯ'),
    ('zone_1', 'กรุงเทพมหานคร'),
    ('zone_1', 'ปทุมธานี'),
    ('zone_1', 'นนทบุรี'),
    ('zone_1', 'นครปฐม'),
    ('zone_1', 'สมุทรสาคร')
ON CONFLICT (zone_code, province_name) DO UPDATE
SET is_active = EXCLUDED.is_active,
    updated_at = now();

INSERT INTO public.jt_shipping_cost_rates (
    carrier,
    zone_code,
    max_billable_weight_kg,
    cost,
    sale_price,
    label
)
SELECT 'J&T', 'zone_1', v.max_billable_weight_kg, v.cost, v.sale_price, 'Phase seed: zone 1 official rate card'
FROM (
    VALUES
        (0.50::numeric, 13.00::numeric, 25.00::numeric),
        (1.00::numeric, 14.00::numeric, 29.00::numeric),
        (1.50::numeric, 15.00::numeric, 34.00::numeric),
        (2.00::numeric, 16.00::numeric, 35.00::numeric),
        (2.50::numeric, 17.00::numeric, 39.00::numeric),
        (3.00::numeric, 19.00::numeric, 40.00::numeric),
        (4.00::numeric, 28.00::numeric, 55.00::numeric),
        (5.00::numeric, 37.00::numeric, 67.00::numeric),
        (6.00::numeric, 45.00::numeric, 72.00::numeric),
        (7.00::numeric, 50.00::numeric, 87.00::numeric),
        (8.00::numeric, 125.00::numeric, 160.00::numeric),
        (9.00::numeric, 135.00::numeric, 175.00::numeric),
        (10.00::numeric, 145.00::numeric, 190.00::numeric),
        (11.00::numeric, 155.00::numeric, 205.00::numeric),
        (12.00::numeric, 165.00::numeric, 220.00::numeric),
        (13.00::numeric, 175.00::numeric, 235.00::numeric),
        (14.00::numeric, 185.00::numeric, 250.00::numeric),
        (15.00::numeric, 195.00::numeric, 265.00::numeric),
        (16.00::numeric, 250.00::numeric, 345.00::numeric),
        (17.00::numeric, 265.00::numeric, 360.00::numeric),
        (18.00::numeric, 280.00::numeric, 375.00::numeric),
        (19.00::numeric, 295.00::numeric, 390.00::numeric),
        (20.00::numeric, 310.00::numeric, 405.00::numeric),
        (21.00::numeric, 392.00::numeric, 435.00::numeric),
        (22.00::numeric, 405.00::numeric, 450.00::numeric),
        (23.00::numeric, 419.00::numeric, 465.00::numeric),
        (24.00::numeric, 432.00::numeric, 480.00::numeric),
        (25.00::numeric, 450.00::numeric, 500.00::numeric),
        (26.00::numeric, 468.00::numeric, 520.00::numeric),
        (27.00::numeric, 491.00::numeric, 545.00::numeric),
        (28.00::numeric, 513.00::numeric, 570.00::numeric),
        (29.00::numeric, 536.00::numeric, 595.00::numeric),
        (30.00::numeric, 558.00::numeric, 620.00::numeric),
        (31.00::numeric, 585.00::numeric, 650.00::numeric),
        (32.00::numeric, 612.00::numeric, 680.00::numeric),
        (33.00::numeric, 635.00::numeric, 705.00::numeric),
        (34.00::numeric, 662.00::numeric, 735.00::numeric),
        (35.00::numeric, 689.00::numeric, 765.00::numeric),
        (36.00::numeric, 716.00::numeric, 795.00::numeric),
        (37.00::numeric, 743.00::numeric, 825.00::numeric),
        (38.00::numeric, 770.00::numeric, 855.00::numeric),
        (39.00::numeric, 797.00::numeric, 885.00::numeric),
        (40.00::numeric, 824.00::numeric, 915.00::numeric),
        (41.00::numeric, 851.00::numeric, 945.00::numeric),
        (42.00::numeric, 878.00::numeric, 975.00::numeric),
        (43.00::numeric, 905.00::numeric, 1005.00::numeric),
        (44.00::numeric, 932.00::numeric, 1035.00::numeric),
        (45.00::numeric, 959.00::numeric, 1065.00::numeric),
        (46.00::numeric, 986.00::numeric, 1095.00::numeric),
        (47.00::numeric, 1013.00::numeric, 1125.00::numeric),
        (48.00::numeric, 1040.00::numeric, 1155.00::numeric),
        (49.00::numeric, 1067.00::numeric, 1185.00::numeric),
        (50.00::numeric, 1094.00::numeric, 1215.00::numeric)
) AS v(max_billable_weight_kg, cost, sale_price)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.jt_shipping_cost_rates r
    WHERE r.carrier = 'J&T'
      AND r.zone_code = 'zone_1'
      AND r.max_billable_weight_kg = v.max_billable_weight_kg
);

CREATE OR REPLACE FUNCTION public.get_financial_summary_billable_weight(start_date date, end_date date)
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
            public.jt_numeric_text(j.shipping_fee::text) AS shipping_fee_numeric,
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
            ) AS imported_volumetric_weight_kg
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text from 1 for 10) >= $1::text
          AND substring(j.booking_date::text from 1 for 10) <= $2::text
    ),
    billable_shipments AS (
        SELECT
            s.awb_number,
            COALESCE(s.shipping_fee_numeric, 0) AS shipping_fee_numeric,
            z.zone_code,
            NULLIF(
                GREATEST(
                    COALESCE(s.actual_weight_kg, 0),
                    COALESCE(public.jt_normalized_volumetric_weight_kg(
                        s.imported_volumetric_weight_kg,
                        s.length_cm,
                        s.width_cm,
                        s.height_cm
                    ),
                        0
                    )
                ),
                0
            ) AS billable_weight_kg
        FROM normalized_shipments s
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = s.normalized_dest_province
         AND z.is_active IS TRUE
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
            s.awb_number,
            s.shipping_fee_numeric,
            COALESCE(weight_cost.cost, sale_price_cost.cost_numeric, 15) AS cost_numeric
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
    )
    SELECT
        COALESCE(SUM(p.shipping_fee_numeric), 0) AS total_revenue,
        COALESCE(SUM(p.cost_numeric), 0) AS total_cost,
        COALESCE(SUM(p.shipping_fee_numeric - p.cost_numeric), 0) AS total_profit,
        COUNT(*) AS shipment_count
    FROM priced_shipments p;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_financial_daily_profit_billable_weight(start_date date, end_date date)
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
            public.jt_numeric_text(j.shipping_fee::text) AS shipping_fee_numeric,
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
            ) AS imported_volumetric_weight_kg
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text from 1 for 10) >= $1::text
          AND substring(j.booking_date::text from 1 for 10) <= $2::text
    ),
    billable_shipments AS (
        SELECT
            s.shipment_day,
            COALESCE(s.shipping_fee_numeric, 0) AS shipping_fee_numeric,
            z.zone_code,
            NULLIF(
                GREATEST(
                    COALESCE(s.actual_weight_kg, 0),
                    COALESCE(public.jt_normalized_volumetric_weight_kg(
                        s.imported_volumetric_weight_kg,
                        s.length_cm,
                        s.width_cm,
                        s.height_cm
                    ),
                        0
                    )
                ),
                0
            ) AS billable_weight_kg
        FROM normalized_shipments s
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = s.normalized_dest_province
         AND z.is_active IS TRUE
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
            s.shipment_day,
            s.shipping_fee_numeric,
            COALESCE(weight_cost.cost, sale_price_cost.cost_numeric, 15) AS cost_numeric
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

CREATE OR REPLACE FUNCTION public.get_financial_missing_cost_prices_billable_weight(start_date date, end_date date)
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
            public.jt_numeric_text(j.shipping_fee::text) AS shipping_fee_numeric,
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
            ) AS imported_volumetric_weight_kg
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text from 1 for 10) >= $1::text
          AND substring(j.booking_date::text from 1 for 10) <= $2::text
    ),
    billable_shipments AS (
        SELECT
            COALESCE(s.shipping_fee_numeric, 0) AS shipping_fee_numeric,
            z.zone_code,
            NULLIF(
                GREATEST(
                    COALESCE(s.actual_weight_kg, 0),
                    COALESCE(public.jt_normalized_volumetric_weight_kg(
                        s.imported_volumetric_weight_kg,
                        s.length_cm,
                        s.width_cm,
                        s.height_cm
                    ),
                        0
                    )
                ),
                0
            ) AS billable_weight_kg
        FROM normalized_shipments s
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = s.normalized_dest_province
         AND z.is_active IS TRUE
    ),
    normalized_costs AS (
        SELECT
            public.jt_numeric_text(c.sale_price::text) AS sale_price_numeric,
            public.jt_numeric_text(c.cost::text) AS cost_numeric
        FROM public.shipping_cost_master c
        WHERE c.is_active IS TRUE
    ),
    unpriced_shipments AS (
        SELECT s.shipping_fee_numeric
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
        WHERE weight_cost.cost IS NULL
          AND sale_price_cost.cost_numeric IS NULL
          AND s.shipping_fee_numeric IS NOT NULL
    )
    SELECT
        s.shipping_fee_numeric AS sale_price,
        COUNT(*) AS shipment_count,
        COALESCE(SUM(s.shipping_fee_numeric), 0) AS total_revenue,
        COUNT(*) * 15::numeric AS default_cost_total,
        COALESCE(SUM(s.shipping_fee_numeric - 15), 0) AS estimated_profit_with_default_cost
    FROM unpriced_shipments s
    GROUP BY s.shipping_fee_numeric
    ORDER BY shipment_count DESC, sale_price ASC
    LIMIT 25;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_financial_cost_audit_billable_weight(
    start_date date,
    end_date date,
    row_limit integer DEFAULT 100
)
RETURNS TABLE(
    awb_number text,
    booking_date text,
    dest_province text,
    zone_code text,
    shipping_fee numeric,
    actual_weight_kg numeric,
    volumetric_weight_kg numeric,
    billable_weight_kg numeric,
    matched_rate_weight_kg numeric,
    cost numeric,
    profit numeric,
    cost_source text
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
            substring(j.booking_date::text from 1 for 10) AS booking_date,
            j.dest_province::text AS dest_province,
            public.jt_numeric_text(j.shipping_fee::text) AS shipping_fee_numeric,
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
            ) AS imported_volumetric_weight_kg
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text from 1 for 10) >= $1::text
          AND substring(j.booking_date::text from 1 for 10) <= $2::text
    ),
    billable_shipments AS (
        SELECT
            s.awb_number,
            s.booking_date,
            s.dest_province,
            COALESCE(s.shipping_fee_numeric, 0) AS shipping_fee_numeric,
            z.zone_code,
            s.actual_weight_kg,
            public.jt_normalized_volumetric_weight_kg(
                s.imported_volumetric_weight_kg,
                s.length_cm,
                s.width_cm,
                s.height_cm
            ) AS volumetric_weight_kg
        FROM normalized_shipments s
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = s.normalized_dest_province
         AND z.is_active IS TRUE
    ),
    with_billable AS (
        SELECT
            s.*,
            NULLIF(
                GREATEST(
                    COALESCE(s.actual_weight_kg, 0),
                    COALESCE(s.volumetric_weight_kg, 0)
                ),
                0
            ) AS billable_weight_kg
        FROM billable_shipments s
    ),
    normalized_costs AS (
        SELECT
            public.jt_numeric_text(c.sale_price::text) AS sale_price_numeric,
            public.jt_numeric_text(c.cost::text) AS cost_numeric
        FROM public.shipping_cost_master c
        WHERE c.is_active IS TRUE
    )
    SELECT
        s.awb_number,
        s.booking_date,
        s.dest_province,
        s.zone_code,
        s.shipping_fee_numeric AS shipping_fee,
        s.actual_weight_kg,
        s.volumetric_weight_kg,
        s.billable_weight_kg,
        weight_cost.max_billable_weight_kg AS matched_rate_weight_kg,
        COALESCE(weight_cost.cost, sale_price_cost.cost_numeric, 15) AS cost,
        s.shipping_fee_numeric - COALESCE(weight_cost.cost, sale_price_cost.cost_numeric, 15) AS profit,
        CASE
            WHEN weight_cost.cost IS NOT NULL THEN 'billable_weight_rate'
            WHEN sale_price_cost.cost_numeric IS NOT NULL THEN 'sale_price_fallback'
            ELSE 'default_15'
        END AS cost_source
    FROM with_billable s
    LEFT JOIN LATERAL (
        SELECT r.max_billable_weight_kg, r.cost
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
    ORDER BY s.booking_date DESC, s.awb_number ASC
    LIMIT LEAST(GREATEST(COALESCE(row_limit, 100), 1), 500);
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.jt_numeric_text(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.jt_clean_province(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.jt_normalized_volumetric_weight_kg(numeric, numeric, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_summary_billable_weight(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_daily_profit_billable_weight(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_missing_cost_prices_billable_weight(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_financial_cost_audit_billable_weight(date, date, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.jt_numeric_text(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.jt_clean_province(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.jt_normalized_volumetric_weight_kg(numeric, numeric, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_summary_billable_weight(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_daily_profit_billable_weight(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_missing_cost_prices_billable_weight(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_cost_audit_billable_weight(date, date, integer) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jt_shipping_zone_provinces TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jt_shipping_cost_rates TO service_role;

DO $$
BEGIN
    IF to_regclass('public.jt_shipping_cost_rates_id_seq') IS NOT NULL THEN
        GRANT USAGE, SELECT ON SEQUENCE public.jt_shipping_cost_rates_id_seq TO service_role;
    END IF;
END;
$$;
