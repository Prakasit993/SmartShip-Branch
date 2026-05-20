-- 20260520_jt_reconciliation_daily_rpc.sql
-- สรุปรายวัน: เทียบ "ต้นทุนรวมที่ระบบประเมิน" vs "ยอดรวมที่ J&T เรียกเก็บจริง" ต่อวัน
--
-- ฝั่งระบบ (jt_shipments): ใช้ logic เดียวกับ get_financial_component_summary_billable_weight
--   ครบทุกต้นทุน = ค่าส่งฐาน + พื้นที่ห่างไกล + COD + อื่นๆ + ประกัน + ตีกลับ
-- ฝั่ง J&T (jt_partner_statement): แยก ค่าส่ง / ปรับปรุงต้นทุน / พื้นที่ห่างไกล / อื่นๆ
--
-- amounts ใน jt_partner_statement: ลบ = ต้นทุน/เดบิต, บวก = เครดิต/คืนเงิน
--   ฟังก์ชันคืนค่าแบบ "กลับเครื่องหมาย" (-SUM) → ต้นทุนเป็นบวก, เครดิตเป็นลบ
--   ทำให้ทุกหมวดบวกกันได้เท่ากับยอดรวมพอดี (categorize แบบ exclusive)
--
-- diff = ยอดรวม J&T - ยอดรวมระบบ (บวก = J&T เก็บเกิน = แดง, ลบ = เก็บน้อยกว่า = เขียว)

DROP FUNCTION IF EXISTS public.jt_reconciliation_daily_summary(text, text);

CREATE OR REPLACE FUNCTION public.jt_reconciliation_daily_summary(
    p_date_from text,
    p_date_to text
)
RETURNS TABLE (
    transaction_date           text,
    -- ฝั่งระบบประเมิน (jt_shipments)
    system_base_shipping       numeric,
    system_remote_area_fee     numeric,
    system_cod_fee             numeric,
    system_other_fee           numeric,
    system_insurance_fee       numeric,
    system_return_fee          numeric,
    system_total_cost          numeric,
    -- ฝั่ง J&T เรียกเก็บ (jt_partner_statement)
    statement_shipping_cost    numeric,
    statement_adjustment_cost  numeric,
    statement_remote_area_fee  numeric,
    statement_other_fees       numeric,
    statement_total_cost       numeric,
    charge_breakdown           jsonb,
    -- ผลต่างยอดรวม
    diff                       numeric
) AS $$
DECLARE
    v_from date := NULLIF(trim(p_date_from), '')::date;
    v_to   date := NULLIF(trim(p_date_to), '')::date;
BEGIN
    RETURN QUERY
    WITH

    -- ═══════════════════════════════════════════════════════════════════════
    -- ฝั่ง J&T Statement
    -- ═══════════════════════════════════════════════════════════════════════
    statement_by_type AS (
        SELECT
            ps.transaction_date,
            ps.charge_type,
            -- จัดหมวดแบบ exclusive: 1 charge_type → 1 หมวดเท่านั้น
            CASE
                WHEN ps.charge_type ILIKE '%ปรับปรุง%' AND ps.charge_type ILIKE '%ต้นทุนค่าขนส่ง%' THEN 'adjustment'
                WHEN ps.charge_type ILIKE '%ต้นทุนค่าขนส่ง%'                                       THEN 'shipping'
                WHEN ps.charge_type ILIKE '%ค่าพื้นที่ห่างไกล%'                                     THEN 'remote'
                ELSE 'other'
            END AS category,
            SUM(ps.amount) AS amount_sum
        FROM public.jt_partner_statement ps
        WHERE
            (v_from IS NULL OR ps.transaction_date >= v_from)
            AND (v_to IS NULL OR ps.transaction_date <= v_to)
        GROUP BY ps.transaction_date, ps.charge_type
    ),
    statement_daily AS (
        SELECT
            TO_CHAR(s.transaction_date, 'YYYY-MM-DD')                              AS tx_date,
            -COALESCE(SUM(s.amount_sum) FILTER (WHERE s.category = 'shipping'), 0)   AS shipping_cost,
            -COALESCE(SUM(s.amount_sum) FILTER (WHERE s.category = 'adjustment'), 0) AS adjustment_cost,
            -COALESCE(SUM(s.amount_sum) FILTER (WHERE s.category = 'remote'), 0)     AS remote_area_fee,
            -COALESCE(SUM(s.amount_sum) FILTER (WHERE s.category = 'other'), 0)      AS other_fees,
            -COALESCE(SUM(s.amount_sum), 0)                                          AS total_amount,
            jsonb_object_agg(COALESCE(s.charge_type, 'อื่นๆ'), -s.amount_sum)        AS breakdown
        FROM statement_by_type s
        GROUP BY TO_CHAR(s.transaction_date, 'YYYY-MM-DD')
    ),

    -- ═══════════════════════════════════════════════════════════════════════
    -- ฝั่งระบบ (jt_shipments) — logic เดียวกับ Financial tab
    -- ═══════════════════════════════════════════════════════════════════════
    sys_normalized AS (
        SELECT
            LEFT(j.booking_date::text, 10)                                         AS tx_date,
            public.jt_numeric_text(j.shipping_fee::text)                            AS shipping_fee_numeric,
            public.jt_clean_province(j.dest_province::text)                         AS normalized_dest_province,
            COALESCE(
                public.jt_numeric_text(j.billed_weight::text),
                public.jt_numeric_text(j.gateway_weight::text),
                public.jt_numeric_text(j.gateway_received_weight::text),
                public.jt_numeric_text(j.received_weight::text),
                public.jt_numeric_text(j.center_weight::text),
                public.jt_numeric_text(j.order_weight::text),
                public.jt_numeric_text(j.avg_weight::text)
            )                                                                        AS actual_weight_kg,
            COALESCE(public.jt_numeric_text(j.gateway_length::text), public.jt_numeric_text(j.received_length::text), public.jt_numeric_text(j.length::text))    AS length_cm,
            COALESCE(public.jt_numeric_text(j.gateway_width::text),  public.jt_numeric_text(j.received_width::text),  public.jt_numeric_text(j.width::text))     AS width_cm,
            COALESCE(public.jt_numeric_text(j.gateway_height::text), public.jt_numeric_text(j.received_height::text), public.jt_numeric_text(j.total_height::text)) AS height_cm,
            COALESCE(
                public.jt_numeric_text(j.gateway_vol_weight::text),
                public.jt_numeric_text(j.total_received_vol_weight::text),
                public.jt_numeric_text(j.total_vol_weight::text),
                public.jt_numeric_text(j.volumetric_weight::text)
            )                                                                        AS imported_vol_weight,
            public.jt_numeric_text(j.remote_area_fee::text)                         AS remote_area_fee_cost,
            public.jt_numeric_text(j.other_fees::text)                              AS other_fee_cost,
            public.jt_numeric_text(j.insurance_fee::text)                           AS insurance_fee_cost,
            public.jt_numeric_text(j.return_fee::text)                              AS return_fee_cost,
            public.jt_numeric_text(j.cod_amount::text)                              AS cod_amount_numeric
        FROM public.jt_shipments j
        WHERE j.booking_date IS NOT NULL
          AND LEFT(j.booking_date::text, 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND (v_from IS NULL OR LEFT(j.booking_date::text, 10) >= p_date_from)
          AND (v_to   IS NULL OR LEFT(j.booking_date::text, 10) <= p_date_to)
    ),
    sys_billable AS (
        SELECT
            s.tx_date,
            COALESCE(s.shipping_fee_numeric, 0) AS shipping_fee_numeric,
            z.zone_code,
            NULLIF(GREATEST(
                COALESCE(s.actual_weight_kg, 0),
                COALESCE(public.jt_normalized_volumetric_weight_kg(
                    s.imported_vol_weight, s.length_cm, s.width_cm, s.height_cm
                ), 0)
            ), 0) AS billable_weight_kg,
            COALESCE(s.remote_area_fee_cost, 0) AS remote_area_fee_cost,
            COALESCE(s.other_fee_cost, 0)       AS other_fee_cost,
            COALESCE(s.insurance_fee_cost, 0)   AS insurance_fee_cost,
            COALESCE(s.return_fee_cost, 0)      AS return_fee_cost,
            COALESCE(cod_fee.cost, 0)           AS cod_fee_cost
        FROM sys_normalized s
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
              AND (v_to   IS NULL OR r.effective_from IS NULL OR r.effective_from <= v_to)
              AND (v_from IS NULL OR r.effective_to   IS NULL OR r.effective_to   >= v_from)
            ORDER BY r.min_cod_amount DESC, r.id ASC
            LIMIT 1
        ) cod_fee ON TRUE
    ),
    sys_priced AS (
        SELECT
            s.tx_date,
            COALESCE(weight_cost.cost, sale_price_cost.cost_numeric, 15) AS base_shipping_cost,
            s.remote_area_fee_cost,
            s.other_fee_cost,
            s.insurance_fee_cost,
            s.return_fee_cost,
            s.cod_fee_cost
        FROM sys_billable s
        LEFT JOIN LATERAL (
            SELECT r.cost
            FROM public.jt_shipping_cost_rates r
            WHERE r.carrier = 'J&T'
              AND r.zone_code = s.zone_code
              AND r.is_active IS TRUE
              AND (v_to   IS NULL OR r.effective_from IS NULL OR r.effective_from <= v_to)
              AND (v_from IS NULL OR r.effective_to   IS NULL OR r.effective_to   >= v_from)
              AND s.billable_weight_kg IS NOT NULL
              AND r.max_billable_weight_kg >= s.billable_weight_kg
            ORDER BY r.max_billable_weight_kg ASC, r.id ASC
            LIMIT 1
        ) weight_cost ON TRUE
        LEFT JOIN LATERAL (
            SELECT public.jt_numeric_text(c.cost::text) AS cost_numeric
            FROM public.shipping_cost_master c
            WHERE c.is_active IS TRUE
              AND public.jt_numeric_text(c.sale_price::text) = s.shipping_fee_numeric
              AND public.jt_numeric_text(c.cost::text) IS NOT NULL
            LIMIT 1
        ) sale_price_cost ON TRUE
    ),
    system_daily AS (
        SELECT
            p.tx_date,
            ROUND(COALESCE(SUM(p.base_shipping_cost), 0), 2)   AS base_shipping,
            ROUND(COALESCE(SUM(p.remote_area_fee_cost), 0), 2) AS remote_area_fee,
            ROUND(COALESCE(SUM(p.cod_fee_cost), 0), 2)         AS cod_fee,
            ROUND(COALESCE(SUM(p.other_fee_cost), 0), 2)       AS other_fee,
            ROUND(COALESCE(SUM(p.insurance_fee_cost), 0), 2)   AS insurance_fee,
            ROUND(COALESCE(SUM(p.return_fee_cost), 0), 2)      AS return_fee,
            ROUND(COALESCE(SUM(
                p.base_shipping_cost + p.remote_area_fee_cost + p.cod_fee_cost
                + p.other_fee_cost + p.insurance_fee_cost + p.return_fee_cost
            ), 0), 2)                                          AS total_cost
        FROM sys_priced p
        GROUP BY p.tx_date
    ),

    -- ═══════════════════════════════════════════════════════════════════════
    all_dates AS (
        SELECT tx_date FROM statement_daily
        UNION
        SELECT tx_date FROM system_daily
    )

    SELECT
        d.tx_date                                  AS transaction_date,
        COALESCE(sys.base_shipping, 0)             AS system_base_shipping,
        COALESCE(sys.remote_area_fee, 0)           AS system_remote_area_fee,
        COALESCE(sys.cod_fee, 0)                   AS system_cod_fee,
        COALESCE(sys.other_fee, 0)                 AS system_other_fee,
        COALESCE(sys.insurance_fee, 0)             AS system_insurance_fee,
        COALESCE(sys.return_fee, 0)                AS system_return_fee,
        COALESCE(sys.total_cost, 0)                AS system_total_cost,
        COALESCE(st.shipping_cost, 0)              AS statement_shipping_cost,
        COALESCE(st.adjustment_cost, 0)            AS statement_adjustment_cost,
        COALESCE(st.remote_area_fee, 0)            AS statement_remote_area_fee,
        COALESCE(st.other_fees, 0)                 AS statement_other_fees,
        COALESCE(st.total_amount, 0)               AS statement_total_cost,
        COALESCE(st.breakdown, '{}'::jsonb)        AS charge_breakdown,
        COALESCE(st.total_amount, 0) - COALESCE(sys.total_cost, 0) AS diff
    FROM all_dates d
    LEFT JOIN statement_daily st  ON d.tx_date = st.tx_date
    LEFT JOIN system_daily    sys ON d.tx_date = sys.tx_date
    ORDER BY d.tx_date;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.jt_reconciliation_daily_summary(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_reconciliation_daily_summary(text, text) TO service_role;
