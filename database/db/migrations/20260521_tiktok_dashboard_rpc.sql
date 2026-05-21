-- TikTok dashboard — ย้าย aggregate ไปทำที่ Postgres เพื่อความเร็ว
-- แทนการดึงทุกแถวมานับใน Next.js (เดิม ~10 query/เปิดหน้า) → เหลือ query เดียวต่อการ์ด
-- เรียกผ่าน supabaseAdmin (service_role) ใน /api/admin/tiktok-shipments/*

-- ── 1) ยอดรวม + ปิดงานแล้ว (กฎเดียวกับ jt_shipments) ──
CREATE OR REPLACE FUNCTION public.tiktok_dashboard_totals()
RETURNS TABLE(total bigint, closed_count bigint)
LANGUAGE sql STABLE AS $$
    SELECT
        count(*)::bigint AS total,
        count(*) FILTER (
            WHERE signer_name IS NOT NULL
              AND btrim(signer_name) <> ''
              AND upper(btrim(signer_name)) <> 'NULL'
        )::bigint AS closed_count
    FROM public.tiktok_shipments;
$$;

-- ── 2) ผู้ส่งบ่อยสุด — group ตาม (sender_name + shop_name) ──
CREATE OR REPLACE FUNCTION public.tiktok_top_senders(top_n int DEFAULT 10)
RETURNS TABLE(sender text, shop text, cnt bigint)
LANGUAGE sql STABLE AS $$
    SELECT
        COALESCE(btrim(sender_name), '') AS sender,
        COALESCE(btrim(shop_name), '')   AS shop,
        count(*)::bigint                  AS cnt
    FROM public.tiktok_shipments
    WHERE COALESCE(btrim(sender_name), '') <> ''
       OR COALESCE(btrim(shop_name), '')   <> ''
    GROUP BY 1, 2
    ORDER BY count(*) DESC
    LIMIT GREATEST(top_n, 1);
$$;

-- ── 3) สินค้าขายดี — group ตาม product_name ──
CREATE OR REPLACE FUNCTION public.tiktok_top_products(top_n int DEFAULT 50)
RETURNS TABLE(name text, cnt bigint)
LANGUAGE sql STABLE AS $$
    SELECT
        btrim(product_name) AS name,
        count(*)::bigint     AS cnt
    FROM public.tiktok_shipments
    WHERE product_name IS NOT NULL
      AND btrim(product_name) <> ''
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT GREATEST(top_n, 1);
$$;

GRANT EXECUTE ON FUNCTION public.tiktok_dashboard_totals()      TO service_role;
GRANT EXECUTE ON FUNCTION public.tiktok_top_senders(int)        TO service_role;
GRANT EXECUTE ON FUNCTION public.tiktok_top_products(int)       TO service_role;

-- ── index ช่วย GROUP BY / FILTER เมื่อข้อมูลโต ──
CREATE INDEX IF NOT EXISTS tiktok_shipments_sender_name_idx  ON public.tiktok_shipments (sender_name);
CREATE INDEX IF NOT EXISTS tiktok_shipments_shop_name_idx    ON public.tiktok_shipments (shop_name);
CREATE INDEX IF NOT EXISTS tiktok_shipments_product_name_idx ON public.tiktok_shipments (product_name);
CREATE INDEX IF NOT EXISTS tiktok_shipments_signer_name_idx  ON public.tiktok_shipments (signer_name);
