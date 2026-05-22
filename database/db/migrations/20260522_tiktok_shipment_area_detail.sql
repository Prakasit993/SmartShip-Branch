-- 20260522_tiktok_shipment_area_detail.sql
-- ราย AWB สำหรับมุมมอง "พื้นที่ปิดงานช้า" ของ tiktok-dashboard
-- (TikTok ไม่มีต้นทุน → ไม่คิด cost/weight anomaly เหมือน jt — เอาเฉพาะตรวจสอบพื้นที่/สถานะ)
--
-- closed: signer_name IS NOT NULL AND trim<>'' AND upper(trim)<>'NULL'
-- days_pending:
--   ปิดแล้ว + มี last_scan → last_scan - booking
--   ยังไม่ปิด/ไม่มี last_scan → วันนี้ - booking

DROP FUNCTION IF EXISTS public.tiktok_shipment_area_detail(date, date, text, integer, integer);

CREATE OR REPLACE FUNCTION public.tiktok_shipment_area_detail(
    start_date    date,
    end_date      date,
    filter_mode   text    DEFAULT 'all',   -- 'all' | 'not_closed' | 'closed'
    row_limit     integer DEFAULT 50,
    row_offset    integer DEFAULT 0
)
RETURNS TABLE(
    awb_number       text,
    sender_name      text,
    booking_date     text,
    latest_scan_time text,
    dest_subdistrict text,
    dest_district    text,
    dest_province    text,
    receiver_address text,
    signer_name      text,
    is_closed        boolean,
    days_pending     integer
) AS $$
BEGIN
    IF start_date IS NULL OR end_date IS NULL THEN
        RAISE EXCEPTION 'start_date and end_date are required';
    END IF;
    IF start_date > end_date THEN
        RAISE EXCEPTION 'start_date must be <= end_date';
    END IF;

    RETURN QUERY
    WITH base AS (
        SELECT
            j.awb_number                                  AS awb_number,
            j.sender_name                                 AS sender_name,
            substring(j.booking_date::text FROM 1 FOR 10) AS booking_date,
            j.latest_scan_time                            AS latest_scan_time,
            j.dest_subdistrict                            AS dest_subdistrict,
            j.dest_district                               AS dest_district,
            j.dest_province                               AS dest_province,
            j.receiver_address                            AS receiver_address,
            j.signer_name                                 AS signer_name
        FROM public.tiktok_shipments j
        WHERE substring(j.booking_date::text FROM 1 FOR 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text FROM 1 FOR 10) >= start_date::text
          AND substring(j.booking_date::text FROM 1 FOR 10) <= end_date::text
          AND j.awb_number IS NOT NULL
          AND j.awb_number <> ''
    ),
    final AS (
        SELECT
            b.awb_number,
            b.sender_name,
            b.booking_date,
            b.latest_scan_time,
            b.dest_subdistrict,
            b.dest_district,
            b.dest_province,
            b.receiver_address,
            b.signer_name,
            (b.signer_name IS NOT NULL
                AND trim(b.signer_name) <> ''
                AND upper(trim(b.signer_name)) <> 'NULL')        AS is_closed,
            CASE
                WHEN b.booking_date !~ '^\d{4}-\d{2}-\d{2}$' THEN NULL
                WHEN (b.signer_name IS NOT NULL
                      AND trim(b.signer_name) <> ''
                      AND upper(trim(b.signer_name)) <> 'NULL')
                     AND left(b.latest_scan_time, 10) ~ '^\d{4}-\d{2}-\d{2}$'
                THEN GREATEST(left(b.latest_scan_time, 10)::date - b.booking_date::date, 0)
                ELSE (CURRENT_DATE - b.booking_date::date)
            END                                                  AS days_pending
        FROM base b
    )
    SELECT
        f.awb_number,
        f.sender_name,
        f.booking_date,
        f.latest_scan_time,
        f.dest_subdistrict,
        f.dest_district,
        f.dest_province,
        f.receiver_address,
        f.signer_name,
        f.is_closed,
        f.days_pending
    FROM final f
    WHERE
        CASE filter_mode
            WHEN 'not_closed' THEN NOT f.is_closed
            WHEN 'closed'     THEN f.is_closed
            ELSE TRUE
        END
    ORDER BY
        f.days_pending DESC NULLS LAST,
        f.awb_number
    LIMIT row_limit OFFSET row_offset;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.tiktok_shipment_area_detail(date, date, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tiktok_shipment_area_detail(date, date, text, integer, integer) TO service_role;
