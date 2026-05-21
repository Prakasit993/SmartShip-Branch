-- public.tiktok_shipments — โครงสร้างคอลัมน์เดียวกับ jt_shipments (ดู schema.sql)
-- ใช้สำหรับ TikTok Shop โดยเฉพาะ — นำเข้าผ่าน n8n webhook (TIKTOK_N8N_UPLOAD_WEBHOOK_URL) → upsert ด้วย awb_number
-- ทุก column เป็น text เพื่อรองรับ export format ที่อาจเปลี่ยน (parse เงิน/น้ำหนักใน app layer)
--
-- Auth: service_role เท่านั้น (อ่าน/เขียนผ่าน supabaseAdmin ใน /api/admin/tiktok-shipments)
-- Upload: ส่งไฟล์ .xlsx/.csv ผ่าน /admin/tiktok-dashboard → n8n parse → upsert ที่นี่

CREATE TABLE IF NOT EXISTS public.tiktok_shipments (
    awb_number text NOT NULL PRIMARY KEY,
    booking_date text,
    sender_name text,
    sender_phone text,
    receiver_name text,
    receiver_phone text,

    shipping_fee text,
    remote_area_fee text,
    cod_amount text,
    total_shipping_fee text,
    cod_payment_method text,
    cod_status text,
    cod_payment_time text,

    prev_branch_code text,
    prev_branch_name text,
    issue_status text,
    return_type text,
    delivery_method text,
    collected_time text,

    shop_name text,
    avg_weight text,
    volumetric_weight text,
    parcel_volume text,
    total_height text,
    width text,
    length text,
    gateway_vol_weight text,
    gateway_weight text,
    gateway_height text,
    gateway_width text,
    gateway_length text,
    total_vol_weight text,

    dest_zipcode text,
    order_source text,
    sort_code_all text,
    sort_code_part4 text,
    signer_name text,
    customer_branch text,
    receiver_address text,
    dest_subdistrict text,
    dest_district text,
    dest_province text,
    dest_code text,
    receiver_home_phone text,

    return_fee text,
    insurance_fee text,
    sign_branch_code text,
    sign_branch_name text,
    signed_time text,
    delivery_staff_id text,
    delivery_staff_name text,
    dispatch_time text,

    order_weight text,
    center_weight text,
    received_weight text,
    billed_weight text,
    total_received_vol_weight text,
    received_height text,
    received_width text,
    received_length text,
    product_name text,

    issue_registered_time text,
    exception_reason text,
    return_branch_name text,
    return_branch_code text,
    discount_amount text,
    amount_before_discount text,
    gateway_received_weight text,
    gateway_sort_code text,
    is_cod_collection text,
    other_fees text,

    latest_scan_type text,
    latest_scan_branch text,
    latest_scan_time text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: service_role เท่านั้น (เหมือน jt_shipments)
ALTER TABLE public.tiktok_shipments ENABLE ROW LEVEL SECURITY;

-- เรียงล่าสุดก่อน — ใช้หลักใน /api/admin/tiktok-shipments (order by created_at desc)
CREATE INDEX IF NOT EXISTS tiktok_shipments_created_at_idx
    ON public.tiktok_shipments (created_at DESC);

-- filter ตามสถานะ / ประเภทการตีกลับ
CREATE INDEX IF NOT EXISTS tiktok_shipments_issue_status_idx
    ON public.tiktok_shipments (issue_status);

CREATE INDEX IF NOT EXISTS tiktok_shipments_cod_status_idx
    ON public.tiktok_shipments (cod_status);
