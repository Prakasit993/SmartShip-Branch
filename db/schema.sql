-- db/schema.sql
-- Initial database schema for SmartShip Branch Assistant (PostgreSQL / Supabase)

-- ใช้ฟังก์ชัน gen_random_uuid() (Supabase เปิดให้แล้ว แต่ใส่กันเหนียว)
create extension if not exists "pgcrypto";

------------------------------------------------------------
-- 1) branches – ข้อมูลสาขา (ใช้ล็อกที่อยู่ผู้ส่ง)
------------------------------------------------------------
create table if not exists public.branches (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- รหัสสาขา เช่น BR001
  name          text not null,                 -- ชื่อสาขา
  address_line  text,                          -- บ้านเลขที่ / ถนน / หมู่บ้าน ฯลฯ
  district      text,
  province      text,
  postal_code   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

------------------------------------------------------------
-- 2) customers – ลูกค้าผู้ส่ง / ลูกค้าประจำ
------------------------------------------------------------
create table if not exists public.customers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  phone                 text not null,           -- แนะนำให้ unique
  vip_code              text,                    -- VIP code จาก J&T (ถ้ามี)
  line_user_id          text,                    -- สำหรับเชื่อม LINE (อนาคต)
  default_address_line  text,
  default_district      text,
  default_province      text,
  default_postal_code   text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint customers_phone_unique unique (phone)
);

------------------------------------------------------------
-- 3) shipments – รายการพัสดุ 1 ชิ้น
------------------------------------------------------------
create table if not exists public.shipments (
  id                           uuid primary key default gen_random_uuid(),

  -- ความสัมพันธ์
  branch_id                    uuid not null references public.branches (id) on delete restrict,
  customer_id                  uuid references public.customers (id) on delete set null,

  -- ข้อมูลผู้ส่ง (ปกติ = ที่อยู่สาขา)
  sender_name                  text not null,
  sender_phone                 text not null,
  sender_address_line          text not null,
  sender_district              text not null,
  sender_province              text not null,
  sender_postal_code           text not null,

  -- ข้อมูลผู้รับ
  receiver_name                text not null,
  receiver_phone               text not null,
  receiver_address_line        text not null,
  receiver_subdistrict         text not null,
  receiver_district            text not null,
  receiver_province            text not null,
  receiver_postal_code         text not null,

  -- ข้อมูลเสริม
  vip_code                     text,             -- duplicate จาก customer เพื่อ embed ลง QR ง่าย
  service_type                 text,             -- ธรรมดา / ด่วน ฯลฯ
  cod_amount                   numeric(12,2),
  weight_kg                    numeric(8,3),

  -- สถานะ และคุณภาพข้อมูล
  status                       text not null default 'draft',
  address_validated            boolean not null default false,
  address_needs_staff_review   boolean not null default false,

  -- เชื่อมกับ J&T
  jt_consignment_no            text,            -- เลข Tracking จาก J&T (ถ้ามี)

  -- เวลา/ผู้รับผิดชอบ
  created_at                   timestamptz not null default now(),
  confirmed_at                 timestamptz,
  confirmed_by                 text,

  constraint shipments_status_check
    check (status in ('draft', 'pending_staff_review', 'confirmed', 'sent_to_jt', 'cancelled'))
);

create index if not exists idx_shipments_branch_created
  on public.shipments (branch_id, created_at);

create index if not exists idx_shipments_status
  on public.shipments (status);

------------------------------------------------------------
-- 4) branch_daily_report – สรุปยอดรายวันของแต่ละสาขา
------------------------------------------------------------
create table if not exists public.branch_daily_report (
  id                     uuid primary key default gen_random_uuid(),
  branch_id              uuid not null references public.branches (id) on delete cascade,
  report_date            date not null,
  total_shipments        integer not null default 0,
  total_revenue          numeric(14,2),
  total_cod_amount       numeric(14,2),
  top_destination_province text,
  raw_stats_json         jsonb,            -- เก็บ breakdown รายละเอียด
  summary_text           text,             -- ข้อความสรุปจาก AI
  created_at             timestamptz not null default now(),

  constraint branch_daily_report_unique_per_day
    unique (branch_id, report_date)
);

create index if not exists idx_branch_daily_report_branch_date
  on public.branch_daily_report (branch_id, report_date desc);

------------------------------------------------------------
-- 5) thai_locations – reference table จังหวัด/อำเภอ/ตำบล/รหัสไปรษณีย์
------------------------------------------------------------
create table if not exists public.thai_locations (
  id                uuid primary key default gen_random_uuid(),
  province_code     text,
  province_name     text not null,
  district_code     text,
  district_name     text not null,
  subdistrict_code  text,
  subdistrict_name  text not null,
  postal_code       text not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_thai_locations_postal_code
  on public.thai_locations (postal_code);

create index if not exists idx_thai_locations_pd
  on public.thai_locations (province_name, district_name, subdistrict_name);

------------------------------------------------------------
-- 6) audit_log – เก็บ audit trail ว่าใครทำอะไรกับ entity ไหน
------------------------------------------------------------
create table if not exists public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null,              -- 'shipment', 'customer', etc.
  entity_id      uuid not null,
  action         text not null,              -- 'create', 'update', 'delete', 'status_change'
  branch_id      uuid references public.branches (id) on delete set null,
  performed_by   text,                       -- ชื่อ/รหัส staff หรือ system
  performed_at   timestamptz not null default now(),
  changes        jsonb                       -- เก็บ diff หรือรายละเอียดการเปลี่ยนแปลง (ถ้าใช้)
);

create index if not exists idx_audit_log_entity
  on public.audit_log (entity_type, entity_id);

create index if not exists idx_audit_log_branch_time
  on public.audit_log (branch_id, performed_at desc);

------------------------------------------------------------
-- 7) ตัวอย่าง seed ข้อมูลสาขา (ปรับตามของจริง)
------------------------------------------------------------
-- ตัวอย่าง: สาขาธัญบุรี
-- insert into public.branches (code, name, address_line, district, province, postal_code)
-- values ('BR001', 'สาขาธัญบุรี', '123/4 หมู่ 5 ถนนตัวอย่าง ตำบลลำผักกูด', 'ธัญบุรี', 'ปทุมธานี', '12110');
