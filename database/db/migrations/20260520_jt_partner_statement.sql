-- =====================================================================
-- jt_partner_statement: ตารางเก็บข้อมูล Statement ที่ J&T แฟรนไชส์ส่งมา
-- รายละเอียดต้นทุนระดับ AWB สำหรับ Reconciliation
-- =====================================================================

-- ตารางหลัก: เก็บรายการจาก Excel Statement ของ J&T
CREATE TABLE IF NOT EXISTS public.jt_partner_statement (
    id              bigserial PRIMARY KEY,

    -- Metadata ของการ import
    statement_period    text,           -- เช่น '2026-05' (YYYY-MM) สำหรับกรอง/จัดกลุ่ม
    source_filename     text,           -- ชื่อไฟล์ต้นทาง
    imported_at         timestamptz NOT NULL DEFAULT now(),

    -- คอลัมน์จาก Statement J&T (ตรงกับหัวตารางในไฟล์ Excel)
    franchise_code      text,           -- รหัสเจ้าสำรอง
    awb_number          text,           -- หมายเลข AWB (key สำหรับ join กับ jt_shipments)
    branch_code         text,           -- รหัสสาขา (เช่น 504911)
    charge_type         text,           -- ประเภทของยอดค่าใช้จ่าย
    amount              numeric(12,2),  -- จำนวนเงิน (ติดลบ = เดบิต/ต้นทุน)
    transaction_date    date,           -- วันที่ทำธุรกรรม
    remarks             text,           -- หมายเหตุ

    -- dedup key: ป้องกัน import ซ้ำ (ถ้า AWB + charge_type + amount + transaction_date ซ้ำ = skip)
    CONSTRAINT jt_partner_statement_dedup UNIQUE NULLS NOT DISTINCT (
        awb_number, charge_type, amount, transaction_date, source_filename
    )
);

COMMENT ON TABLE public.jt_partner_statement IS
    'Statement รายรอบจาก J&T แฟรนไชส์ — รายการต้นทุนระดับ AWB สำหรับกระทบยอดกับต้นทุนที่คำนวณเอง';

COMMENT ON COLUMN public.jt_partner_statement.charge_type IS
    'ประเภทยอด เช่น ต้นทุนค่าขนส่ง(成本运费), ปรับปรุงต้นทุนค่าขนส่ง(成本运费调整), Offset COD Service Fee, Offset System Fee';
COMMENT ON COLUMN public.jt_partner_statement.amount IS
    'จำนวนเงิน — ค่าลบ = ต้นทุน/เดบิต, ค่าบวก = คืนเงิน/เครดิต';
COMMENT ON COLUMN public.jt_partner_statement.statement_period IS
    'รอบ Statement เช่น 2026-05 ใช้สำหรับจัดกลุ่มและกรองข้อมูลตามรอบบิล';

-- Index สำหรับ reconciliation join (ด้วย awb_number)
CREATE INDEX IF NOT EXISTS jt_partner_statement_awb_idx
    ON public.jt_partner_statement (awb_number)
    WHERE awb_number IS NOT NULL;

-- Index สำหรับกรองด้วยวันที่และประเภท
CREATE INDEX IF NOT EXISTS jt_partner_statement_date_type_idx
    ON public.jt_partner_statement (transaction_date, charge_type)
    WHERE transaction_date IS NOT NULL;

-- Index สำหรับกรองด้วย period
CREATE INDEX IF NOT EXISTS jt_partner_statement_period_idx
    ON public.jt_partner_statement (statement_period)
    WHERE statement_period IS NOT NULL;

-- RLS
ALTER TABLE public.jt_partner_statement ENABLE ROW LEVEL SECURITY;

-- เฉพาะ service_role เท่านั้นที่ insert/update ได้
CREATE POLICY "service_role full access partner_statement"
    ON public.jt_partner_statement
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.jt_partner_statement FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jt_partner_statement TO service_role;
GRANT USAGE ON SEQUENCE public.jt_partner_statement_id_seq TO service_role;

-- =====================================================================
-- RPC: list statement periods ที่ import แล้ว (สำหรับ UI dropdown)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_jt_partner_statement_periods()
RETURNS TABLE(
    statement_period    text,
    source_filename     text,
    row_count           bigint,
    imported_at         timestamptz,
    date_min            date,
    date_max            date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(s.statement_period, 'ไม่ระบุ') AS statement_period,
        s.source_filename,
        COUNT(*) AS row_count,
        MIN(s.imported_at) AS imported_at,
        MIN(s.transaction_date) AS date_min,
        MAX(s.transaction_date) AS date_max
    FROM public.jt_partner_statement s
    GROUP BY s.statement_period, s.source_filename
    ORDER BY s.statement_period DESC NULLS LAST, MIN(s.imported_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.get_jt_partner_statement_periods() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_jt_partner_statement_periods() TO service_role;
