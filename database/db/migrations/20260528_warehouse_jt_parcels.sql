-- public.warehouse_jt_parcels — ข้อมูลพัสดุ J&T ที่อยู่ในคลัง / นำจ่าย (แยกตามสาขา)
-- นำเข้าผ่าน /admin/jt-warehouse → n8n webhook (JT_PARCEL_N8N_UPLOAD_WEBHOOK_URL) → upsert ด้วย awb_number
-- ทุกคอลัมน์เป็น text เพื่อรองรับ Excel serial date / "-" / "" โดยไม่ต้อง parse ใน n8n
-- (parse เวลา/น้ำหนัก/เงินใน app layer หรือ view ภายหลัง)
--
-- Auth: service_role เท่านั้น (อ่าน/เขียนผ่าน supabaseAdmin)
-- Upload: ส่งไฟล์ .xlsx/.csv ผ่าน /admin/jt-warehouse → n8n parse → upsert ที่นี่

CREATE TABLE IF NOT EXISTS public.warehouse_jt_parcels (
    awb_number text NOT NULL PRIMARY KEY,            -- เลขพัสดุ

    -- เขต / แฟรนไชส์
    region_name text,                                -- ชื่อเขต (RGM040)
    region_code text,                                -- รหัสเขต (555040)
    franchise_name text,                             -- ชื่อแฟรนไชส์ (FRN04009)
    franchise_code text,                             -- รหัสแฟรนไชส์ (504009)

    -- เวลา scan / gateway
    gateway_dispatch_time text,                      -- เวลาเกทเวย์นำส่ง (Excel serial)
    earliest_scan_time text,                         -- เวลาที่เร็วที่สุด
    latest_scan_time text,                           -- เวลาล่าสุด
    arrived_branch_time text,                        -- เวลาที่พัสดุถึงสาขา
    arrived_branch_name text,                        -- สาขาพัสดุถึง

    -- สาขานำจ่าย ★ index (แยกตามสาขา)
    delivery_branch_code text,                       -- รหัสสาขานำจ่าย (604320 / 604590 / ...)
    delivery_branch_name text,                       -- ชื่อสาขานำจ่าย
    delivered_time text,                             -- เวลาที่นำจ่ายพัสดุ ("-" ถ้ายังไม่ส่ง)
    delivery_staff_id text,                          -- รหัสพนักงานนำจ่าย
    delivery_staff_name text,                        -- ชื่อของพนักงานนำจ่าย
    delivery_staff_position text,                    -- ตำแหน่งพนักงานนำจ่ายพัสดุ
    delivery_staff_phone text,                       -- เบอร์มือถือพนักงานนำจ่ายพัสดุ
    is_assist_delivery text,                         -- ช่วยนำจ่ายหรือไม่ (Y/N)

    -- ตกค้าง
    stuck_time text,                                 -- เวลาที่พัสดุตกค้าง
    stuck_reason text,                               -- สาเหตุพัสดุตกค้าง
    stuck_scan_branch text,                          -- สาขาที่สแกนพัสดุตกค้าง
    stuck_flag text,                                 -- สัญลักษณ์ตกค้าง (Y/N)

    -- มีปัญหา
    problem_time text,                               -- เวลาพัสดุมีปัญหา
    problem_reason text,                             -- สาเหตุของพัสดุมีปัญหา
    problem_scan_branch text,                        -- สาขาที่สแกนพัสดุมีปัญหา

    -- เข้าคลัง
    warehouse_in_time text,                          -- เวลาที่สินค้าเข้าคลัง
    warehouse_in_branch text,                        -- สาขาที่สแกนรับเข้าคลัง
    shop_name text,                                  -- ชื่อร้าน

    -- เซ็นรับ
    signed_time text,                                -- เวลาเซ็นรับ
    sign_branch_name text,                           -- สาขาเซ็นรับ
    signed_record_time text,                         -- เวลาการบันทึกเซ็นรับพัสดุ
    signed_by_staff text,                            -- (พนักงานนำจ่ายพัสดุ)เซ็นรับพัสดุ
    signer_name text,                                -- ผู้เซ็นรับ
    sign_time_status text,                           -- สถานะเวลาเซ็นรับ
    sign_branch_status text,                         -- สถานะสาขาเซ็นรับ
    signed_flag text,                                -- สัญลักษณ์เซ็นรับ (Y/N)

    -- ตีกลับ
    return_register_time text,                       -- เวลาลงทะเบียนพัสดุตีกลับ
    return_register_branch text,                     -- สาขาลงทะเบียนตีกลับ
    return_signed_time text,                         -- เวลาเซ็นรับพัสดุตีกลับ
    return_sign_branch text,                         -- เซ็นรับพัสดุตีกลับ (สาขา)
    return_signer text,                              -- ผู้เซ็นรับพัสดุตีกลับ
    return_flag text,                                -- สัญลักษณ์ตีกลับ (正向 / ...)

    -- ปิดงาน
    closed_branch text,                              -- สาขาที่ปิดงาน
    closed_time text,                                -- เวลาที่ปิดงาน

    -- ประเภท / เงิน / น้ำหนัก
    branch_type text,                                -- ประเภทสาขา (加盟)
    order_source text,                               -- แหล่งที่มาคำสั่งซื้อ (TIKTOK)
    parcel_type text,                                -- ประเภทพัสดุ (EZ)
    product_type text,                               -- ประเภทสินค้า
    service_type text,                               -- ประเภทค่าบริการเสริม (normal / SUPER)
    billed_weight text,                              -- น้ำหนักที่ใช้คิดเงิน
    payment_method text,                             -- วิธีการชำระเงิน (PP_PM)
    total_shipping_fee text,                         -- ค่าขนส่งทั้งหมด
    cod_amount text,                                 -- COD

    -- ผู้ส่ง / รับ
    sender_name text,                                -- ผู้ส่ง
    sender_customer text,                            -- ลูกค้าผู้ส่ง
    sender_phone text,                               -- เบอร์โทรผู้ส่ง
    receiver_name text,                              -- ผู้รับ
    receiver_phone text,                             -- เบอร์มือถือผู้รับ
    receiver_address text,                           -- ที่อยู่ผู้รับ

    leftover_flag text,                              -- 遗留件标识 (ภาษาจีน — เก็บตามต้นทาง)

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: service_role เท่านั้น (เหมือน jt_shipments / tiktok_shipments)
ALTER TABLE public.warehouse_jt_parcels ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS warehouse_jt_parcels_branch_idx
    ON public.warehouse_jt_parcels (delivery_branch_code);

CREATE INDEX IF NOT EXISTS warehouse_jt_parcels_created_at_idx
    ON public.warehouse_jt_parcels (created_at DESC);

CREATE INDEX IF NOT EXISTS warehouse_jt_parcels_branch_signed_idx
    ON public.warehouse_jt_parcels (delivery_branch_code, signed_flag);

-- Auto-update updated_at on UPSERT
CREATE OR REPLACE FUNCTION public.warehouse_jt_parcels_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS warehouse_jt_parcels_updated_at ON public.warehouse_jt_parcels;
CREATE TRIGGER warehouse_jt_parcels_updated_at
    BEFORE UPDATE ON public.warehouse_jt_parcels
    FOR EACH ROW EXECUTE FUNCTION public.warehouse_jt_parcels_set_updated_at();
