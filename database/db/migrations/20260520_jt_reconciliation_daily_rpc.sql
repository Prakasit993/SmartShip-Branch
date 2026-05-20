-- 20260520_jt_reconciliation_daily_rpc.sql
-- สรุปรายวัน: เปรียบเทียบต้นทุนที่ระบบประเมิน vs ยอดที่ J&T เรียกเก็บจริง (จาก jt_partner_statement)
--
-- "ระบบประเมิน" ใช้ logic เดียวกับ get_financial_component_summary_billable_weight
--   = billable_weight × zone_rate (จาก jt_shipping_cost_rates)
--   ตัวเลขจึงสอดคล้องกับแท็บ "วิเคราะห์กำไร" ทุกประการ
--
-- amounts ใน jt_partner_statement เป็นค่าลบ (debit) — ฟังก์ชันนี้คืน ABS ทั้งหมด
-- diff = J&T เรียกเก็บ (ค่าส่ง) - ระบบประเมิน
--        บวก = J&T เก็บเกิน (แดง), ลบ = J&T เก็บน้อยกว่า (เขียว)

CREATE OR REPLACE FUNCTION public.jt_reconciliation_daily_summary(
    p_date_from text,
    p_date_to text
)
RETURNS TABLE (
    transaction_date           text,
    system_shipping_cost       numeric,
    statement_total_cost       numeric,
    statement_shipping_cost    numeric,
    statement_adjustment_cost  numeric,
    statement_remote_area_fee  numeric,
    statement_other_fees       numeric,
    charge_breakdown           jsonb,
    diff                       numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH

    -- ─────────────────────────────────────────────────────────────────────
    -- ฝั่ง J&T Statement (jt_partner_statement)
    -- ─────────────────────────────────────────────────────────────────────
    statement_by_type AS (
        SELECT
            ps.transaction_date,
            ps.charge_type,
            SUM(ps.amount) AS amount_sum
        FROM public.jt_partner_statement ps
        WHERE
            (trim(p_date_from) = '' OR ps.transaction_date >= trim(p_date_from)::date)
            AND (trim(p_date_to) = '' OR ps.transaction_date < (trim(p_date_to)::date + interval '1 day'))
        GROUP BY ps.transaction_date, ps.charge_type
    ),
    statement_daily AS (
        SELECT
            TO_CHAR(s.transaction_date, 'YYYY-MM-DD') AS tx_date,
            ABS(SUM(s.amount_sum)) AS total_amount,
            -- ต้นทุนค่าขนส่งหลัก (ไม่รวมปรับปรุง)
            ABS(SUM(CASE
                WHEN s.charge_type ILIKE '%ต้นทุนค่าขนส่ง%' AND s.charge_type NOT ILIKE '%ปรับปรุง%'
                THEN s.amount_sum ELSE 0
            END)) AS shipping_cost,
            -- ปรับปรุงต้นทุนค่าขนส่ง (แยกออกมาเพื่อดูว่าถูกปรับเท่าไหร่)
            ABS(SUM(CASE
                WHEN s.charge_type ILIKE '%ปรับปรุง%' AND s.charge_type ILIKE '%ต้นทุนค่าขนส่ง%'
                THEN s.amount_sum ELSE 0
            END)) AS adjustment_cost,
            -- ค่าพื้นที่ห่างไกล
            ABS(SUM(CASE
                WHEN s.charge_type ILIKE '%ค่าพื้นที่ห่างไกล%'
                THEN s.amount_sum ELSE 0
            END)) AS remote_area_fee,
            -- อื่นๆ ที่เหลือ (COD fee, System fee ฯลฯ)
            ABS(SUM(CASE
                WHEN s.charge_type ILIKE '%ต้นทุนค่าขนส่ง%' THEN 0
                WHEN s.charge_type ILIKE '%ค่าพื้นที่ห่างไกล%' THEN 0
                ELSE s.amount_sum
            END)) AS other_fees,
            jsonb_object_agg(
                COALESCE(s.charge_type, 'อื่นๆ'),
                ABS(s.amount_sum)
            ) AS breakdown
        FROM statement_by_type s
        GROUP BY TO_CHAR(s.transaction_date, 'YYYY-MM-DD')
    ),

    -- ─────────────────────────────────────────────────────────────────────
    -- ฝั่งระบบ (jt_shipments) — ใช้ logic เดียวกับ Financial tab
    -- ─────────────────────────────────────────────────────────────────────
    sys_normalized AS (
        SELECT
            LEFT(j.booking_date::text, 10)                                       AS tx_date,
            public.jt_numeric_text(j.shipping_fee::text)                          AS shipping_fee_numeric,
            public.jt_clean_province(j.dest_province::text)                       AS normalized_dest_province,
            COALESCE(
                public.jt_numeric_text(j.billed_weight::text),
                public.jt_numeric_text(j.gateway_weight::text),
                public.jt_numeric_text(j.gateway_received_weight::text),
                public.jt_numeric_text(j.received_weight::text),
                public.jt_numeric_text(j.center_weight::text),
                public.jt_numeric_text(j.order_weight::text),
                public.jt_numeric_text(j.avg_weight::text)
            )                                                                      AS actual_weight_kg,
            COALESCE(
                public.jt_numeric_text(j.gateway_vol_weight::text),
                public.jt_numeric_text(j.total_received_vol_weight::text),
                public.jt_numeric_text(j.total_vol_weight::text),
                public.jt_numeric_text(j.volumetric_weight::text)
            )                                                                      AS imported_vol_weight,
            COALESCE(public.jt_numeric_text(j.gateway_length::text), public.jt_numeric_text(j.received_length::text), public.jt_numeric_text(j.length::text))    AS length_cm,
            COALESCE(public.jt_numeric_text(j.gateway_width::text),  public.jt_numeric_text(j.received_width::text),  public.jt_numeric_text(j.width::text))     AS width_cm,
            COALESCE(public.jt_numeric_text(j.gateway_height::text), public.jt_numeric_text(j.received_height::text), public.jt_numeric_text(j.total_height::text)) AS height_cm
        FROM public.jt_shipments j
        WHERE j.booking_date IS NOT NULL
          AND LEFT(j.booking_date::text, 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND (trim(p_date_from) = '' OR LEFT(j.booking_date::text, 10) >= trim(p_date_from))
          AND (trim(p_date_to) = '' OR LEFT(j.booking_date::text, 10) <= trim(p_date_to))
    ),
    sys_with_zone AS (
        SELECT
            n.tx_date,
            n.shipping_fee_numeric,
            z.zone_code,
            NULLIF(
                GREATEST(
                    COALESCE(n.actual_weight_kg, 0),
                    COALESCE(public.jt_normalized_volumetric_weight_kg(
                        n.imported_vol_weight, n.length_cm, n.width_cm, n.height_cm
                    ), 0)
                ), 0
            ) AS billable_weight_kg
        FROM sys_normalized n
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = n.normalized_dest_province
         AND z.is_active IS TRUE
    ),
    sys_with_cost AS (
        SELECT
            s.tx_date,
            COALESCE(weight_rate.cost, fallback_cost.cost_numeric, 15) AS base_shipping_cost
        FROM sys_with_zone s
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
    system_daily AS (
        SELECT
            tx_date,
            ROUND(COALESCE(SUM(base_shipping_cost), 0), 2) AS system_expected_shipping_cost
        FROM sys_with_cost
        GROUP BY tx_date
    ),

    -- ─────────────────────────────────────────────────────────────────────
    -- รวม dates จากทั้ง 2 ฝั่ง
    -- ─────────────────────────────────────────────────────────────────────
    all_dates AS (
        SELECT tx_date FROM statement_daily
        UNION
        SELECT tx_date FROM system_daily
    )

    SELECT
        d.tx_date                                            AS transaction_date,
        COALESCE(sys.system_expected_shipping_cost, 0)       AS system_shipping_cost,
        COALESCE(st.total_amount, 0)                         AS statement_total_cost,
        COALESCE(st.shipping_cost, 0)                        AS statement_shipping_cost,
        COALESCE(st.adjustment_cost, 0)                      AS statement_adjustment_cost,
        COALESCE(st.remote_area_fee, 0)                      AS statement_remote_area_fee,
        COALESCE(st.other_fees, 0)                           AS statement_other_fees,
        COALESCE(st.breakdown, '{}'::jsonb)                  AS charge_breakdown,
        -- diff = J&T ค่าส่ง - ระบบประเมิน (บวก = J&T เก็บเกิน)
        COALESCE(st.shipping_cost, 0) - COALESCE(sys.system_expected_shipping_cost, 0) AS diff
    FROM all_dates d
    LEFT JOIN statement_daily st  ON d.tx_date = st.tx_date
    LEFT JOIN system_daily    sys ON d.tx_date = sys.tx_date
    ORDER BY d.tx_date;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.jt_reconciliation_daily_summary(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_reconciliation_daily_summary(text, text) TO service_role;
