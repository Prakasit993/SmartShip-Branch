-- Customer-profile RPC v3 — align business rules กับ dashboard
--
-- Changes vs 20260518 (financial snapshot version):
--   1. is_closed: signed_time → signer_name (ตรงกับ dashboard logic)
--   2. has_issue: issue_status → return_type (literal 'พัสดุมีปัญหา' etc.)
--   3. SLA: pendingWithinNDays (overlap) → overdueOverNDays (>3, >7 — subset)
--   4. REMOVED: shipments[] / shipments_total / shipments_truncated
--      (UI ไม่ใช้แล้ว — ลบเพื่อลด payload ~50 KB ต่อ request)
--   5. NEW: weight anomaly detection — จับเคส gateway ปรับน้ำหนัก/ปริมาตรสูงเกิน admin คีย์
--      formula: admin_billable = GREATEST(order_weight, w*l*h/6000)
--               gateway_billable = GREATEST(gateway_weight, gw*gl*gh/6000)
--               FLAG if admin > 0 AND gateway > admin*2.5 AND diff > 1 kg
--
-- เคสจริงที่ flag ได้: AWB 829327726194 (admin คีย์ 1 กก. → gateway ปรับเป็น 36.5 กก. → ต้นทุน 14 → 300 บาท)
--
-- JSON response shape (changes):
--   kpi.pendingWithin3Days  → kpi.overdueOver3Days
--   kpi.pendingWithin7Days  → kpi.overdueOver7Days
--   shipments / shipments_total / shipments_truncated — REMOVED
--   weight.anomalyCount     (NEW: number)
--   weight.anomalyShipments (NEW: array of {awb_number, booking_date, admin_billable, gateway_billable, ratio, diff_kg})

create or replace function public.get_customer_profile_summary(
    p_sender_name text
)
returns jsonb
language plpgsql
stable
as $$
declare
    v_needle text := lower(trim(coalesce(p_sender_name, '')));
    v_today  date := (now() at time zone 'utc')::date;
    v_result jsonb;
    v_kpi jsonb;
    v_weight jsonb;
    v_cod jsonb;
    v_range jsonb;
    v_financial jsonb;
    v_latest_vip text;
    v_snapshot_refreshed_at timestamptz;
begin
    if v_needle = '' then
        return jsonb_build_object(
            'kpi', jsonb_build_object('total',0,'closed',0,'overdueOver3Days',0,'overdueOver7Days',0,'withIssue',0),
            'weight', jsonb_build_object(
                'samples', jsonb_build_object('billed',0,'order',0,'gateway',0),
                'sum',     jsonb_build_object('billed',0,'order',0,'gateway',0),
                'avg',     jsonb_build_object('billed',0,'order',0,'gateway',0),
                'adjustedCount', 0,
                'anomalyCount', 0,
                'anomalyShipments', '[]'::jsonb
            ),
            'cod', jsonb_build_object('totalAmount',0,'paidCount',0,'paidAmount',0,'pendingCount',0,'pendingAmount',0,'noCollectionCount',0),
            'date_range', null,
            'financial', null,
            'financial_refreshed_at', null,
            'latest_vip_code', null
        );
    end if;

    with matched as (
        select
            s.awb_number,
            s.booking_date,
            s.signer_name,
            s.signed_time,
            s.issue_status,
            s.return_type,
            s.exception_reason,
            s.issue_registered_time,
            s.return_branch_name,
            s.return_branch_code,
            s.latest_scan_type,
            s.latest_scan_time,
            s.billed_weight,
            s.order_weight,
            s.gateway_weight,
            s.width,
            s.length,
            s.total_height,
            s.gateway_width,
            s.gateway_length,
            s.gateway_height,
            s.cod_amount,
            s.cod_status,
            s.cod_payment_time,
            s.vip_code,
            coalesce(public.jt_numeric_text(s.billed_weight::text),  0) as w_billed,
            coalesce(public.jt_numeric_text(s.order_weight::text),   0) as w_order,
            coalesce(public.jt_numeric_text(s.gateway_weight::text), 0) as w_gateway,
            -- admin billable = GREATEST(order_weight, admin_volumetric)
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
            -- gateway billable = GREATEST(gateway_weight, gateway_volumetric)
            greatest(
                coalesce(public.jt_numeric_text(s.gateway_weight::text), 0),
                coalesce(
                    public.jt_numeric_text(s.gateway_width::text)
                    * public.jt_numeric_text(s.gateway_length::text)
                    * public.jt_numeric_text(s.gateway_height::text)
                    / 6000.0,
                    0
                )
            ) as gateway_billable,
            coalesce(public.jt_numeric_text(s.cod_amount::text),     0) as cod_amt,
            case
                when substring(coalesce(s.booking_date::text, '') from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
                    then substring(s.booking_date::text from 1 for 10)::date
                else null
            end as booking_d,
            -- ✏ CHANGE: ใช้ signer_name (ตรงกับ dashboard) แทน signed_time
            (s.signer_name is not null
             and trim(s.signer_name::text) <> ''
             and upper(trim(s.signer_name::text)) <> 'NULL') as is_closed,
            -- ✏ CHANGE: ใช้ return_type literal แทน issue_status
            (s.return_type is not null
             and trim(s.return_type::text) <> ''
             and upper(trim(s.return_type::text)) not in ('EMPTY', 'NULL', '-')) as has_issue,
            lower(coalesce(s.cod_status::text, '')) as cod_status_l,
            (s.cod_payment_time is not null
             and trim(s.cod_payment_time::text) <> ''
             and upper(trim(s.cod_payment_time::text)) <> 'NULL'
             and trim(s.cod_payment_time::text) <> '-') as cod_paid_time
        from public.jt_shipments s
        where lower(trim(s.sender_name)) = v_needle
    ),
    -- ✏ CHANGE: SLA overdue (>N days) แทน within (≤N days)
    kpi_agg as (
        select
            count(*)::bigint as total,
            count(*) filter (where is_closed)::bigint as closed,
            count(*) filter (
                where not is_closed
                  and booking_d is not null
                  and (v_today - booking_d) > 3
            )::bigint as overdue_3,
            count(*) filter (
                where not is_closed
                  and booking_d is not null
                  and (v_today - booking_d) > 7
            )::bigint as overdue_7,
            count(*) filter (where has_issue)::bigint as with_issue
        from matched
    ),
    weight_agg as (
        select
            count(*) filter (where w_billed  > 0)::bigint as n_billed,
            count(*) filter (where w_order   > 0)::bigint as n_order,
            count(*) filter (where w_gateway > 0)::bigint as n_gateway,
            coalesce(sum(w_billed)  filter (where w_billed  > 0), 0)::numeric as sum_billed,
            coalesce(sum(w_order)   filter (where w_order   > 0), 0)::numeric as sum_order,
            coalesce(sum(w_gateway) filter (where w_gateway > 0), 0)::numeric as sum_gateway,
            count(*) filter (
                where (w_billed > 0 and w_order   > 0 and abs(w_billed - w_order)   > 0.01)
                   or (w_billed > 0 and w_gateway > 0 and abs(w_billed - w_gateway) > 0.01)
            )::bigint as adjusted,
            -- ✏ NEW: weight anomaly count (gateway ปรับเกิน admin)
            count(*) filter (
                where admin_billable > 0
                  and gateway_billable > admin_billable * 2.5
                  and gateway_billable - admin_billable > 1.0
            )::bigint as anomaly_cnt
        from matched
    ),
    -- ✏ NEW: list anomaly shipments (top 50 ordered by ratio desc)
    anomaly_list as (
        select
            awb_number,
            booking_date,
            round(admin_billable::numeric, 2) as admin_billable,
            round(gateway_billable::numeric, 2) as gateway_billable,
            round((gateway_billable / nullif(admin_billable, 0))::numeric, 2) as ratio,
            round((gateway_billable - admin_billable)::numeric, 2) as diff_kg
        from matched
        where admin_billable > 0
          and gateway_billable > admin_billable * 2.5
          and gateway_billable - admin_billable > 1.0
        order by (gateway_billable / nullif(admin_billable, 0)) desc nulls last
        limit 50
    ),
    anomaly_json as (
        select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) as data
        from anomaly_list a
    ),
    cod_agg as (
        select
            coalesce(sum(cod_amt) filter (where cod_amt > 0), 0)::numeric as total_amount,
            count(*) filter (
                where cod_amt > 0
                  and (cod_status_l like '%no collection%' or cod_status_l like '%ไม่เก็บ%' or cod_status_l like '%ไม่มี%')
            )::bigint as no_collect,
            count(*) filter (
                where cod_amt > 0
                  and not (cod_status_l like '%no collection%' or cod_status_l like '%ไม่เก็บ%' or cod_status_l like '%ไม่มี%')
                  and (cod_status_l like '%paid%' or cod_status_l like '%จ่ายแล้ว%'
                       or cod_status_l like '%สำเร็จ%' or cod_status_l like '%success%'
                       or cod_paid_time)
            )::bigint as paid_count,
            coalesce(sum(cod_amt) filter (
                where cod_amt > 0
                  and not (cod_status_l like '%no collection%' or cod_status_l like '%ไม่เก็บ%' or cod_status_l like '%ไม่มี%')
                  and (cod_status_l like '%paid%' or cod_status_l like '%จ่ายแล้ว%'
                       or cod_status_l like '%สำเร็จ%' or cod_status_l like '%success%'
                       or cod_paid_time)
            ), 0)::numeric as paid_amount,
            count(*) filter (
                where cod_amt > 0
                  and not (cod_status_l like '%no collection%' or cod_status_l like '%ไม่เก็บ%' or cod_status_l like '%ไม่มี%')
                  and not (cod_status_l like '%paid%' or cod_status_l like '%จ่ายแล้ว%'
                           or cod_status_l like '%สำเร็จ%' or cod_status_l like '%success%'
                           or cod_paid_time)
            )::bigint as pending_count,
            coalesce(sum(cod_amt) filter (
                where cod_amt > 0
                  and not (cod_status_l like '%no collection%' or cod_status_l like '%ไม่เก็บ%' or cod_status_l like '%ไม่มี%')
                  and not (cod_status_l like '%paid%' or cod_status_l like '%จ่ายแล้ว%'
                           or cod_status_l like '%สำเร็จ%' or cod_status_l like '%success%'
                           or cod_paid_time)
            ), 0)::numeric as pending_amount
        from matched
    ),
    range_agg as (
        select min(booking_d) as d_min, max(booking_d) as d_max from matched
    ),
    latest_vip as (
        select vip_code
        from matched
        where vip_code is not null
          and trim(vip_code::text) <> ''
          and upper(trim(vip_code::text)) <> 'NULL'
          and trim(vip_code::text) <> '-'
        order by booking_date desc nulls last
        limit 1
    )
    select
        jsonb_build_object(
            'total',              k.total,
            'closed',             k.closed,
            'overdueOver3Days',   k.overdue_3,
            'overdueOver7Days',   k.overdue_7,
            'withIssue',          k.with_issue
        ),
        jsonb_build_object(
            'samples', jsonb_build_object('billed', w.n_billed, 'order', w.n_order, 'gateway', w.n_gateway),
            'sum',     jsonb_build_object(
                'billed',  round(w.sum_billed::numeric,  2),
                'order',   round(w.sum_order::numeric,   2),
                'gateway', round(w.sum_gateway::numeric, 2)
            ),
            'avg', jsonb_build_object(
                'billed',  case when w.n_billed  > 0 then round((w.sum_billed  / w.n_billed)::numeric,  2) else 0 end,
                'order',   case when w.n_order   > 0 then round((w.sum_order   / w.n_order)::numeric,   2) else 0 end,
                'gateway', case when w.n_gateway > 0 then round((w.sum_gateway / w.n_gateway)::numeric, 2) else 0 end
            ),
            'adjustedCount',    w.adjusted,
            'anomalyCount',     w.anomaly_cnt,
            'anomalyShipments', aj.data
        ),
        jsonb_build_object(
            'totalAmount',       round(c.total_amount::numeric,   2),
            'paidCount',         c.paid_count,
            'paidAmount',        round(c.paid_amount::numeric,    2),
            'pendingCount',      c.pending_count,
            'pendingAmount',     round(c.pending_amount::numeric, 2),
            'noCollectionCount', c.no_collect
        ),
        case when rg.d_min is not null and rg.d_max is not null
            then jsonb_build_object('from', rg.d_min::text, 'to', rg.d_max::text)
            else null
        end,
        (select vip_code from latest_vip)
    into
        v_kpi, v_weight, v_cod, v_range, v_latest_vip
    from kpi_agg k, weight_agg w, cod_agg c, range_agg rg, anomaly_json aj;

    -- Financial: ดึงจาก snapshot (lookup ที่ primary key — เร็ว <5ms)
    select
        jsonb_build_object(
            'customer_name',           s.customer_name,
            'shipment_count',          s.shipment_count,
            'total_revenue',           s.total_revenue,
            'total_cost',              s.total_cost,
            'total_profit',            s.total_profit,
            'avg_profit_per_shipment', s.avg_profit_per_shipment
        ),
        s.refreshed_at
    into v_financial, v_snapshot_refreshed_at
    from public.customer_financial_snapshot s
    where s.sender_key = v_needle;

    v_result := jsonb_build_object(
        'kpi',                    v_kpi,
        'weight',                 v_weight,
        'cod',                    v_cod,
        'date_range',             v_range,
        'financial',              v_financial,
        'financial_refreshed_at', v_snapshot_refreshed_at,
        'latest_vip_code',        v_latest_vip
    );

    return v_result;
end;
$$;

revoke all on function public.get_customer_profile_summary(text) from public;
grant execute on function public.get_customer_profile_summary(text) to service_role;

comment on function public.get_customer_profile_summary(text) is
    'v3 — aligned with dashboard rules: signer_name (closed), return_type (issue), SLA overdue >3/>7, weight anomaly detection';
