-- Migration: admin_ai_chat_shortcuts
-- Quick-send chip management for Admin Data Analyst AI chat.
-- Replaces the hardcoded KEYWORD_ACTIONS array in AdminAiChatDock.tsx.

CREATE TABLE IF NOT EXISTS admin_ai_chat_shortcuts (
    id          bigserial PRIMARY KEY,
    keyword     text      NOT NULL,
    prompt      text      NOT NULL,
    is_active   boolean   NOT NULL DEFAULT true,
    sort_order  integer   NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Keep active chips fast (only active ones are fetched by the dock)
CREATE INDEX IF NOT EXISTS idx_admin_ai_chat_shortcuts_active
    ON admin_ai_chat_shortcuts (sort_order, id)
    WHERE is_active = true;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_ai_chat_shortcuts_updated_at ON admin_ai_chat_shortcuts;
CREATE TRIGGER trg_admin_ai_chat_shortcuts_updated_at
    BEFORE UPDATE ON admin_ai_chat_shortcuts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: admin API uses service_role which bypasses RLS; still enable for consistency
ALTER TABLE admin_ai_chat_shortcuts ENABLE ROW LEVEL SECURITY;

-- Seed the 7 chips that were previously hardcoded
INSERT INTO admin_ai_chat_shortcuts (keyword, prompt, sort_order) VALUES
    ('COD วันนี้',           'สรุปยอด COD วันนี้ พร้อมเคสที่ยังค้างชำระ',                                                              0),
    ('ภาพรวมวันนี้',         'สรุปภาพรวม KPI วันนี้',                                                                                  1),
    ('กำไรขนส่งเดือนนี้',   'สรุปกำไรค่าขนส่งเดือนนี้ (ยอดค่าขนส่งรวม, ต้นทุน, กำไรสุทธิ) เทียบกับเดือนที่แล้ว',                 2),
    ('COD เดือนนี้',         'สรุปยอด COD เดือนนี้ พร้อมอัตราการชำระ',                                                                3),
    ('เทียบเดือนที่แล้ว',   'สรุปภาพรวมเดือนนี้เทียบเดือนที่แล้ว — ยอดพัสดุ, COD, ค่าส่ง, อัตราตีกลับ',                         4),
    ('COD ค้างเกิน 24 ชม.', 'แสดงเคส COD ที่ส่งสำเร็จแต่ยังไม่ได้ชำระเกิน 24 ชั่วโมงในเดือนนี้',                                  5),
    ('เคสเร่งด่วนวันนี้',   'แสดง Top เคสเร่งด่วนวันนี้ — COD ค้าง, พัสดุตีกลับ, ปัญหาที่พบบ่อย',                                 6)
ON CONFLICT DO NOTHING;
