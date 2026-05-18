-- Admin-editable contact override for customer profiles
--
-- เดิม name/phone บนหน้า detail มาจาก jt_shipments.sender_name/sender_phone ตรง ๆ
-- ลูกค้าเปลี่ยนเบอร์ → ระบบไม่รู้, แอดมินอยากบันทึก nickname/note → ไม่มีที่เก็บ
--
-- Architecture: ขยาย customers table (มี vip_code อยู่แล้วจาก
-- 20260517_customers_vip_code.sql) — ใช้ sender_key (= lower(trim(name))) เป็น
-- key สำหรับลูกค้า sender-only (ไม่ได้ register LINE)
--
-- Audit: ทุกการเปลี่ยน override_* / admin_notes บันทึกใน customer_contact_history
-- เพื่อ trace ว่าใครแก้อะไรเมื่อไหร่

alter table public.customers
    add column if not exists sender_key      text,
    add column if not exists override_phone  text,
    add column if not exists override_name   text,
    add column if not exists admin_notes     text,
    add column if not exists updated_by      text,
    add column if not exists updated_at      timestamptz;

-- backfill sender_key สำหรับ row ที่มี name อยู่แล้ว
update public.customers
   set sender_key = lower(trim(name))
 where sender_key is null
   and name is not null
   and trim(name) <> '';

-- unique บน sender_key เฉพาะ row ที่ไม่มี line_user_id
-- (LINE-registered ใช้ line_user_id เป็น identifier — ไม่ต้อง unique บน sender_key)
create unique index if not exists customers_sender_key_unique
    on public.customers (sender_key)
    where line_user_id is null and sender_key is not null;

create index if not exists customers_sender_key_idx
    on public.customers (sender_key)
    where sender_key is not null;

comment on column public.customers.sender_key is
    'Normalized sender_name (lower+trim) — ใช้ match กับ jt_shipments.sender_name สำหรับลูกค้าที่ไม่ได้ register LINE';
comment on column public.customers.override_phone is
    'เบอร์ที่แอดมินบันทึก override เบอร์จาก jt_shipments.sender_phone';
comment on column public.customers.override_name is
    'ชื่อ/nickname ที่แอดมินบันทึก override ชื่อจาก jt_shipments.sender_name';
comment on column public.customers.admin_notes is
    'หมายเหตุภายในของแอดมิน — แสดงเฉพาะ role admin';

-- History table — เก็บทุกการเปลี่ยนแปลง override_* / admin_notes
create table if not exists public.customer_contact_history (
    id            bigserial primary key,
    customer_id   uuid not null references public.customers(id) on delete cascade,
    changed_field text not null check (changed_field in ('override_phone', 'override_name', 'admin_notes')),
    old_value     text,
    new_value     text,
    changed_by    text not null,
    changed_at    timestamptz not null default now()
);

create index if not exists customer_contact_history_customer_idx
    on public.customer_contact_history (customer_id, changed_at desc);

comment on table public.customer_contact_history is
    'Audit log สำหรับ override_phone / override_name / admin_notes ของ customers — INSERT-only';

-- RPC: upsert override + log history atomically
-- เรียกจาก PATCH /api/admin/customer-profile/[id] route
create or replace function public.upsert_customer_contact_override(
    p_customer_id    uuid,           -- ถ้ามี row แล้ว
    p_sender_key     text,           -- ถ้ายังไม่มี — สร้างใหม่
    p_sender_name    text,           -- ใช้ตอน insert
    p_override_phone text,           -- null = ไม่เปลี่ยน, '' = เคลียร์
    p_override_name  text,
    p_admin_notes    text,
    p_changed_by     text,           -- admin email
    p_clear_phone    boolean default false,
    p_clear_name     boolean default false,
    p_clear_notes    boolean default false
)
returns jsonb
language plpgsql
as $$
declare
    v_customer_id uuid;
    v_now timestamptz := now();
    v_old record;
    v_new_phone text;
    v_new_name  text;
    v_new_notes text;
begin
    if p_changed_by is null or trim(p_changed_by) = '' then
        raise exception 'p_changed_by is required';
    end if;

    -- หา row เดิม
    if p_customer_id is not null then
        select id, override_phone, override_name, admin_notes
          into v_old
          from public.customers
         where id = p_customer_id;
    elsif p_sender_key is not null and trim(p_sender_key) <> '' then
        select id, override_phone, override_name, admin_notes
          into v_old
          from public.customers
         where sender_key = lower(trim(p_sender_key))
           and line_user_id is null;
    end if;

    if v_old.id is null then
        -- insert ใหม่สำหรับ sender-only profile
        if p_sender_key is null or trim(p_sender_key) = '' then
            raise exception 'sender_key required for new customer row';
        end if;
        insert into public.customers (
            sender_key, name, override_phone, override_name, admin_notes,
            updated_by, updated_at, created_at
        ) values (
            lower(trim(p_sender_key)),
            coalesce(p_sender_name, p_sender_key),
            case when p_clear_phone then null else nullif(trim(coalesce(p_override_phone, '')), '') end,
            case when p_clear_name  then null else nullif(trim(coalesce(p_override_name,  '')), '') end,
            case when p_clear_notes then null else nullif(trim(coalesce(p_admin_notes,    '')), '') end,
            p_changed_by, v_now, v_now
        )
        returning id into v_customer_id;
        v_old.override_phone := null;
        v_old.override_name  := null;
        v_old.admin_notes    := null;
    else
        v_customer_id := v_old.id;
        v_new_phone := case when p_clear_phone then null
                            when p_override_phone is null then v_old.override_phone
                            else nullif(trim(p_override_phone), '') end;
        v_new_name  := case when p_clear_name then null
                            when p_override_name is null then v_old.override_name
                            else nullif(trim(p_override_name), '') end;
        v_new_notes := case when p_clear_notes then null
                            when p_admin_notes is null then v_old.admin_notes
                            else nullif(trim(p_admin_notes), '') end;

        update public.customers
           set override_phone = v_new_phone,
               override_name  = v_new_name,
               admin_notes    = v_new_notes,
               updated_by     = p_changed_by,
               updated_at     = v_now
         where id = v_customer_id;
    end if;

    -- log history เฉพาะ field ที่เปลี่ยนจริง
    if p_clear_phone or (p_override_phone is not null and coalesce(v_old.override_phone, '') is distinct from coalesce(nullif(trim(p_override_phone), ''), '')) then
        insert into public.customer_contact_history (customer_id, changed_field, old_value, new_value, changed_by, changed_at)
        values (v_customer_id, 'override_phone', v_old.override_phone,
                case when p_clear_phone then null else nullif(trim(p_override_phone), '') end,
                p_changed_by, v_now);
    end if;
    if p_clear_name or (p_override_name is not null and coalesce(v_old.override_name, '') is distinct from coalesce(nullif(trim(p_override_name), ''), '')) then
        insert into public.customer_contact_history (customer_id, changed_field, old_value, new_value, changed_by, changed_at)
        values (v_customer_id, 'override_name', v_old.override_name,
                case when p_clear_name then null else nullif(trim(p_override_name), '') end,
                p_changed_by, v_now);
    end if;
    if p_clear_notes or (p_admin_notes is not null and coalesce(v_old.admin_notes, '') is distinct from coalesce(nullif(trim(p_admin_notes), ''), '')) then
        insert into public.customer_contact_history (customer_id, changed_field, old_value, new_value, changed_by, changed_at)
        values (v_customer_id, 'admin_notes', v_old.admin_notes,
                case when p_clear_notes then null else nullif(trim(p_admin_notes), '') end,
                p_changed_by, v_now);
    end if;

    return jsonb_build_object(
        'customer_id', v_customer_id,
        'updated_at',  v_now,
        'updated_by',  p_changed_by
    );
end;
$$;

revoke all on function public.upsert_customer_contact_override(uuid, text, text, text, text, text, text, boolean, boolean, boolean) from public;
grant execute on function public.upsert_customer_contact_override(uuid, text, text, text, text, text, text, boolean, boolean, boolean) to service_role;
