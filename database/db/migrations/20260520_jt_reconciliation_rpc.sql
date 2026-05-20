-- =====================================================================
-- Reconciliation RPCs: กระทบยอดต้นทุนที่เราคำนวณ vs ยอด J&T เรียกเก็บจริง
-- =====================================================================

-- =====================================================================
-- 1. Summary: ยอดรวม matched / overcharged / undercharged
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_jt_reconciliation_summary(date, date);

CREATE OR REPLACE FUNCTION public.get_jt_reconciliation_summary(start_date date, end_date date)
RETURNS TABLE(
    total_awb_count          bigint,
    matched_count            bigint,
    overcharged_count        bigint,
    undercharged_count       bigint,
    statement_only_count     bigint,
    shipment_only_count      bigint,
    total_our_cost           numeric,
    total_partner_cost       numeric,
    total_gap                numeric,
    overcharged_our_cost     numeric,
    overcharged_partner_cost numeric,
    overcharged_gap_total    numeric,
    undercharged_our_cost    numeric,
    undercharged_partner_cost numeric,
    undercharged_gap_total   numeric,
    date_from                date,
    date_to                  date
) AS $$
BEGIN
    IF start_date IS NULL OR end_date IS NULL THEN
        RAISE EXCEPTION 'start_date and end_date are required';
    END IF;
    IF start_date > end_date THEN
        RAISE EXCEPTION 'start_date must be less than or equal to end_date';
    END IF;

    RETURN QUERY
    WITH
    our_costs AS (
        SELECT
            j.awb_number,
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
            COALESCE(
                public.jt_numeric_text(j.gateway_vol_weight::text),
                public.jt_numeric_text(j.total_received_vol_weight::text),
                public.jt_numeric_text(j.total_vol_weight::text),
                public.jt_numeric_text(j.volumetric_weight::text)
            ) AS imported_vol_weight,
            COALESCE(
                public.jt_numeric_text(j.gateway_length::text),
                public.jt_numeric_text(j.received_length::text),
                public.jt_numeric_text(j.length::text)
            ) AS length_cm,
            COALESCE(
                public.jt_numeric_text(j.gateway_width::text),
                public.jt_numeric_text(j.received_width::text),
                public.jt_numeric_text(j.width::text)
            ) AS width_cm,
            COALESCE(
                public.jt_numeric_text(j.gateway_height::text),
                public.jt_numeric_text(j.received_height::text),
                public.jt_numeric_text(j.total_height::text)
            ) AS height_cm,
            public.jt_numeric_text(j.shipping_fee::text) AS shipping_fee_numeric
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text FROM 1 FOR 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text FROM 1 FOR 10) >= $1::text
          AND substring(j.booking_date::text FROM 1 FOR 10) <= $2::text
          AND j.awb_number IS NOT NULL
          AND j.awb_number <> ''
    ),
    our_costs_with_zone AS (
        SELECT
            c.awb_number,
            c.shipping_fee_numeric,
            z.zone_code,
            NULLIF(
                GREATEST(
                    COALESCE(c.actual_weight_kg, 0),
                    COALESCE(
                        public.jt_normalized_volumetric_weight_kg(
                            c.imported_vol_weight, c.length_cm, c.width_cm, c.height_cm
                        ), 0
                    )
                ), 0
            ) AS billable_weight_kg
        FROM our_costs c
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = c.normalized_dest_province
         AND z.is_active IS TRUE
    ),
    our_costs_final AS (
        SELECT
            s.awb_number,
            COALESCE(weight_rate.cost, fallback_cost.cost_numeric, 15) AS our_cost
        FROM our_costs_with_zone s
        LEFT JOIN LATERAL (
            SELECT r.cost
            FROM public.jt_shipping_cost_rates r
            WHERE r.carrier = 'J&T'
              AND r.zone_code = s.zone_code
              AND r.is_active IS TRUE
              AND s.billable_weight_kg IS NOT NULL
              AND r.max_billable_weight_kg >= s.billable_weight_kg
            ORDER BY r.max_billable_weight_kg ASC, r.id ASC
            LIMIT 1
        ) weight_rate ON TRUE
        LEFT JOIN LATERAL (
            SELECT public.jt_numeric_text(c.cost::text) AS cost_numeric
            FROM public.shipping_cost_master c
            WHERE c.is_active IS TRUE
              AND public.jt_numeric_text(c.sale_price::text) = s.shipping_fee_numeric
              AND public.jt_numeric_text(c.cost::text) IS NOT NULL
            LIMIT 1
        ) fallback_cost ON TRUE
    ),
    partner_costs AS (
        SELECT
            ps.awb_number,
            ABS(SUM(ps.amount)) AS partner_cost
        FROM public.jt_partner_statement ps
        WHERE ps.transaction_date >= $1
          AND ps.transaction_date <= $2
          AND ps.awb_number IS NOT NULL
          AND ps.awb_number <> ''
          AND (
              ps.charge_type ILIKE '%ต้นทุนค่าขนส่ง%'
              OR ps.charge_type ILIKE '%成本运费%'
              OR ps.charge_type ILIKE '%ปรับปรุงต้นทุน%'
              OR ps.charge_type ILIKE '%成本运费调整%'
          )
        GROUP BY ps.awb_number
    ),
    reconciled AS (
        SELECT
            COALESCE(o.awb_number, p.awb_number) AS awb_number,
            COALESCE(o.our_cost, 0)              AS our_cost,
            COALESCE(p.partner_cost, 0)          AS partner_cost,
            COALESCE(p.partner_cost, 0) - COALESCE(o.our_cost, 0) AS gap,
            CASE
                WHEN o.awb_number IS NULL THEN 'statement_only'
                WHEN p.awb_number IS NULL THEN 'shipment_only'
                WHEN ABS(COALESCE(p.partner_cost, 0) - COALESCE(o.our_cost, 0)) <= 1 THEN 'matched'
                WHEN COALESCE(p.partner_cost, 0) > COALESCE(o.our_cost, 0) THEN 'overcharged'
                ELSE 'undercharged'
            END AS recon_status
        FROM our_costs_final o
        FULL OUTER JOIN partner_costs p ON p.awb_number = o.awb_number
    )
    SELECT
        COUNT(*)                                                                         AS total_awb_count,
        COUNT(*) FILTER (WHERE r.recon_status = 'matched')                              AS matched_count,
        COUNT(*) FILTER (WHERE r.recon_status = 'overcharged')                          AS overcharged_count,
        COUNT(*) FILTER (WHERE r.recon_status = 'undercharged')                         AS undercharged_count,
        COUNT(*) FILTER (WHERE r.recon_status = 'statement_only')                       AS statement_only_count,
        COUNT(*) FILTER (WHERE r.recon_status = 'shipment_only')                        AS shipment_only_count,
        COALESCE(SUM(r.our_cost), 0)                                                    AS total_our_cost,
        COALESCE(SUM(r.partner_cost), 0)                                                AS total_partner_cost,
        COALESCE(SUM(r.gap), 0)                                                         AS total_gap,
        COALESCE(SUM(r.our_cost)     FILTER (WHERE r.recon_status = 'overcharged'), 0)  AS overcharged_our_cost,
        COALESCE(SUM(r.partner_cost) FILTER (WHERE r.recon_status = 'overcharged'), 0)  AS overcharged_partner_cost,
        COALESCE(SUM(r.gap)          FILTER (WHERE r.recon_status = 'overcharged'), 0)  AS overcharged_gap_total,
        COALESCE(SUM(r.our_cost)     FILTER (WHERE r.recon_status = 'undercharged'), 0) AS undercharged_our_cost,
        COALESCE(SUM(r.partner_cost) FILTER (WHERE r.recon_status = 'undercharged'), 0) AS undercharged_partner_cost,
        COALESCE(SUM(r.gap)          FILTER (WHERE r.recon_status = 'undercharged'), 0) AS undercharged_gap_total,
        $1 AS date_from,
        $2 AS date_to
    FROM reconciled r;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 2. Detail: รายการ AWB ระดับละเอียด (with pagination)
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_jt_reconciliation_detail(date, date, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_jt_reconciliation_detail(
    start_date    date,
    end_date      date,
    status_filter text    DEFAULT NULL,
    row_limit     integer DEFAULT 200,
    row_offset    integer DEFAULT 0
)
RETURNS TABLE(
    awb_number             text,
    booking_date           text,
    transaction_date       date,
    dest_province          text,
    zone_code              text,
    our_billable_weight_kg numeric,
    our_cost               numeric,
    partner_cost           numeric,
    gap                    numeric,
    status                 text,
    charge_types           text
) AS $$
BEGIN
    IF start_date IS NULL OR end_date IS NULL THEN
        RAISE EXCEPTION 'start_date and end_date are required';
    END IF;
    IF start_date > end_date THEN
        RAISE EXCEPTION 'start_date must be less than or equal to end_date';
    END IF;

    RETURN QUERY
    WITH
    our_costs AS (
        SELECT
            j.awb_number,
            substring(j.booking_date::text FROM 1 FOR 10) AS booking_date,
            j.dest_province::text AS dest_province,
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
            COALESCE(
                public.jt_numeric_text(j.gateway_vol_weight::text),
                public.jt_numeric_text(j.total_received_vol_weight::text),
                public.jt_numeric_text(j.total_vol_weight::text),
                public.jt_numeric_text(j.volumetric_weight::text)
            ) AS imported_vol_weight,
            COALESCE(
                public.jt_numeric_text(j.gateway_length::text),
                public.jt_numeric_text(j.received_length::text),
                public.jt_numeric_text(j.length::text)
            ) AS length_cm,
            COALESCE(
                public.jt_numeric_text(j.gateway_width::text),
                public.jt_numeric_text(j.received_width::text),
                public.jt_numeric_text(j.width::text)
            ) AS width_cm,
            COALESCE(
                public.jt_numeric_text(j.gateway_height::text),
                public.jt_numeric_text(j.received_height::text),
                public.jt_numeric_text(j.total_height::text)
            ) AS height_cm,
            public.jt_numeric_text(j.shipping_fee::text) AS shipping_fee_numeric
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text FROM 1 FOR 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text FROM 1 FOR 10) >= $1::text
          AND substring(j.booking_date::text FROM 1 FOR 10) <= $2::text
          AND j.awb_number IS NOT NULL
          AND j.awb_number <> ''
    ),
    our_with_zone AS (
        SELECT
            c.*,
            z.zone_code,
            NULLIF(
                GREATEST(
                    COALESCE(c.actual_weight_kg, 0),
                    COALESCE(
                        public.jt_normalized_volumetric_weight_kg(
                            c.imported_vol_weight, c.length_cm, c.width_cm, c.height_cm
                        ), 0
                    )
                ), 0
            ) AS billable_weight_kg
        FROM our_costs c
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = c.normalized_dest_province
         AND z.is_active IS TRUE
    ),
    our_final AS (
        SELECT
            s.awb_number,
            s.booking_date,
            s.dest_province,
            s.zone_code,
            s.billable_weight_kg,
            COALESCE(weight_rate.cost, fallback_cost.cost_numeric, 15) AS our_cost
        FROM our_with_zone s
        LEFT JOIN LATERAL (
            SELECT r.cost
            FROM public.jt_shipping_cost_rates r
            WHERE r.carrier = 'J&T'
              AND r.zone_code = s.zone_code
              AND r.is_active IS TRUE
              AND s.billable_weight_kg IS NOT NULL
              AND r.max_billable_weight_kg >= s.billable_weight_kg
            ORDER BY r.max_billable_weight_kg ASC, r.id ASC
            LIMIT 1
        ) weight_rate ON TRUE
        LEFT JOIN LATERAL (
            SELECT public.jt_numeric_text(c.cost::text) AS cost_numeric
            FROM public.shipping_cost_master c
            WHERE c.is_active IS TRUE
              AND public.jt_numeric_text(c.sale_price::text) = s.shipping_fee_numeric
              AND public.jt_numeric_text(c.cost::text) IS NOT NULL
            LIMIT 1
        ) fallback_cost ON TRUE
    ),
    partner_agg AS (
        SELECT
            ps.awb_number,
            MAX(ps.transaction_date)                                           AS transaction_date,
            ABS(SUM(ps.amount))                                                AS partner_cost,
            string_agg(DISTINCT ps.charge_type, ', ' ORDER BY ps.charge_type) AS charge_types
        FROM public.jt_partner_statement ps
        WHERE ps.transaction_date >= $1
          AND ps.transaction_date <= $2
          AND ps.awb_number IS NOT NULL
          AND ps.awb_number <> ''
          AND (
              ps.charge_type ILIKE '%ต้นทุนค่าขนส่ง%'
              OR ps.charge_type ILIKE '%成本运费%'
              OR ps.charge_type ILIKE '%ปรับปรุงต้นทุน%'
              OR ps.charge_type ILIKE '%成本运费调整%'
          )
        GROUP BY ps.awb_number
    ),
    reconciled AS (
        SELECT
            COALESCE(o.awb_number, p.awb_number)                AS awb_number,
            COALESCE(o.booking_date, '')                         AS booking_date,
            p.transaction_date                                   AS transaction_date,
            COALESCE(o.dest_province, '')                        AS dest_province,
            o.zone_code,
            o.billable_weight_kg                                 AS our_billable_weight_kg,
            COALESCE(o.our_cost, 0)                              AS our_cost,
            COALESCE(p.partner_cost, 0)                          AS partner_cost,
            COALESCE(p.partner_cost, 0) - COALESCE(o.our_cost, 0) AS gap,
            CASE
                WHEN o.awb_number IS NULL THEN 'statement_only'
                WHEN p.awb_number IS NULL THEN 'shipment_only'
                WHEN ABS(COALESCE(p.partner_cost, 0) - COALESCE(o.our_cost, 0)) <= 1 THEN 'matched'
                WHEN COALESCE(p.partner_cost, 0) > COALESCE(o.our_cost, 0) THEN 'overcharged'
                ELSE 'undercharged'
            END                                                  AS recon_status,
            COALESCE(p.charge_types, '')                         AS charge_types
        FROM our_final o
        FULL OUTER JOIN partner_agg p ON p.awb_number = o.awb_number
    )
    SELECT
        r.awb_number,
        r.booking_date,
        r.transaction_date,
        r.dest_province,
        r.zone_code,
        r.our_billable_weight_kg,
        r.our_cost,
        r.partner_cost,
        r.gap,
        r.recon_status AS status,
        r.charge_types
    FROM reconciled r
    WHERE ($3 IS NULL OR r.recon_status = $3)
    ORDER BY ABS(r.gap) DESC, r.awb_number
    LIMIT $4 OFFSET $5;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- 3. Count: จำนวน AWB ทั้งหมด (สำหรับ pagination)
-- =====================================================================
DROP FUNCTION IF EXISTS public.get_jt_reconciliation_count(date, date, text);

CREATE OR REPLACE FUNCTION public.get_jt_reconciliation_count(
    start_date    date,
    end_date      date,
    status_filter text DEFAULT NULL
)
RETURNS bigint AS $$
DECLARE
    v_count bigint;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.get_jt_reconciliation_detail(start_date, end_date, status_filter, 999999, 0);
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- Grants
-- =====================================================================
REVOKE ALL ON FUNCTION public.get_jt_reconciliation_summary(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_jt_reconciliation_detail(date, date, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_jt_reconciliation_count(date, date, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_jt_reconciliation_summary(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_jt_reconciliation_detail(date, date, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_jt_reconciliation_count(date, date, text) TO service_role;
