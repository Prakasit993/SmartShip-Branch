-- AI Level 1 — Add NYXEL inventory quick-send shortcuts
-- Date: 2026-05-20
-- Pairs with: 20260520_ai_readonly_grant_nyxel.sql (whitelist expansion)
--
-- Adds chip prompts the admin can one-tap in the AI chat dock for common
-- NYXEL inventory questions. The AI now has SELECT access to products /
-- bundles / categories so these prompts return real answers.
--
-- Idempotent: keyword has no unique constraint but ON CONFLICT DO NOTHING
-- here is a safety guard for re-runs (also skips if existing rows have
-- the same keyword by string match — handled in app-level dedup).

INSERT INTO admin_ai_chat_shortcuts (keyword, prompt, sort_order) VALUES
    ('สต็อกวันนี้',
     'แสดงสินค้า NYXEL ที่ยังเปิดขาย (is_active=true) เรียงตาม stock_quantity น้อยสุดก่อน — ดูว่ามีอะไรใกล้หมดบ้าง พร้อม brand/model/condition',
     10),

    ('สินค้าใกล้หมด',
     'แสดงสินค้าและ bundle ที่ stock_quantity <= 3 และ is_active=true — แสดง id, name, brand, model, stock เพื่อสั่งเติม',
     11),

    ('สรุปตามแบรนด์',
     'สรุปจำนวน bundle ที่ยังเปิดขาย แยกตาม brand พร้อมราคาเฉลี่ย ราคาต่ำสุด ราคาสูงสุด — เพื่อดู portfolio',
     12),

    ('สินค้ามือสอง',
     'แสดง bundle ที่ condition = ''used'' หรือ ''refurbished'' ที่ยังเปิดขาย — รวม warranty_months และ condition_note',
     13),

    ('เพิ่งเข้าใหม่',
     'แสดง bundle 10 รายการล่าสุดที่สร้างใน 7 วันที่ผ่านมา เรียงตาม created_at ใหม่ก่อน',
     14),

    ('หมวดสินค้า',
     'นับจำนวน bundle (is_active=true) ในแต่ละ category — เพื่อดูว่าหมวดไหนสินค้ามาก/น้อย',
     15)
ON CONFLICT DO NOTHING;
