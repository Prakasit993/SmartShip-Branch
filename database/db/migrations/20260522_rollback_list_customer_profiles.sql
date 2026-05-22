-- ROLLBACK: restore list_customer_profiles to the 20260517 version
-- (ยกเลิกการเพิ่ม overdue_3 / overdue_7 / anomaly_count — กลับไปคืนแค่
--  sender_key, display_name, sender_phone, vip_code, shipment_count, total_count).
--
-- ต้อง DROP ก่อนเพราะ return columns ต่างจากเวอร์ชันที่เพิ่งรันไป.
-- รันทั้งไฟล์นี้ใน Supabase เพื่อย้อนกลับ.

drop function if exists public.list_customer_profiles(text, text, int, int);

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
-- ชื่อ OUT param (sender_key, vip_code ฯลฯ) ชนกับคอลัมน์ใน base/CTE
-- → ให้ plpgsql เลือกใช้ "คอลัมน์" เมื่อกำกวม (กัน error 42702 ใน vip_latest)
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
