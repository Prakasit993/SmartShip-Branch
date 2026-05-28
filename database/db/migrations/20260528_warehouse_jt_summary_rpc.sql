-- public.warehouse_jt_parcels — เพิ่ม index + RPC สำหรับสรุปแยกตามสาขา/พนักงาน
-- ใช้ในหน้า /admin/jt-warehouse แสดง tab สาขา → ตารางพนักงาน + จำนวนพัสดุ
--
-- ออกแบบสำหรับการอัปเดตเป็นชุด (Playwright + n8n ทุก 30-60 นาที)
-- ตาราง warehouse_jt_parcels สะสมข้อมูลต่อเนื่อง (ไม่ truncate)

-- 1. Composite index — เร่ง aggregate per branch + staff
CREATE INDEX IF NOT EXISTS warehouse_jt_parcels_branch_staff_idx
    ON public.warehouse_jt_parcels (delivery_branch_code, delivery_staff_id);

-- 2. View: เวลา upload ล่าสุด (ใช้แสดง "อัปเดตล่าสุด X นาทีที่แล้ว")
CREATE OR REPLACE VIEW public.warehouse_jt_last_upload AS
    SELECT
        MAX(updated_at) AS last_uploaded_at,
        COUNT(*) AS total_parcels,
        COUNT(DISTINCT delivery_branch_code) AS branch_count,
        COUNT(DISTINCT delivery_staff_id) FILTER (
            WHERE delivery_staff_id IS NOT NULL AND delivery_staff_id <> ''
        ) AS staff_count
    FROM public.warehouse_jt_parcels;

GRANT SELECT ON public.warehouse_jt_last_upload TO service_role;

-- 3. RPC: สรุปสาขา → พนักงาน → จำนวน/สำเร็จ/ค้าง
CREATE OR REPLACE FUNCTION public.get_warehouse_jt_branch_staff_summary()
RETURNS TABLE (
    delivery_branch_code text,
    delivery_branch_name text,
    delivery_staff_id text,
    delivery_staff_name text,
    delivery_staff_position text,
    delivery_staff_phone text,
    parcel_count bigint,
    delivered_count bigint,
    pending_count bigint,
    stuck_count bigint,
    cod_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        delivery_branch_code,
        MAX(delivery_branch_name)        AS delivery_branch_name,
        delivery_staff_id,
        MAX(delivery_staff_name)         AS delivery_staff_name,
        MAX(delivery_staff_position)     AS delivery_staff_position,
        MAX(delivery_staff_phone)        AS delivery_staff_phone,
        COUNT(*)                                                    AS parcel_count,
        COUNT(*) FILTER (WHERE signed_flag = 'Y')                   AS delivered_count,
        COUNT(*) FILTER (WHERE signed_flag IS NULL OR signed_flag IN ('', 'N')) AS pending_count,
        COUNT(*) FILTER (WHERE stuck_flag = 'Y')                    AS stuck_count,
        COALESCE(SUM(NULLIF(cod_amount, '')::numeric), 0)           AS cod_total
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code IS NOT NULL
      AND delivery_branch_code <> ''
    GROUP BY delivery_branch_code, delivery_staff_id
    ORDER BY delivery_branch_code, parcel_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_branch_staff_summary() TO service_role;

-- 4. RPC: สรุปยอดรวมต่อสาขา (สำหรับ tab/card header)
CREATE OR REPLACE FUNCTION public.get_warehouse_jt_branch_summary()
RETURNS TABLE (
    delivery_branch_code text,
    delivery_branch_name text,
    parcel_count bigint,
    staff_count bigint,
    delivered_count bigint,
    pending_count bigint,
    stuck_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        delivery_branch_code,
        MAX(delivery_branch_name)        AS delivery_branch_name,
        COUNT(*)                         AS parcel_count,
        COUNT(DISTINCT delivery_staff_id) FILTER (
            WHERE delivery_staff_id IS NOT NULL AND delivery_staff_id <> ''
        )                                AS staff_count,
        COUNT(*) FILTER (WHERE signed_flag = 'Y')                              AS delivered_count,
        COUNT(*) FILTER (WHERE signed_flag IS NULL OR signed_flag IN ('', 'N')) AS pending_count,
        COUNT(*) FILTER (WHERE stuck_flag = 'Y')                               AS stuck_count
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code IS NOT NULL
      AND delivery_branch_code <> ''
    GROUP BY delivery_branch_code
    ORDER BY parcel_count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_branch_summary() TO service_role;
