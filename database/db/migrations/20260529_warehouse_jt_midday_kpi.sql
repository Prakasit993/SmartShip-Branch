-- 2026-05-29: Mid-day KPI gate — Phase 4
--
-- Business rule (จาก [[project-jt-warehouse-business-rules]] § 4):
--   เป้าก่อนเที่ยง 12:00 Asia/Bangkok ต้องปิดงาน ≥ 20% ของยอดเข้าวันนี้
--   ปรับเป้าได้ผ่าน config table
--
-- Denominator: parcels ที่ arrived_branch_time = today
-- Numerator: ปิดงาน (rule #1: 6 fields ครบ)
--            AND (closed_time = today หรือ signed_time = today)

-- ────────────────────────────────────────────────────────────────
-- 1. Config table — เก็บ target/cutoff (admin ปรับได้)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.jt_warehouse_config (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    description text,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  text
);

COMMENT ON TABLE public.jt_warehouse_config IS
    'Config สำหรับ /admin/jt-warehouse — target %, cutoff hour, threshold ต่าง ๆ';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.jt_warehouse_config_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jt_warehouse_config_updated_at ON public.jt_warehouse_config;
CREATE TRIGGER jt_warehouse_config_updated_at
    BEFORE UPDATE ON public.jt_warehouse_config
    FOR EACH ROW EXECUTE FUNCTION public.jt_warehouse_config_set_updated_at();

-- RLS: service_role only
ALTER TABLE public.jt_warehouse_config ENABLE ROW LEVEL SECURITY;

-- Seed default values
INSERT INTO public.jt_warehouse_config (key, value, description, updated_by) VALUES
    ('midday_target_pct',  '0.20'::jsonb,  'เป้าก่อนเที่ยง (% ของยอดเข้าวันนี้) — 0.20 = 20%', 'seed'),
    ('midday_cutoff_hour', '12'::jsonb,    'เวลา cutoff (ชั่วโมง) ตาม Asia/Bangkok — 12 = เที่ยง', 'seed')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 2. Helper RPCs สำหรับอ่าน/เขียน config
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_jt_warehouse_config(p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT value FROM public.jt_warehouse_config WHERE key = p_key;
$$;

GRANT EXECUTE ON FUNCTION public.get_jt_warehouse_config(text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_jt_warehouse_config(
    p_key        text,
    p_value      jsonb,
    p_updated_by text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.jt_warehouse_config (key, value, updated_by)
    VALUES (p_key, p_value, p_updated_by)
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by;
$$;

GRANT EXECUTE ON FUNCTION public.set_jt_warehouse_config(text, jsonb, text) TO service_role;

-- ────────────────────────────────────────────────────────────────
-- 3. Mid-day KPI performance RPC
-- ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_warehouse_jt_midday_performance(
    p_delivery_branch_code text,
    p_today                date DEFAULT NULL    -- default = today in Asia/Bangkok
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today                 date;
    v_target_pct            numeric;
    v_cutoff_hour           integer;
    v_intake_count          integer;
    v_closed_count          integer;
    v_closed_pct            numeric;
    v_target_count          integer;
    v_status                text;
    v_now_bangkok           timestamptz;
    v_cutoff_today          timestamptz;
    v_minutes_until_cutoff  integer;
    v_is_after_cutoff       boolean;
BEGIN
    v_today := COALESCE(p_today, (now() AT TIME ZONE 'Asia/Bangkok')::date);

    -- Config (with defaults)
    v_target_pct := COALESCE(
        (SELECT value::text::numeric FROM public.jt_warehouse_config WHERE key = 'midday_target_pct'),
        0.20
    );
    v_cutoff_hour := COALESCE(
        (SELECT value::text::integer FROM public.jt_warehouse_config WHERE key = 'midday_cutoff_hour'),
        12
    );

    -- Cutoff timestamp (Bangkok)
    v_cutoff_today := (v_today + make_time(v_cutoff_hour, 0, 0)) AT TIME ZONE 'Asia/Bangkok';
    v_now_bangkok := now();
    v_minutes_until_cutoff := FLOOR(EXTRACT(EPOCH FROM (v_cutoff_today - v_now_bangkok)) / 60)::integer;
    v_is_after_cutoff := v_now_bangkok > v_cutoff_today;

    -- Intake today
    SELECT COUNT(*)::integer INTO v_intake_count
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code = p_delivery_branch_code
      AND public.jt_parse_arrived_date(arrived_branch_time) = v_today;

    -- Closed today (signed AND (closed_time OR signed_time) = today)
    SELECT COUNT(*)::integer INTO v_closed_count
    FROM public.warehouse_jt_parcels
    WHERE delivery_branch_code = p_delivery_branch_code
      AND public.jt_parcel_is_closed(
          signed_time, sign_branch_name, signed_record_time,
          signed_by_staff, signer_name, sign_time_status
      )
      AND (
          public.jt_parse_arrived_date(closed_time)  = v_today
          OR public.jt_parse_arrived_date(signed_time) = v_today
      );

    v_closed_pct := CASE
        WHEN v_intake_count > 0 THEN v_closed_count::numeric / v_intake_count::numeric
        ELSE 0
    END;
    v_target_count := CEIL(v_intake_count::numeric * v_target_pct)::integer;

    -- Status:
    --   no_data    — ไม่มี intake วันนี้ (UI ซ่อน card)
    --   achieved   — ทำเป้าได้ (≥ target_pct)
    --   missed     — เลย cutoff แล้วยังไม่ถึงเป้า
    --   behind     — ยังไม่ถึงเป้า แต่ยังไม่เลย cutoff
    IF v_intake_count = 0 THEN
        v_status := 'no_data';
    ELSIF v_closed_pct >= v_target_pct THEN
        v_status := 'achieved';
    ELSIF v_is_after_cutoff THEN
        v_status := 'missed';
    ELSE
        v_status := 'behind';
    END IF;

    RETURN jsonb_build_object(
        'branch_code',           p_delivery_branch_code,
        'date',                  v_today,
        'target_pct',            v_target_pct,
        'cutoff_hour',           v_cutoff_hour,
        'intake_count',          v_intake_count,
        'closed_count',          v_closed_count,
        'closed_pct',            ROUND(v_closed_pct, 4),
        'target_count',          v_target_count,
        'delta_count',           v_closed_count - v_target_count,
        'delta_pct',             ROUND(v_closed_pct - v_target_pct, 4),
        'status',                v_status,
        'minutes_until_cutoff',  v_minutes_until_cutoff,
        'is_after_cutoff',       v_is_after_cutoff
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_warehouse_jt_midday_performance(text, date) TO service_role;
