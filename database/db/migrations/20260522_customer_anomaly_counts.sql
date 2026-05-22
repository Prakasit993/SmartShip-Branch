-- Per-sender weight-anomaly counts for the customer-profile LIST page.
--
-- ฟังก์ชันแยก (ไม่แตะ list_customer_profiles) — รับ array ชื่อผู้ส่งของหน้าปัจจุบัน
-- แล้วคืนจำนวนพัสดุ "น้ำหนักผิดปกติ" ต่อผู้ส่ง:
--   gateway_billable > admin_billable * 2.5  AND  ห่าง > 1 กก.  (สูตรเดียวกับ
--   get_customer_profile_summary). คิดจากทุก shipment ของผู้ส่งนั้น (แม่นกว่า JS-tally).
--
-- ใช้ language sql (ไม่ใช่ plpgsql) → ไม่มีปัญหา variable_conflict.

create or replace function public.customer_anomaly_counts(p_sender_names text[])
returns table (
    sender_key    text,
    anomaly_count bigint
)
language sql
stable
as $$
    with needles as (
        select distinct lower(trim(x)) as nk
        from unnest(coalesce(p_sender_names, array[]::text[])) x
        where trim(x) <> ''
    ),
    rows_w as (
        select
            lower(trim(s.sender_name)) as sk,
            greatest(
                coalesce(public.jt_numeric_text(s.order_weight::text), 0),
                coalesce(
                    public.jt_numeric_text(s.width::text)
                    * public.jt_numeric_text(s.length::text)
                    * public.jt_numeric_text(s.total_height::text)
                    / 6000.0,
                    0
                )
            ) as admin_billable,
            greatest(
                coalesce(public.jt_numeric_text(s.gateway_weight::text), 0),
                coalesce(
                    public.jt_numeric_text(s.gateway_width::text)
                    * public.jt_numeric_text(s.gateway_length::text)
                    * public.jt_numeric_text(s.gateway_height::text)
                    / 6000.0,
                    0
                )
            ) as gateway_billable
        from public.jt_shipments s
        join needles n on n.nk = lower(trim(s.sender_name))
    )
    select
        rows_w.sk as sender_key,
        count(*) filter (
            where rows_w.admin_billable > 0
              and rows_w.gateway_billable > rows_w.admin_billable * 2.5
              and rows_w.gateway_billable - rows_w.admin_billable > 1.0
        )::bigint as anomaly_count
    from rows_w
    group by rows_w.sk;
$$;

revoke all on function public.customer_anomaly_counts(text[]) from public;
grant execute on function public.customer_anomaly_counts(text[]) to service_role;

comment on function public.customer_anomaly_counts(text[]) is
    'list page — จำนวนพัสดุน้ำหนักผิดปกติ (gateway ปรับ > 2.5× admin) ต่อผู้ส่ง สำหรับ badge แจ้งเตือน';
