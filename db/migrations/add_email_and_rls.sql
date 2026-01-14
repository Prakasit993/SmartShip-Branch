-- ============================================
-- SmartShip Database Migration Script
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. เพิ่ม customer_email column (สำหรับ n8n email integration)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- 2. เพิ่ม user_id column (สำหรับ RLS)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. สร้าง index สำหรับ performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- 4. RLS Policies สำหรับ orders (ปลอดภัยขึ้น)
-- ให้ users อ่านเฉพาะ orders ของตัวเอง หรือ orders ที่ไม่มี user_id (guest)
DO $$
BEGIN
    -- Drop existing policy if exists
    DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
    
    -- Create new policy
    CREATE POLICY "Users can view own orders" ON public.orders
        FOR SELECT USING (
            auth.uid() = user_id OR 
            user_id IS NULL
        );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy creation skipped: %', SQLERRM;
END $$;

-- 5. สร้าง update policy
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
    
    CREATE POLICY "Users can update own orders" ON public.orders
        FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Policy creation skipped: %', SQLERRM;
END $$;

-- ============================================
-- Verification: Check columns exist
-- ============================================
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
    AND column_name IN ('customer_email', 'user_id');
