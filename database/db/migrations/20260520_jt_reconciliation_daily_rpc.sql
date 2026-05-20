-- 20260520_jt_reconciliation_daily_rpc.sql
-- นำเข้ารายวัน: สร้าง RPC สำหรับกระทบยอดรวมเป็นรายวัน (ตาม transaction_date)
-- และนำไปเทียบกับ expected shipping cost รวมในแต่ละวันจาก jt_shipments

CREATE OR REPLACE FUNCTION public.jt_reconciliation_daily_summary(
    p_date_from text,
    p_date_to text
)
RETURNS TABLE (
    transaction_date text,
    system_shipping_cost numeric,
    statement_total_cost numeric,
    statement_shipping_cost numeric,
    statement_remote_area_fee numeric,
    statement_other_fees numeric,
    charge_breakdown jsonb,
    diff numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH statement_daily AS (
        SELECT 
            TO_CHAR(s.transaction_date, 'YYYY-MM-DD') AS tx_date,
            SUM(s.amount) AS total_amount,
            SUM(CASE WHEN s.charge_type ILIKE '%ต้นทุนค่าขนส่ง%' AND s.charge_type NOT ILIKE '%ปรับปรุง%' THEN s.amount ELSE 0 END) AS shipping_cost,
            SUM(CASE WHEN s.charge_type ILIKE '%ค่าพื้นที่ห่างไกล%' THEN s.amount ELSE 0 END) AS remote_area_fee,
            SUM(CASE WHEN s.charge_type NOT ILIKE '%ต้นทุนค่าขนส่ง%' AND s.charge_type NOT ILIKE '%ค่าพื้นที่ห่างไกล%' THEN s.amount ELSE 0 END) AS other_fees,
            jsonb_object_agg(
                COALESCE(s.charge_type, 'อื่นๆ'), 
                s.amount_sum
            ) as breakdown
        FROM (
            SELECT 
                transaction_date, 
                charge_type, 
                SUM(amount) as amount_sum,
                SUM(amount) as amount
            FROM public.jt_partner_statement 
            WHERE 
                (trim(p_date_from) = '' OR transaction_date >= trim(p_date_from)::date)
                AND (trim(p_date_to) = '' OR transaction_date < (trim(p_date_to)::date + interval '1 day'))
            GROUP BY transaction_date, charge_type
        ) s
        GROUP BY TO_CHAR(s.transaction_date, 'YYYY-MM-DD')
    ),
    system_daily AS (
        SELECT
            j.booking_date AS tx_date,
            ROUND(COALESCE(SUM(jt_text_to_numeric(j.total_shipping_fee::text)), 0), 2) AS system_expected_shipping_cost
        FROM public.jt_shipments j
        WHERE 
            (trim(p_date_from) = '' OR j.booking_date >= trim(p_date_from))
            AND (trim(p_date_to) = '' OR j.booking_date <= trim(p_date_to))
        GROUP BY j.booking_date
    ),
    all_dates AS (
        SELECT tx_date FROM statement_daily
        UNION
        SELECT tx_date FROM system_daily
    )
    SELECT
        d.tx_date AS transaction_date,
        COALESCE(sys.system_expected_shipping_cost, 0) AS system_shipping_cost,
        COALESCE(st.total_amount, 0) AS statement_total_cost,
        COALESCE(st.shipping_cost, 0) AS statement_shipping_cost,
        COALESCE(st.remote_area_fee, 0) AS statement_remote_area_fee,
        COALESCE(st.other_fees, 0) AS statement_other_fees,
        COALESCE(st.breakdown, '{}'::jsonb) AS charge_breakdown,
        -- Diff = ค่าใช้จ่ายประเมินระบบ (บวก) - ค่าใช้จ่ายจริง J&T (ถอดลบออก)
        COALESCE(sys.system_expected_shipping_cost, 0) - ABS(COALESCE(st.shipping_cost, 0)) AS diff
    FROM all_dates d
    LEFT JOIN statement_daily st ON d.tx_date = st.tx_date
    LEFT JOIN system_daily sys ON d.tx_date = sys.tx_date
    ORDER BY d.tx_date;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.jt_reconciliation_daily_summary(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_reconciliation_daily_summary(text, text) TO service_role;
