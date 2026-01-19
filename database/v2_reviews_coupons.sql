-- SmartShip Version 2.0 - Reviews & Coupons Schema
-- Run this in Supabase SQL Editor

-- =============================================
-- 1. Reviews Table
-- =============================================
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  bundle_id INTEGER REFERENCES bundles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  is_approved BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. Coupons Table
-- =============================================
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount DECIMAL(10,2),          -- Max discount for percentage type
  usage_limit INTEGER,                  -- Total times can be used (null = unlimited)
  usage_limit_per_user INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. Coupon Usage Tracking
-- =============================================
CREATE TABLE IF NOT EXISTS coupon_usage (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER REFERENCES coupons(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  customer_email TEXT,
  discount_amount DECIMAL(10,2),
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. Bulk Discounts Table
-- =============================================
CREATE TABLE IF NOT EXISTS bulk_discounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  min_quantity INTEGER NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_per_item', 'fixed_total')),
  discount_value DECIMAL(10,2) NOT NULL,
  applies_to TEXT DEFAULT 'all',      -- 'all', 'category', 'bundle'
  target_id INTEGER,                   -- category_id or bundle_id if not 'all'
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. Add coupon/discount columns to orders
-- =============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

-- =============================================
-- 6. RLS Policies
-- =============================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_discounts ENABLE ROW LEVEL SECURITY;

-- Public can read approved reviews
CREATE POLICY "Public can read approved reviews" ON reviews
  FOR SELECT USING (is_approved = true);

-- Public can insert reviews (moderation required)
CREATE POLICY "Anyone can submit reviews" ON reviews
  FOR INSERT WITH CHECK (true);

-- Public can read active coupons (for validation)
CREATE POLICY "Public can read active coupons" ON coupons
  FOR SELECT USING (is_active = true);

-- Public can read active bulk discounts
CREATE POLICY "Public can read active bulk discounts" ON bulk_discounts
  FOR SELECT USING (is_active = true);

-- =============================================
-- 7. Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_reviews_bundle_id ON reviews(bundle_id);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_bulk_discounts_active ON bulk_discounts(is_active);

-- =============================================
-- 8. Updated_at triggers
-- =============================================
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 9. Sample data (optional)
-- =============================================
-- INSERT INTO coupons (code, name, discount_type, discount_value, min_order_amount, expires_at) VALUES
--   ('WELCOME10', 'ส่วนลดลูกค้าใหม่ 10%', 'percentage', 10, 500, NOW() + INTERVAL '1 year'),
--   ('SAVE50', 'ลด 50 บาท', 'fixed', 50, 300, NOW() + INTERVAL '6 months');

-- =============================================
-- Done! Check if tables created successfully:
-- =============================================
-- SELECT * FROM reviews;
-- SELECT * FROM coupons;
-- SELECT * FROM bulk_discounts;
