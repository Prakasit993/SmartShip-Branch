-- 2026-05-29: Infrastructure สำหรับ auto-sync 3 portals
--
-- ใช้ใน Phase A ของ auto-sync plan — ดู docs/auto-sync-plan.md
--   1. n8n_playwright_state — เก็บ session/cookies ของ Playwright
--      (n8n อ่าน/เขียนผ่าน /api/admin/auto-sync/state/[portal])
--   2. auto_sync_health — track สถานะการ sync ของแต่ละ portal
--      (UI แสดงใน dashboard ของแต่ละ module + LINE alert ถ้า stale)

-- ────────────────────────────────────────────────────────────────
-- 1. Playwright storage state (cookies + localStorage)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.n8n_playwright_state (
    portal        text PRIMARY KEY,
    storage_state jsonb NOT NULL,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    -- Optional: เก็บ info เพิ่ม
    login_count   integer NOT NULL DEFAULT 0,    -- เพิ่มทุกครั้งที่ login ใหม่
    notes         text
);

COMMENT ON TABLE public.n8n_playwright_state IS
    'Playwright storage state (cookies/localStorage) per portal. ใช้ใน auto-sync workflows';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.n8n_playwright_state_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS n8n_playwright_state_updated_at ON public.n8n_playwright_state;
CREATE TRIGGER n8n_playwright_state_updated_at
    BEFORE UPDATE ON public.n8n_playwright_state
    FOR EACH ROW EXECUTE FUNCTION public.n8n_playwright_state_set_updated_at();

-- RLS: service_role เท่านั้น (storage state เป็นข้อมูล sensitive)
ALTER TABLE public.n8n_playwright_state ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- 2. Auto-sync health tracking
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auto_sync_health (
    kind                text PRIMARY KEY,           -- 'jt_parcel' | 'jt_shipment' | 'tiktok'
    last_started_at     timestamptz,
    last_finished_at    timestamptz,
    last_status         text,                       -- 'success' | 'error' | 'running'
    last_affected_rows  integer,
    last_error          text,
    last_request_id     text,                       -- link กลับ jt_upload_jobs.request_id
    -- Schedule metadata
    schedule_label      text,                       -- 'ทุก 15 นาที' / 'ทุก 1 ชม.' / 'ทุก 3 ชม.'
    expected_interval_min integer,                  -- 15 / 60 / 180 — สำหรับ stale check
    -- Counters
    success_count_today integer NOT NULL DEFAULT 0,
    error_count_today   integer NOT NULL DEFAULT 0,
    counters_reset_at   date NOT NULL DEFAULT CURRENT_DATE,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auto_sync_health IS
    'Track สถานะ auto-sync ของแต่ละ portal — UI ใช้แสดง health card';

-- Auto-update updated_at + reset counters ถ้าเปลี่ยนวัน
CREATE OR REPLACE FUNCTION public.auto_sync_health_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    -- Reset counters ถ้าวันเปลี่ยน
    IF NEW.counters_reset_at < CURRENT_DATE THEN
        NEW.success_count_today := 0;
        NEW.error_count_today := 0;
        NEW.counters_reset_at := CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_sync_health_updated_at ON public.auto_sync_health;
CREATE TRIGGER auto_sync_health_updated_at
    BEFORE UPDATE ON public.auto_sync_health
    FOR EACH ROW EXECUTE FUNCTION public.auto_sync_health_set_updated_at();

-- RLS: ทุก authenticated user อ่านได้ (info สำหรับ admin dashboard)
ALTER TABLE public.auto_sync_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auto_sync_health_select_all ON public.auto_sync_health;
CREATE POLICY auto_sync_health_select_all
    ON public.auto_sync_health
    FOR SELECT
    USING (true);   -- service_role ใช้ direct, browser ใช้ Next.js API ที่มี auth

-- ────────────────────────────────────────────────────────────────
-- 3. Seed initial rows
-- ────────────────────────────────────────────────────────────────

INSERT INTO public.auto_sync_health (kind, schedule_label, expected_interval_min)
VALUES
    ('jt_parcel',   'ทุก 15 นาที (06:00–21:00)',  15),
    ('jt_shipment', 'ทุก 3 ชม. (06:10, 09:10, ...)', 180),
    ('tiktok',      'ทุก 1 ชม. (xx:05)',            60)
ON CONFLICT (kind) DO UPDATE SET
    schedule_label = EXCLUDED.schedule_label,
    expected_interval_min = EXCLUDED.expected_interval_min;

-- ────────────────────────────────────────────────────────────────
-- 4. Helper RPC: คำนวณว่า kind ไหน stale (สำหรับ dashboard + alert)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_auto_sync_health()
RETURNS TABLE (
    kind                text,
    schedule_label      text,
    expected_interval_min integer,
    last_started_at     timestamptz,
    last_finished_at    timestamptz,
    last_status         text,
    last_affected_rows  integer,
    last_error          text,
    last_request_id     text,
    success_count_today integer,
    error_count_today   integer,
    -- Computed: นาทีตั้งแต่ finish ครั้งล่าสุด
    minutes_since_last  integer,
    -- Computed: stale = ห่างจาก interval > 1.5x
    is_stale            boolean,
    -- Computed: ตอนนี้อยู่ในเวลาทำงานไหม (06:00–21:00 TZ Bangkok)
    in_working_hours    boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH bangkok_now AS (
        SELECT (now() AT TIME ZONE 'Asia/Bangkok')::time AS local_time
    )
    SELECT
        h.kind,
        h.schedule_label,
        h.expected_interval_min,
        h.last_started_at,
        h.last_finished_at,
        h.last_status,
        h.last_affected_rows,
        h.last_error,
        h.last_request_id,
        h.success_count_today,
        h.error_count_today,
        CASE
            WHEN h.last_finished_at IS NULL THEN NULL
            ELSE FLOOR(EXTRACT(EPOCH FROM (now() - h.last_finished_at)) / 60)::integer
        END AS minutes_since_last,
        CASE
            WHEN h.last_finished_at IS NULL THEN true
            WHEN EXTRACT(EPOCH FROM (now() - h.last_finished_at)) / 60
                 > h.expected_interval_min * 1.5
                THEN true
            ELSE false
        END AS is_stale,
        (
            (SELECT local_time FROM bangkok_now) >= '06:00'::time
            AND (SELECT local_time FROM bangkok_now) < '21:30'::time
        ) AS in_working_hours
    FROM public.auto_sync_health h
    ORDER BY h.kind;
$$;

GRANT EXECUTE ON FUNCTION public.get_auto_sync_health() TO service_role;

-- ────────────────────────────────────────────────────────────────
-- 5. Helper RPC: atomic counter increment (success_count / error_count)
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_auto_sync_counter(
    p_kind  text,
    p_field text   -- 'success_count_today' | 'error_count_today'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_field NOT IN ('success_count_today', 'error_count_today') THEN
        RAISE EXCEPTION 'invalid field: %', p_field;
    END IF;

    EXECUTE format(
        'UPDATE public.auto_sync_health SET %I = %I + 1 WHERE kind = $1',
        p_field, p_field
    ) USING p_kind;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_auto_sync_counter(text, text) TO service_role;
