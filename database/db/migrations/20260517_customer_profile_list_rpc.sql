-- Customer profile list — server-side aggregation + pagination
--
-- เดิม API /admin/customer-profile/list ดึง public.customers (~3 row LINE-registered)
-- แล้วเอามานับโดยสแกน jt_shipments หลายพันแถวใน Node.js — ช้า และไม่เห็นผู้ส่งที่
-- ไม่เคย register ผ่าน LINE (ส่วนใหญ่)
--
-- ทดแทนด้วย RPC ที่ aggregate ตรงจาก jt_shipments แล้ว paginate/search ใน SQL:
--   1) เห็นผู้ส่งทุกคน (รวม non-LINE) — แก้ปัญหา VIP ขึ้นแค่ 1 คน
--   2) เร็วขึ้นมาก — group/window ใน Postgres + index
--
-- Indexes:
--   - sender_name (case-insensitive) สำหรับ group / search
--   - vip_code partial index สำหรับแยก VIP/general
create index if not exists jt_shipments_sender_name_lower_idx
    on public.jt_shipments (lower(trim(sender_name)));

create index if not exists jt_shipments_vip_code_partial_idx
    on public.jt_shipments (vip_code)
    where vip_code is not null
      and trim(vip_code) <> ''
      and upper(trim(vip_code)) <> 'NULL';

create or replace function public.list_customer_profiles(
    p_search text default null,
    p_tab    text default 'vip',
    p_limit  int  default 20,
    p_offset int  default 0
)
returns table (
    sender_key      text,
    display_name    text,
    sender_phone    text,
    vip_code        text,
    shipment_count  bigint,
    total_count     bigint
)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
    v_tab text := coalesce(lower(p_tab), 'vip');
    v_search text := nullif(trim(coalesce(p_search, '')), '');
    v_search_pat text := case when v_search is null then null else '%' || lower(v_search) || '%' end;
begin
    if v_tab not in ('vip', 'general') then
        v_tab := 'vip';
    end if;

    return query
    with base as (
        select
            lower(trim(s.sender_name))  as sender_key,
            trim(s.sender_name)         as display_name,
            s.sender_phone              as sender_phone,
            s.vip_code                  as vip_code,
            s.booking_date              as booking_date
        from public.jt_shipments s
        where s.sender_name is not null
          and trim(s.sender_name) <> ''
    ),
    -- vip_code ล่าสุดที่ไม่ว่าง ต่อ sender 1 คน
    vip_latest as (
        select distinct on (sender_key)
            sender_key,
            vip_code
        from base
        where vip_code is not null
          and trim(vip_code) <> ''
          and upper(trim(vip_code)) <> 'NULL'
        order by sender_key, booking_date desc nulls last
    ),
    -- count + เลือก display_name, sender_phone ตัวแทน
    agg as (
        select
            b.sender_key,
            max(b.display_name)                     as display_name,
            (array_agg(b.sender_phone) filter (
                where b.sender_phone is not null
                  and trim(b.sender_phone) <> ''
            ))[1]                                    as sender_phone,
            count(*)                                 as shipment_count
        from base b
        group by b.sender_key
    ),
    combined as (
        select
            a.sender_key,
            a.display_name,
            a.sender_phone,
            v.vip_code,
            a.shipment_count
        from agg a
        left join vip_latest v on v.sender_key = a.sender_key
    ),
    filtered as (
        select *
        from combined c
        where (
            case
                when v_tab = 'vip' then c.vip_code is not null
                else c.vip_code is null
            end
        )
        and (
            v_search_pat is null
            or c.sender_key like v_search_pat
            or lower(coalesce(c.sender_phone, '')) like v_search_pat
            or lower(coalesce(c.vip_code, ''))     like v_search_pat
        )
    ),
    counted as (
        select
            f.*,
            count(*) over () as total_count
        from filtered f
    )
    select
        c.sender_key,
        c.display_name,
        c.sender_phone,
        c.vip_code,
        c.shipment_count,
        c.total_count
    from counted c
    order by c.shipment_count desc, c.display_name asc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0);
end;
$$;

comment on function public.list_customer_profiles(text, text, int, int) is
    'หน้า list /admin/customer-profile — aggregate ผู้ส่งจาก jt_shipments แยก VIP/general, search + paginate ใน SQL';
