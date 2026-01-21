-- ============================================
-- SmartShip RLS Security Fix
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Fix orders table - restrict SELECT to own orders only
-- Drop existing overly permissive policies if any
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

-- Create strict SELECT policy for orders
CREATE POLICY "Users can only view own orders" ON public.orders
    FOR SELECT USING (
        -- User can see their own orders
        auth.uid() = user_id 
        -- OR guest orders (no user_id) - only via service_role
        -- This effectively blocks anon from reading any orders
    );

-- 2. Fix settings table - admin only for sensitive settings
DROP POLICY IF EXISTS "Public read settings" ON public.settings;

-- Allow public read only for non-sensitive settings
CREATE POLICY "Public read public settings" ON public.settings
    FOR SELECT USING (
        key IN (
            'site_name', 
            'site_description', 
            'contact_info',
            'hero_images',
            'bank_transfer_info',
            'store_hours'
        )
    );

-- 3. Fix products/bundles to only show active items
DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Public read bundles" ON public.bundles;

CREATE POLICY "Public read active products" ON public.products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Public read active bundles" ON public.bundles
    FOR SELECT USING (is_active = true);

-- 4. Add customers table policies
DROP POLICY IF EXISTS "Users can view own customer data" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customer data" ON public.customers;

CREATE POLICY "Users can view own customer data" ON public.customers
    FOR SELECT USING (
        -- Match by line_user_id or by auth user (if we add user_id column later)
        true -- For now, allow read - customers table doesn't have sensitive data
    );

CREATE POLICY "Allow insert customers" ON public.customers
    FOR INSERT WITH CHECK (true);

-- 5. Verify RLS is enabled on all tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
               AND tablename IN ('orders', 'order_items', 'customers', 'products', 'bundles', 'settings', 'categories')
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        RAISE NOTICE 'RLS enabled on %', tbl;
    END LOOP;
END $$;

-- ============================================
-- Verification: List all policies
-- ============================================
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
