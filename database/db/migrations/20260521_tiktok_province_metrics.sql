-- TikTok — เมตริกรายจังหวัดสำหรับแผนที่อัตราปัญหา (เฟส 1)
-- กฎ closed/issue อิง single source of truth ของ jt_shipments
-- ผลลัพธ์เล็ก (~77 แถว) → 1 query, normalize ชื่อจังหวัดใน app layer

-- ── เมตริกคงที่รายจังหวัด: total / ยังไม่ปิดงาน / มีปัญหา ──
CREATE OR REPLACE FUNCTION public.tiktok_province_metrics()
RETURNS TABLE(province text, total bigint, not_closed bigint, issue bigint)
LANGUAGE sql STABLE AS $$
    SELECT
        btrim(dest_province) AS province,
        count(*)::bigint AS total,
        count(*) FILTER (
            WHERE signer_name IS NULL
               OR btrim(signer_name) = ''
               OR upper(btrim(signer_name)) = 'NULL'
        )::bigint AS not_closed,
        count(*) FILTER (
            WHERE return_type IS NOT NULL
              AND btrim(return_type) <> ''
              AND upper(btrim(return_type)) NOT IN ('EMPTY', 'NULL', '-')
        )::bigint AS issue
    FROM public.tiktok_shipments
    WHERE dest_province IS NOT NULL AND btrim(dest_province) <> ''
    GROUP BY 1;
$$;

-- ── เหตุผลยอดนิยม (exception_reason) + จำนวนรายจังหวัด ──
-- คืนเฉพาะ top_n เหตุผล เพื่อจำกัด payload
CREATE OR REPLACE FUNCTION public.tiktok_province_reason(top_n int DEFAULT 15)
RETURNS TABLE(reason text, province text, cnt bigint)
LANGUAGE sql STABLE AS $$
    WITH valid AS (
        SELECT btrim(exception_reason) AS reason, btrim(dest_province) AS province
        FROM public.tiktok_shipments
        WHERE exception_reason IS NOT NULL AND btrim(exception_reason) <> ''
          AND upper(btrim(exception_reason)) NOT IN ('EMPTY', 'NULL', '-')
          AND dest_province IS NOT NULL AND btrim(dest_province) <> ''
    ),
    top_reasons AS (
        SELECT reason FROM valid GROUP BY reason ORDER BY count(*) DESC LIMIT GREATEST(top_n, 1)
    )
    SELECT v.reason, v.province, count(*)::bigint
    FROM valid v
    WHERE v.reason IN (SELECT reason FROM top_reasons)
    GROUP BY v.reason, v.province;
$$;

GRANT EXECUTE ON FUNCTION public.tiktok_province_metrics()   TO service_role;
GRANT EXECUTE ON FUNCTION public.tiktok_province_reason(int) TO service_role;

CREATE INDEX IF NOT EXISTS tiktok_shipments_return_type_idx       ON public.tiktok_shipments (return_type);
CREATE INDEX IF NOT EXISTS tiktok_shipments_exception_reason_idx  ON public.tiktok_shipments (exception_reason);
