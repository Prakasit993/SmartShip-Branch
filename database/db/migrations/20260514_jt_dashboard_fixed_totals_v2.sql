-- Extend jt_dashboard_fixed_totals with two new columns:
--   closed_count           — พัสดุที่ปิดงานแล้ว: signer_name IS NOT NULL และไม่ใช่สตริงว่าง/'NULL'
--   sum_total_shipping_fee — รวมค่าส่งสุทธิ: ขจัด TS pagination loop ที่ hardcode needAggregationLoop=true
--
-- Business logic (ตรงกับ dashboard/route.ts):
--   พัสดุต่อวัน   = COUNT(*) ใน date range (booking_date)
--   ปิดงานแล้ว    = signer_name IS NOT NULL AND trim(signer_name) NOT IN ('', 'NULL')
--   การ์ดแสดง     = closed_count / total_count
--
-- หมายเหตุ: ต้อง DROP ก่อน CREATE เพราะ return type เปลี่ยน (เพิ่มคอลัมน์)

DROP FUNCTION IF EXISTS public.jt_dashboard_fixed_totals(text, text);

CREATE OR REPLACE FUNCTION public.jt_dashboard_fixed_totals(
    p_date_from text DEFAULT '',
    p_date_to   text DEFAULT ''
)
RETURNS TABLE (
    total_count             bigint,
    closed_count            bigint,   -- NEW: พัสดุปิดงานแล้ว (signer_name ไม่ว่าง)
    sum_cod                 numeric,
    sum_fee_positive        numeric,
    count_fee_positive      bigint,
    return_count            bigint,
    sum_total_fee_jms       numeric,
    sum_total_shipping_fee  numeric,  -- NEW: รวมค่าส่งสุทธิ (ขจัด TS pagination loop)
    cod_paid_count          bigint,
    cod_paid_amount         numeric,
    cod_pending_count       bigint,
    cod_pending_amount      numeric,
    cod_no_collection_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH filtered AS (
        SELECT
            s.signer_name,
            s.return_type,
            s.order_source,
            s.platform,
            s.cod_status,
            s.is_cod_collection,
            jt_text_to_numeric(s.cod_amount::text)            AS cod_num,
            jt_text_to_numeric(s.shipping_fee::text)          AS fee_num,
            jt_text_to_numeric(s.total_shipping_fee::text)    AS total_fee_num
        FROM public.jt_shipments s
        WHERE
            -- date_from: ว่าง = ไม่กรอง; มีค่า = booking_date >= p_date_from
            (trim(p_date_from) = '' OR s.booking_date >= trim(p_date_from))
            -- date_to: ว่าง = ไม่กรอง; มีค่า = booking_date < วันถัดไป (inclusive end)
        AND (trim(p_date_to)   = '' OR s.booking_date <  to_char(trim(p_date_to)::date + 1, 'YYYY-MM-DD'))
    )
    SELECT
        -- 1. จำนวนพัสดุทั้งหมดในช่วง (พัสดุต่อวันคีย์กี่ชิ้น)
        COUNT(*)::bigint AS total_count,

        -- 2. ปิดงานแล้ว: signer_name ไม่ใช่ null / สตริงว่าง / 'NULL'
        COUNT(*) FILTER (
            WHERE signer_name IS NOT NULL
              AND trim(signer_name) <> ''
              AND trim(signer_name) <> 'NULL'
        )::bigint AS closed_count,

        -- COD รวม
        ROUND(COALESCE(SUM(cod_num), 0), 2) AS sum_cod,

        -- ค่าส่ง (เฉพาะค่าบวก สำหรับคำนวณค่าเฉลี่ย)
        ROUND(COALESCE(SUM(fee_num) FILTER (WHERE fee_num > 0), 0), 2) AS sum_fee_positive,
        COUNT(*) FILTER (WHERE fee_num > 0)::bigint AS count_fee_positive,

        -- พัสดุตีกลับ (return_type มีค่า ไม่ใช่ EMPTY/NULL/-)
        COUNT(*) FILTER (
            WHERE return_type IS NOT NULL
              AND trim(return_type) <> ''
              AND upper(trim(return_type)) NOT IN ('EMPTY', 'NULL', '-')
        )::bigint AS return_count,

        -- ค่าส่งช่องทาง JMS
        ROUND(COALESCE(SUM(total_fee_num) FILTER (
            WHERE jt_shipping_fee_bucket(jt_channel_label(platform, order_source)) = 'jms'
        ), 0), 2) AS sum_total_fee_jms,

        -- ค่าส่งสุทธิรวมทั้งหมด (ขจัด TS pagination loop)
        ROUND(COALESCE(SUM(total_fee_num), 0), 2) AS sum_total_shipping_fee,

        -- COD ชำระแล้ว
        COUNT(*) FILTER (
            WHERE trim(lower(COALESCE(cod_status, ''))) LIKE 'ชำระ%'
               OR trim(lower(COALESCE(cod_status, ''))) IN ('paid', 'cod paid')
        )::bigint AS cod_paid_count,

        ROUND(COALESCE(SUM(cod_num) FILTER (
            WHERE trim(lower(COALESCE(cod_status, ''))) LIKE 'ชำระ%'
               OR trim(lower(COALESCE(cod_status, ''))) IN ('paid', 'cod paid')
        ), 0), 2) AS cod_paid_amount,

        -- COD ค้างชำระ: มี cod_amount > 0 และยังไม่ได้ชำระ
        COUNT(*) FILTER (
            WHERE cod_num > 0
              AND NOT (
                  trim(lower(COALESCE(cod_status, ''))) LIKE 'ชำระ%'
               OR trim(lower(COALESCE(cod_status, ''))) IN ('paid', 'cod paid')
              )
        )::bigint AS cod_pending_count,

        ROUND(COALESCE(SUM(cod_num) FILTER (
            WHERE cod_num > 0
              AND NOT (
                  trim(lower(COALESCE(cod_status, ''))) LIKE 'ชำระ%'
               OR trim(lower(COALESCE(cod_status, ''))) IN ('paid', 'cod paid')
              )
        ), 0), 2) AS cod_pending_amount,

        -- ไม่เก็บ COD: cod_amount = 0 หรือ is_cod_collection เป็น false/0
        COUNT(*) FILTER (
            WHERE cod_num = 0
               OR trim(lower(COALESCE(is_cod_collection, ''))) IN ('0', 'false', 'ไม่', 'no')
        )::bigint AS cod_no_collection_count

    FROM filtered;
$$;

REVOKE ALL ON FUNCTION public.jt_dashboard_fixed_totals(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_dashboard_fixed_totals(text, text) TO service_role;
