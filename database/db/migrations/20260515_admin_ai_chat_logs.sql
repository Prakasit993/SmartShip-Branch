-- admin_ai_chat_logs — บันทึก turn-by-turn ของแชท Data Analyst AI
-- เก็บคำถาม / คำตอบ / tools ที่ AI เรียก / latency
-- ใช้สำหรับ: audit, วิเคราะห์ pattern คำถาม, หา coverage gaps สำหรับ Phase 2 tools
--
-- Auth: admin-only ทั้ง insert (route ตรวจ session admin ก่อน) และ read (page เปิด admin-only)
-- Retention: ไม่ auto-purge — manual หรือเพิ่ม cron ใน Supabase ภายหลัง

CREATE TABLE IF NOT EXISTS public.admin_ai_chat_logs (
    id              bigserial PRIMARY KEY,
    session_id      text NOT NULL,
    user_email      text,                       -- ถ้า login ผ่าน password-admin จะเป็น 'admin' (ไม่ใช่ email)
    user_role       text,                       -- 'admin' | 'staff' — สถานะตอนถาม
    user_message    text NOT NULL,
    ai_response     text NOT NULL,
    tools_called    jsonb,                      -- [{ name, args, status, duration_ms }] — null ถ้า n8n ไม่ส่งกลับ
    context         jsonb,                      -- { page, pathname, today, timezone, ... }
    latency_ms      int,                        -- รวม proxy → n8n → kpi tool → respond
    error           text,                       -- null ถ้าสำเร็จ; ใส่ message ถ้า upstream fail (เก็บไว้ดู rate)
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- หน้า log list เรียงล่าสุดก่อน → index หลักคือ created_at desc
CREATE INDEX IF NOT EXISTS idx_admin_ai_chat_logs_created_at
    ON public.admin_ai_chat_logs (created_at DESC);

-- ดู conversation รายเซสชัน
CREATE INDEX IF NOT EXISTS idx_admin_ai_chat_logs_session
    ON public.admin_ai_chat_logs (session_id, created_at DESC);

-- filter ตาม user
CREATE INDEX IF NOT EXISTS idx_admin_ai_chat_logs_user
    ON public.admin_ai_chat_logs (user_email, created_at DESC)
    WHERE user_email IS NOT NULL;

-- ดู error rate / debugging
CREATE INDEX IF NOT EXISTS idx_admin_ai_chat_logs_errors
    ON public.admin_ai_chat_logs (created_at DESC)
    WHERE error IS NOT NULL;

COMMENT ON TABLE public.admin_ai_chat_logs IS
    'บันทึกทุก turn ของ Data Analyst AI chat — ใช้ audit + วิเคราะห์ coverage gaps. Insert by /api/admin/ai-chat, read by /api/admin/ai-chat-logs (admin-only).';
