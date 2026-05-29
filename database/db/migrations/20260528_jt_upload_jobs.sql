-- 2026-05-28: jt_upload_jobs — ติดตามสถานะการอัปโหลดไฟล์ J&T แบบ async
--
-- Phase 3.6 — รองรับ Realtime status update ในหน้า admin
--   1. Modal ยิง POST → Next.js สร้าง job row (status='processing')
--   2. Proxy file ไปยัง n8n + ส่ง request_id ใน query
--   3. n8n ตอบทันที, แล้วทำ background — เมื่อจบ ยิง callback กลับ
--   4. Callback UPDATE job row → Supabase Realtime broadcast → Modal update
--
-- ใช้ Supabase Realtime (postgres_changes) — เปิด replication บน table นี้

CREATE TABLE IF NOT EXISTS public.jt_upload_jobs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id   text NOT NULL UNIQUE,            -- UUID ที่ generate ฝั่ง client/server, ใช้เป็น channel key
    user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    kind         text NOT NULL DEFAULT 'jt_parcel',  -- 'jt_parcel' | future 'tiktok' / 'stock' ...
    status       text NOT NULL DEFAULT 'processing'
                 CHECK (status IN ('processing', 'success', 'error', 'timeout')),
    file_name    text,
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    stats        jsonb,                            -- { affected_rows, duration_ms, ... }
    error        text,                             -- error message if status='error'
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index — query รายการของ user คนนั้น (สำหรับ Upload History)
CREATE INDEX IF NOT EXISTS jt_upload_jobs_user_started_idx
    ON public.jt_upload_jobs (user_id, started_at DESC);

-- Index — query by request_id (callback lookup)
CREATE INDEX IF NOT EXISTS jt_upload_jobs_request_idx
    ON public.jt_upload_jobs (request_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.jt_upload_jobs_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jt_upload_jobs_updated_at ON public.jt_upload_jobs;
CREATE TRIGGER jt_upload_jobs_updated_at
    BEFORE UPDATE ON public.jt_upload_jobs
    FOR EACH ROW EXECUTE FUNCTION public.jt_upload_jobs_set_updated_at();

-- RLS
ALTER TABLE public.jt_upload_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: user เห็นแค่ jobs ของตัวเอง (ผ่าน supabase client browser ใช้ user JWT)
DROP POLICY IF EXISTS jt_upload_jobs_select_own ON public.jt_upload_jobs;
CREATE POLICY jt_upload_jobs_select_own
    ON public.jt_upload_jobs
    FOR SELECT
    USING (user_id = auth.uid());

-- service_role bypass RLS โดยอัตโนมัติ — ไม่ต้องเพิ่ม policy

-- เปิด Realtime replication บน table นี้
-- (Supabase: Database → Replication → ติ๊ก public.jt_upload_jobs)
-- คำสั่งเทียบเท่า:
ALTER PUBLICATION supabase_realtime ADD TABLE public.jt_upload_jobs;

-- Cleanup: ลบ jobs เก่ากว่า 30 วัน — รัน manual หรือ cron job
-- DELETE FROM public.jt_upload_jobs WHERE created_at < now() - interval '30 days';
