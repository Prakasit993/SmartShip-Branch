-- 2026-05-28: Helper แปลง arrived_branch_time (text) → date
--
-- arrived_branch_time จากไฟล์ J&T มี format ผสม:
--   • Excel serial: '46170.50526...' (วันที่ + เศษวัน = เวลา)
--   • ISO format:    '2026-05-28 12:00:00'
--   • Empty:         '' หรือ '-'
--
-- ใช้เป็นพื้นฐานของ daily filter ใน RPC ทุกตัว (Phase 3.5)
-- ดู [[project-jt-warehouse-business-rules]]

CREATE OR REPLACE FUNCTION public.jt_parse_arrived_date(t text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    v_serial numeric;
BEGIN
    IF t IS NULL OR t = '' OR t = '-' THEN
        RETURN NULL;
    END IF;

    -- Excel serial — สมมติว่าตัวเลขล้วน (อาจมีจุดทศนิยม)
    -- Excel epoch: 1899-12-30 (มี leap year bug ที่ทำให้เลื่อนเป็น -1 จาก 1900-01-01)
    IF t ~ '^[0-9]+(\.[0-9]+)?$' THEN
        BEGIN
            v_serial := t::numeric;
            -- Sanity range: 1 (1900-01-01) ถึง 100000 (~2173) — ค่านอกช่วงนี้คือ junk
            IF v_serial < 1 OR v_serial > 100000 THEN
                RETURN NULL;
            END IF;
            RETURN ('1899-12-30'::date + FLOOR(v_serial)::int);
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
    END IF;

    -- ISO date — รับ 'YYYY-MM-DD' หรือ 'YYYY-MM-DD HH:MM:SS' หรือ 'YYYY-MM-DDTHH:MM:SS'
    IF t ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
        BEGIN
            RETURN substring(t, 1, 10)::date;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
    END IF;

    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.jt_parse_arrived_date(text) TO service_role;

-- Index บน parsed date — เร่ง filter daily
CREATE INDEX IF NOT EXISTS warehouse_jt_parcels_arrived_date_idx
    ON public.warehouse_jt_parcels (
        public.jt_parse_arrived_date(arrived_branch_time)
    );

-- Composite ผสม branch + date — เร่ง query daily filter ต่อสาขา
CREATE INDEX IF NOT EXISTS warehouse_jt_parcels_branch_arrived_date_idx
    ON public.warehouse_jt_parcels (
        delivery_branch_code,
        public.jt_parse_arrived_date(arrived_branch_time)
    );
