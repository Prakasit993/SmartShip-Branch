-- 20260522_jt_cost_area_detail_sender_adjusted.sql
-- เพิ่มคอลัมน์ใน jt_shipment_cost_area_detail:
--   sender_name   — ชื่อผู้ส่ง (แสดงในตารางต้นทุน)
--   adjusted_cost — "ต้นทุนที่ปรับปรุงแล้ว" = zone rate × admin_billable
--                   (ต้นทุน "ที่ควรจะเป็น" ตามน้ำหนักที่ admin คีย์ — เทียบกับ our_cost
--                    ที่จ่ายจริงตาม billable/gateway weight → ส่วนต่าง = ที่โดนเรียกเกิน)
--
-- ต้อง DROP ก่อนเพราะ RETURNS TABLE เปลี่ยน (เพิ่ม 2 คอลัมน์).

DROP FUNCTION IF EXISTS public.jt_shipment_cost_area_detail(date, date, text, integer, integer);

CREATE OR REPLACE FUNCTION public.jt_shipment_cost_area_detail(
    start_date    date,
    end_date      date,
    filter_mode   text    DEFAULT 'all',   -- 'all' | 'anomaly' | 'not_closed' | 'closed'
    row_limit     integer DEFAULT 50,
    row_offset    integer DEFAULT 0
)
RETURNS TABLE(
    awb_number         text,
    sender_name        text,
    booking_date       text,
    latest_scan_time   text,
    dest_subdistrict   text,
    dest_district      text,
    dest_province      text,
    receiver_address   text,
    billable_weight_kg numeric,
    admin_billable     numeric,
    gateway_billable   numeric,
    anomaly_ratio      numeric,
    anomaly_diff_kg    numeric,
    is_anomaly         boolean,
    our_cost           numeric,
    adjusted_cost      numeric,
    signer_name        text,
    is_closed          boolean,
    days_pending       integer
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
            j.awb_number                                    AS awb_number,
            j.sender_name                                   AS sender_name,
            substring(j.booking_date::text FROM 1 FOR 10)   AS booking_date,
            j.latest_scan_time                              AS latest_scan_time,
            j.dest_subdistrict                              AS dest_subdistrict,
            j.dest_district                                 AS dest_district,
            j.dest_province                                 AS dest_province,
            j.receiver_address                              AS receiver_address,
            j.signer_name                                   AS signer_name,
            public.jt_clean_province(j.dest_province::text) AS normalized_dest_province,

            -- admin billable (จากที่ admin คีย์)
            GREATEST(
                COALESCE(public.jt_numeric_text(j.order_weight::text), 0),
                COALESCE(
                    public.jt_numeric_text(j.width::text)
                    * public.jt_numeric_text(j.length::text)
                    * public.jt_numeric_text(j.total_height::text)
                    / 6000.0, 0
                )
            ) AS admin_billable,

            -- gateway billable (จากเครื่องคัดแยก J&T)
            GREATEST(
                COALESCE(public.jt_numeric_text(j.gateway_weight::text), 0),
                COALESCE(
                    public.jt_numeric_text(j.gateway_width::text)
                    * public.jt_numeric_text(j.gateway_length::text)
                    * public.jt_numeric_text(j.gateway_height::text)
                    / 6000.0, 0
                )
            ) AS gateway_billable,

            -- billable weight สำหรับคำนวณต้นทุน (COALESCE เหมือน reconciliation)
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
            COALESCE(public.jt_numeric_text(j.gateway_length::text), public.jt_numeric_text(j.received_length::text), public.jt_numeric_text(j.length::text)) AS length_cm,
            COALESCE(public.jt_numeric_text(j.gateway_width::text),  public.jt_numeric_text(j.received_width::text),  public.jt_numeric_text(j.width::text))  AS width_cm,
            COALESCE(public.jt_numeric_text(j.gateway_height::text), public.jt_numeric_text(j.received_height::text), public.jt_numeric_text(j.total_height::text)) AS height_cm,
            public.jt_numeric_text(j.shipping_fee::text) AS shipping_fee_numeric
        FROM public.jt_shipments j
        WHERE substring(j.booking_date::text FROM 1 FOR 10) ~ '^\d{4}-\d{2}-\d{2}$'
          AND substring(j.booking_date::text FROM 1 FOR 10) >= start_date::text
          AND substring(j.booking_date::text FROM 1 FOR 10) <= end_date::text
          AND j.awb_number IS NOT NULL
          AND j.awb_number <> ''
    ),
    with_zone AS (
        SELECT
            b.*,
            z.zone_code,
            NULLIF(GREATEST(
                COALESCE(b.actual_weight_kg, 0),
                COALESCE(public.jt_normalized_volumetric_weight_kg(
                    b.imported_vol_weight, b.length_cm, b.width_cm, b.height_cm
                ), 0)
            ), 0) AS billable_weight_kg
        FROM base b
        LEFT JOIN public.jt_shipping_zone_provinces z
          ON z.normalized_province_name = b.normalized_dest_province
         AND z.is_active IS TRUE
    ),
    priced AS (
        SELECT
            s.*,
            COALESCE(weight_rate.cost, fallback_cost.cost_numeric, 15) AS our_cost,
            -- ✏ ต้นทุนที่ปรับปรุงแล้ว = zone rate ตาม admin_billable (น้ำหนักที่เราคีย์ = ที่ควรจะเป็น)
            COALESCE(admin_rate.cost, fallback_cost.cost_numeric, 15)  AS adjusted_cost
        FROM with_zone s
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
            SELECT r.cost
            FROM public.jt_shipping_cost_rates r
            WHERE r.carrier = 'J&T'
              AND r.zone_code = s.zone_code
              AND r.is_active IS TRUE
              AND NULLIF(s.admin_billable, 0) IS NOT NULL
              AND r.max_billable_weight_kg >= s.admin_billable
            ORDER BY r.max_billable_weight_kg ASC, r.id ASC
            LIMIT 1
        ) admin_rate ON TRUE
        LEFT JOIN LATERAL (
            SELECT public.jt_numeric_text(c.cost::text) AS cost_numeric
            FROM public.shipping_cost_master c
            WHERE c.is_active IS TRUE
              AND public.jt_numeric_text(c.sale_price::text) = s.shipping_fee_numeric
              AND public.jt_numeric_text(c.cost::text) IS NOT NULL
            LIMIT 1
        ) fallback_cost ON TRUE
    ),
    final AS (
        SELECT
            p.awb_number,
            p.sender_name,
            p.booking_date,
            p.latest_scan_time,
            p.dest_subdistrict,
            p.dest_district,
            p.dest_province,
            p.receiver_address,
            ROUND(p.billable_weight_kg, 2)                       AS billable_weight_kg,
            ROUND(p.admin_billable, 2)                           AS admin_billable,
            ROUND(p.gateway_billable, 2)                         AS gateway_billable,
            CASE WHEN p.admin_billable > 0
                 THEN ROUND(p.gateway_billable / p.admin_billable, 2)
                 ELSE NULL END                                   AS anomaly_ratio,
            ROUND(p.gateway_billable - p.admin_billable, 2)      AS anomaly_diff_kg,
            (p.admin_billable > 0
                AND p.gateway_billable > p.admin_billable * 2.5
                AND (p.gateway_billable - p.admin_billable) > 1.0) AS is_anomaly,
            ROUND(p.our_cost, 2)                                 AS our_cost,
            ROUND(p.adjusted_cost, 2)                            AS adjusted_cost,
            p.signer_name,
            (p.signer_name IS NOT NULL
                AND trim(p.signer_name) <> ''
                AND upper(trim(p.signer_name)) <> 'NULL')        AS is_closed,
            CASE
                WHEN p.booking_date !~ '^\d{4}-\d{2}-\d{2}$' THEN NULL
                WHEN (p.signer_name IS NOT NULL
                      AND trim(p.signer_name) <> ''
                      AND upper(trim(p.signer_name)) <> 'NULL')
                     AND left(p.latest_scan_time, 10) ~ '^\d{4}-\d{2}-\d{2}$'
                THEN GREATEST(left(p.latest_scan_time, 10)::date - p.booking_date::date, 0)
                ELSE (CURRENT_DATE - p.booking_date::date)
            END                                                  AS days_pending
        FROM priced p
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
        f.billable_weight_kg,
        f.admin_billable,
        f.gateway_billable,
        f.anomaly_ratio,
        f.anomaly_diff_kg,
        f.is_anomaly,
        f.our_cost,
        f.adjusted_cost,
        f.signer_name,
        f.is_closed,
        f.days_pending
    FROM final f
    WHERE
        CASE filter_mode
            WHEN 'anomaly'    THEN f.is_anomaly
            WHEN 'not_closed' THEN NOT f.is_closed
            WHEN 'closed'     THEN f.is_closed
            ELSE TRUE
        END
    ORDER BY
        (CASE WHEN filter_mode = 'anomaly'              THEN f.anomaly_ratio END) DESC NULLS LAST,
        (CASE WHEN filter_mode IN ('all', 'not_closed') THEN f.days_pending  END) DESC NULLS LAST,
        f.our_cost DESC,
        f.awb_number
    LIMIT row_limit OFFSET row_offset;
END;
$$ LANGUAGE plpgsql STABLE;

REVOKE ALL ON FUNCTION public.jt_shipment_cost_area_detail(date, date, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jt_shipment_cost_area_detail(date, date, text, integer, integer) TO service_role;
