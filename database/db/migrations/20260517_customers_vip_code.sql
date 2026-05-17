-- Add vip_code to public.customers
--
-- VIP code "ของจริง" อยู่ใน jt_shipments.vip_code (มาจาก J&T VIP API ตอนคีย์พัสดุ)
-- การคัดลอกมาไว้ที่ customers ทำให้:
--   1) แยก VIP / ทั่วไป ได้โดยไม่ต้อง join jt_shipments ทุกครั้ง (หน้า /admin/customer-profile)
--   2) ผูก vip_code กับลูกค้าทั้งคน ไม่ใช่กับพัสดุชิ้นเดียว
--
-- Backfill หา vip_code ล่าสุดที่ไม่ว่างจาก jt_shipments — จับคู่ด้วย sender_phone ก่อน
-- (เลขมือถือเชื่อถือได้กว่า) แล้ว fallback ไป sender_name (case-insensitive).

alter table public.customers
    add column if not exists vip_code text;

create index if not exists customers_vip_code_idx
    on public.customers (vip_code)
    where vip_code is not null;

with shipment_vip as (
    select
        trim(sender_phone)       as sender_phone_norm,
        lower(trim(sender_name)) as sender_name_norm,
        vip_code,
        booking_date
    from public.jt_shipments
    where vip_code is not null
      and trim(vip_code) <> ''
      and upper(trim(vip_code)) <> 'NULL'
),
match_by_phone as (
    select distinct on (sender_phone_norm)
        sender_phone_norm,
        vip_code
    from shipment_vip
    where sender_phone_norm <> ''
    order by sender_phone_norm, booking_date desc
),
match_by_name as (
    select distinct on (sender_name_norm)
        sender_name_norm,
        vip_code
    from shipment_vip
    where sender_name_norm <> ''
    order by sender_name_norm, booking_date desc
),
backfill as (
    select
        c.id,
        coalesce(p.vip_code, n.vip_code) as vip_code
    from public.customers c
    left join match_by_phone p on p.sender_phone_norm = trim(c.phone)
    left join match_by_name  n on n.sender_name_norm  = lower(trim(c.name))
    where c.vip_code is null or trim(c.vip_code) = ''
)
update public.customers c
   set vip_code = b.vip_code
  from backfill b
 where c.id = b.id
   and b.vip_code is not null;

comment on column public.customers.vip_code is
    'J&T VIP code — backfilled from jt_shipments.vip_code (latest non-empty match by phone, fallback by sender_name). See migration 20260517_customers_vip_code.sql.';
