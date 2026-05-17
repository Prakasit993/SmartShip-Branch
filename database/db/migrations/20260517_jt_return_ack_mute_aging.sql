-- Add mute_aging flag to acknowledgements.
--   true  = ack ปิดเรื่องแล้ว → ซ่อนจาก aging report (เคลมแล้ว/ส่งคืนแล้ว/ไปส่งแล้ว/สูญหาย)
--   false = ack ไว้เป็น note แต่ยังต้องตามงาน (รอตีกลับมา ฯลฯ)
-- Default true เพราะเคสส่วนใหญ่ของ admin คือปิดเรื่อง (legacy behavior)

alter table public.jt_return_acknowledgements
    add column if not exists mute_aging boolean not null default true;

-- Smart backfill: ถ้า reason สื่อว่า "ยังรอ" ให้ mute_aging=false เพื่อให้ admin ยังเห็นใน aging
update public.jt_return_acknowledgements
   set mute_aging = false
 where mute_aging = true
   and (
        reason ilike '%รอ%'
     or reason ilike '%ยังไม่%'
     or reason ilike '%pending%'
   );

-- Partial index ช่วย aging endpoint lookup เร็ว (active + muted only)
create index if not exists jt_return_acknowledgements_mute_aging_idx
    on public.jt_return_acknowledgements (awb_number)
    where status = 'active' and mute_aging = true;
