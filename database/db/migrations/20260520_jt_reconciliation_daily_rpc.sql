-- 20260520_jt_reconciliation_daily_rpc.sql
-- สรุปรายวัน: เปรียบเทียบต้นทุนที่ระบบประเมิน vs ยอดที่ J&T เรียกเก็บจริง (จาก jt_partner_statement)
--
-- หมายเหตุ amounts:
--   jt_partner_statement.amount เป็นค่าลบ = ต้นทุน/เดบิต
--   ฟังก์ชันนี้คืนค่าบวก (ABS) ทั้งหมดเพื่อให้อ่านง่าย
--   diff = J&T เรียกเก็บ (ค่าส่ง) - ระบบประเมิน
--         บวก = J&T เก็บเกิน (แดง), ลบ = J&T เก็บน้อยกว่า (เขียว)

CREATE OR REPLACE FUNCTION public.jt_reconciliation_daily_summary(
    p_date_from text,
    p_date_to text
)
RETURNS TABLE (
    transaction_date        text,
    system_shipping_cost    numeric,
    statement_total_cost    numeric,
    statement_shipping_cost numeric,
    statement_remote_area_fee numeric,
    statement_other_fees    numeric,
    charge_breakdown        jsonb,
    diff                    numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH
    -- ─── ยอดจาก J&T Statement จัดกลุ่มรายวัน ───────────────────────────────
    statement_by_type AS (
        -- inner grouping: รวมยอดตาม (transaction_date, charge_type) ก่อน
        SELECT
            transaction_date,
            charge_type,
            SUM(amount) AS amount_sum
        FROM public.jt_partner_statement
        WHERE
            (trim(p_date_from) = '' OR transaction_date >= trim(p_date_from)::date)
            AND (trim(p_date_to) = '' OR transaction_date < (trim(p_date_to)::date + interval '1 day'))
        GROUP BY transaction_date, charge_type
    ),
    statement_daily AS (
        SELECT
            TO_CHAR(s.transaction_date, 'YYYY-MM-DD') AS tx_date,

            -- รวมทั้งหมด (absolute)
            ABS(SUM(s.amount_sum)) AS total_amount,

            -- ต้นทุนค่าขนส่งหลัก (ไม่รวมรายการปรับปรุง)
            ABS(SUM(CASE
                WHEN s.charge_type ILIKE '%ต้นทุนค่าขนส่ง%' AND s.charge_type NOT ILIKE '%ปรับปรุง%'
                THEN s.amount_sum ELSE 0
            END)) AS shipping_cost,

            -- ค่าพื้นที่ห่างไกล
            ABS(SUM(CASE
                WHEN s.charge_type ILIKE '%ค่าพื้นที่ห่างไกล%'
                THEN s.amount_sum ELSE 0
            END)) AS remote_area_fee,

            -- อื่นๆ = ทุกอย่างที่ไม่ใช่ "ต้นทุนค่าขนส่งหลัก" และ ไม่ใช่ "ค่าพื้นที่ห่างไกล"
            -- ครอบคลุม: ปรับปรุงต้นทุนค่าขนส่ง, COD fee, System fee ฯลฯ
            ABS(SUM(CASE
                WHEN s.charge_type ILIKE '%ต้นทุนค่าขนส่ง%' AND s.charge_type NOT ILIKE '%ปรับปรุง%' THEN 0
                WHEN s.charge_type ILIKE '%ค่าพื้นที่ห่างไกล%' THEN 0
                ELSE s.amount_sum
            END)) AS other_fees,

            -- breakdown ราย charge_type (แสดงใน tooltip)
            jsonb_object_agg(
                COALESCE(s.charge_type, 'อื่นๆ'),
                ABS(s.amount_sum)
            ) AS breakdown
        FROM statement_by_type s
        GROUP BY TO_CHAR(s.transaction_date, 'YYYY-MM-DD')
    ),

    -- ─── ต้นทุนที่ระบบประเมิน (jt_shipments) จัดกลุ่มรายวัน ─────────────────
    system_daily AS (
        SELECT
            j.booking_date AS tx_date,
            ROUND(
                COALESCE(SUM(public.jt_numeric_text(j.total_shipping_fee::text)), 0),
                2
            ) AS system_expected_shipping_cost
        FROM public.jt_shipments j
        WHERE
            (trim(p_date_from) = '' OR j.booking_date >= trim(p_date_from))
            AND (trim(p_date_to) = '' OR j.booking_date <= trim(p_date_to))
        GROUP BY j.booking_date
    ),

    -- ─── รวม dates จากทั้ง 2 ฝั่ง ────────────────────────────────────────────
    all_dates AS (
        SELECT tx_date FROM statement_daily
        UNION
        SELECT tx_date FROM system_daily
    )

    SELECT
        d.tx_date                                           AS transaction_date,
        COALESCE(sys.system_expected_shipping_cost, 0)      AS system_shipping_cost,
        COALESCE(st.total_amount, 0)                        AS statement_total_cost,
        COALESCE(st.shipping_cost, 0)                       AS statement_shipping_cost,
        COALESCE(st.remote_area_fee, 0)                     AS statement_remote_area_fee,
        COALESCE(st.other_fees, 0)                          AS statement_other_fees,
        COALESCE(st.breakdown, '{}'::jsonb)                 AS charge_breakdown,
        -- diff = J&T เรียกเก็บ (ค่าส่ง) - ระบบประเมิน
        -- บวก = J&T เก็บเกิน, ลบ = J&T เก็บน้อยกว่าที่ประเมิน
        COALESCE(st.shipping_cost, 0) - COALESCE(sys.system_expected_shipping_cost, 0) AS diff
    FROM all_dates d
    LEFT JOIN statement_daily st  ON d.tx_date = st.tx_date
    LEFT JOIN system_daily    sys ON d.tx_date = sys.tx_date
    ORDER BY d.tx_date;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.jt_reconciliation_daily_summary(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_reconciliation_daily_summary(text, text) TO service_role;
