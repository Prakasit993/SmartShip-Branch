-- ============================================
-- SmartShip Security Hardening Migration
-- Run this in Supabase SQL Editor AFTER 20260114_fix_rls_security.sql
-- Date: 2026-01-15
-- ============================================

-- ============================================
-- 1. ORDER_ITEMS: Add SELECT policy
-- Users can only view items from orders they own
-- ============================================
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;

CREATE POLICY "Users can view own order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE orders.id = order_items.order_id 
            AND orders.user_id = auth.uid()
        )
    );

-- ============================================
-- 2. CUSTOMERS: Tighten security
-- Remove public read - only service_role can access
-- ============================================
DROP POLICY IF EXISTS "Users can view own customer data" ON public.customers;
-- No public SELECT policy = only service_role can read customer data

-- ============================================
-- 3. CATEGORIES: Add active-only filter
-- ============================================
DROP POLICY IF EXISTS "Public read categories" ON public.categories;

CREATE POLICY "Public read active categories" ON public.categories
    FOR SELECT USING (is_active = true);

-- ============================================
-- 4. BUNDLE related tables: Add active-only filter
-- Only show items for active bundles
-- ============================================
DROP POLICY IF EXISTS "Public read bundle_items" ON public.bundle_items;
DROP POLICY IF EXISTS "Public read bundle_option_groups" ON public.bundle_option_groups;
DROP POLICY IF EXISTS "Public read bundle_options" ON public.bundle_options;

CREATE POLICY "Public read bundle_items for active bundles" ON public.bundle_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bundles 
            WHERE bundles.id = bundle_items.bundle_id 
            AND bundles.is_active = true
        )
    );

CREATE POLICY "Public read bundle_option_groups for active bundles" ON public.bundle_option_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bundles 
            WHERE bundles.id = bundle_option_groups.bundle_id 
            AND bundles.is_active = true
        )
    );

CREATE POLICY "Public read bundle_options for active groups" ON public.bundle_options
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bundle_option_groups bog
            JOIN public.bundles b ON b.id = bog.bundle_id
            WHERE bog.id = bundle_options.group_id 
            AND b.is_active = true
        )
    );

-- ============================================
-- 5. CARTS/CART_ITEMS: Add policies if tables exist
-- ============================================
DO $$
BEGIN
    -- Check if carts table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'carts') THEN
        -- Enable RLS
        EXECUTE 'ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;';
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "Users can view own cart" ON public.carts;
        DROP POLICY IF EXISTS "Users can insert own cart" ON public.carts;
        DROP POLICY IF EXISTS "Users can update own cart" ON public.carts;
        DROP POLICY IF EXISTS "Users can delete own cart" ON public.carts;
        
        -- Users can only access their own cart
        CREATE POLICY "Users can view own cart" ON public.carts
            FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own cart" ON public.carts
            FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own cart" ON public.carts
            FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own cart" ON public.carts
            FOR DELETE USING (auth.uid() = user_id);
            
        RAISE NOTICE 'Carts table policies created';
    END IF;
    
    -- Check if cart_items table exists
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cart_items') THEN
        EXECUTE 'ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;';
        
        DROP POLICY IF EXISTS "Users can view own cart items" ON public.cart_items;
        DROP POLICY IF EXISTS "Users can insert own cart items" ON public.cart_items;
        DROP POLICY IF EXISTS "Users can update own cart items" ON public.cart_items;
        DROP POLICY IF EXISTS "Users can delete own cart items" ON public.cart_items;
        
        -- Users can only access cart_items in their own cart
        CREATE POLICY "Users can view own cart items" ON public.cart_items
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.carts 
                    WHERE carts.id = cart_items.cart_id 
                    AND carts.user_id = auth.uid()
                )
            );
        CREATE POLICY "Users can insert own cart items" ON public.cart_items
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.carts 
                    WHERE carts.id = cart_items.cart_id 
                    AND carts.user_id = auth.uid()
                )
            );
        CREATE POLICY "Users can update own cart items" ON public.cart_items
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.carts 
                    WHERE carts.id = cart_items.cart_id 
                    AND carts.user_id = auth.uid()
                )
            );
        CREATE POLICY "Users can delete own cart items" ON public.cart_items
            FOR DELETE USING (
                EXISTS (
                    SELECT 1 FROM public.carts 
                    WHERE carts.id = cart_items.cart_id 
                    AND carts.user_id = auth.uid()
                )
            );
            
        RAISE NOTICE 'Cart_items table policies created';
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERY
-- Run this to verify all policies are set up
-- ============================================
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
