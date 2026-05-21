-- TikTok — นับพัสดุรายจังหวัดปลายทาง (สำหรับแผนที่ choropleth)
-- คืนชื่อจังหวัดดิบ (ไทย) + จำนวน → normalize เป็นชื่ออังกฤษใน app layer
-- ผลลัพธ์เล็ก (~77 แถว) นับใน Postgres query เดียว

CREATE OR REPLACE FUNCTION public.tiktok_by_province()
RETURNS TABLE(province text, cnt bigint)
LANGUAGE sql STABLE AS $$
    SELECT btrim(dest_province) AS province, count(*)::bigint AS cnt
    FROM public.tiktok_shipments
    WHERE dest_province IS NOT NULL
      AND btrim(dest_province) <> ''
    GROUP BY 1
    ORDER BY count(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.tiktok_by_province() TO service_role;

CREATE INDEX IF NOT EXISTS tiktok_shipments_dest_province_idx
    ON public.tiktok_shipments (dest_province);
