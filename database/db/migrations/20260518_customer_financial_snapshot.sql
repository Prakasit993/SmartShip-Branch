-- Customer financial snapshot — cache the heavy LATERAL-join aggregation
--
-- The financial section in `get_customer_profile_summary` joins 4 reference tables
-- per row (jt_shipping_zone_provinces, jt_cod_fee_rules, jt_shipping_cost_rates,
-- shipping_cost_master) — ใช้เวลา 200-800ms ต่อลูกค้า 1 คน
--
-- Snapshot strategy:
--   1) ตาราง customer_financial_snapshot 1 row ต่อ sender (lookup เร็ว <5ms)
--   2) refresh ผ่าน function ที่ recompute ทั้ง table — เรียก nightly จาก n8n
--   3) get_customer_profile_summary อ่าน financial จาก snapshot แทน compute live
--
-- ใช้ global min/max booking_date เป็น effective-date range ของ fee/cost rules
-- — ข้อจำกัด: rule ที่เพิ่งเริ่ม effective วันนี้อาจจะถูก apply กับพัสดุที่อยู่นอก
-- effective range ของมัน ในทางปฏิบัติยอมรับได้เพราะ rule เปลี่ยนน้อย

create table if not exists public.customer_financial_snapshot (
    sender_key                  text         primary key,
    customer_name               text         not null,
    shipment_count              bigint       not null default 0,
    total_revenue               numeric      not null default 0,
    total_cost                  numeric      not null default 0,
    total_profit                numeric      not null default 0,
    avg_profit_per_shipment     numeric      not null default 0,
    date_from                   date,
    date_to                     date,
    refreshed_at                timestamptz  not null default now()
);

create index if not exists idx_customer_financial_snapshot_refreshed_at
    on public.customer_financial_snapshot (refreshed_at desc);

comment on table public.customer_financial_snapshot is
    'Per-sender financial aggregate (cached). Refresh via public.refresh_customer_financial_snapshot()';

-- ============================================================================
-- ⚠ WARNING: financial calculation นี้ duplicate กับ
-- public.get_financial_customer_breakdown_billable_weight ใน
-- 20260510_jt_financial_customer_breakdown.sql
--
-- ทั้งคู่ใช้ formula เดียวกัน:
--   normalized_shipments → billable_shipments (zone + cod_fee_rules)
--   → priced_shipments (cost_rates + sale_price fallback)
--
-- ทำไมแยก 2 ที่:
--   - top-50 RPC: range-aware (รับ start/end_date) — ใช้กับ dashboard ที่ filter ช่วง
--   - snapshot:   per-customer all-time — ใช้กับ /admin/customer-profile/[id]
-- ไม่สามารถ merge ได้โดยไม่เสียฟีเจอร์ของ dashboard
--
-- 🔧 ถ้าเปลี่ยน formula ต้นทุน (เพิ่ม fee ใหม่, แก้ zone calc, ฯลฯ)
-- ต้องแก้ทั้ง 2 ที่ ไม่งั้นเลขจะไม่ตรงกันระหว่างหน้า dashboard กับ customer profile
--
-- Tech debt: extract shared logic เป็น _compute_billable_cost(start, end) helper
-- ============================================================================

create or replace function public.refresh_customer_financial_snapshot()
returns table (
    rows_upserted bigint,
    took_ms       numeric,
    refreshed_at  timestamptz
)
language plpgsql
as $$
declare
    v_start        timestamptz := clock_timestamp();
    v_now          timestamptz := now();
    v_global_min   date;
    v_global_max   date;
    v_rows         bigint;
begin
    -- หา global date range สำหรับใช้ filter effective_from/effective_to ของ fee/cost rules
    select
        min(substring(booking_date::text from 1 for 10)::date),
        max(substring(booking_date::text from 1 for 10)::date)
    into v_global_min, v_global_max
    from public.jt_shipments
    where substring(booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$';

    if v_global_min is null or v_global_max is null then
        delete from public.customer_financial_snapshot;
        return query select 0::bigint, 0::numeric, v_now;
        return;
    end if;

    -- rebuild: truncate + insert ทั้งชุด (เร็วกว่า upsert เพราะ recompute ทุก sender อยู่แล้ว)
    truncate table public.customer_financial_snapshot;

    with normalized_shipments as (
        select
            lower(trim(j.sender_name))                              as sender_key,
            coalesce(nullif(trim(j.sender_name), ''), 'ไม่ระบุลูกค้า') as customer_name,
            substring(j.booking_date::text from 1 for 10)::date     as booking_d,
            public.jt_numeric_text(j.shipping_fee::text)            as shipping_fee_numeric,
            public.jt_numeric_text(j.total_shipping_fee::text)      as total_shipping_fee_numeric,
            public.jt_clean_province(j.dest_province::text)         as normalized_dest_province,
            coalesce(
                public.jt_numeric_text(j.billed_weight::text),
                public.jt_numeric_text(j.gateway_weight::text),
                public.jt_numeric_text(j.gateway_received_weight::text),
                public.jt_numeric_text(j.received_weight::text),
                public.jt_numeric_text(j.center_weight::text),
                public.jt_numeric_text(j.order_weight::text),
                public.jt_numeric_text(j.avg_weight::text)
            ) as actual_weight_kg,
            coalesce(public.jt_numeric_text(j.gateway_length::text), public.jt_numeric_text(j.received_length::text), public.jt_numeric_text(j.length::text)) as length_cm,
            coalesce(public.jt_numeric_text(j.gateway_width::text),  public.jt_numeric_text(j.received_width::text),  public.jt_numeric_text(j.width::text))  as width_cm,
            coalesce(public.jt_numeric_text(j.gateway_height::text), public.jt_numeric_text(j.received_height::text), public.jt_numeric_text(j.total_height::text)) as height_cm,
            coalesce(
                public.jt_numeric_text(j.gateway_vol_weight::text),
                public.jt_numeric_text(j.total_received_vol_weight::text),
                public.jt_numeric_text(j.total_vol_weight::text),
                public.jt_numeric_text(j.volumetric_weight::text)
            ) as imported_volumetric_weight_kg,
            public.jt_numeric_text(j.remote_area_fee::text) as remote_area_fee_cost,
            public.jt_numeric_text(j.other_fees::text)      as other_fee_cost,
            public.jt_numeric_text(j.insurance_fee::text)   as insurance_fee_cost,
            public.jt_numeric_text(j.return_fee::text)      as return_fee_cost,
            public.jt_numeric_text(j.cod_amount::text)      as cod_amount_numeric
        from public.jt_shipments j
        where j.sender_name is not null
          and trim(j.sender_name) <> ''
          and substring(j.booking_date::text from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
    ),
    billable_shipments as (
        select
            s.sender_key,
            s.customer_name,
            s.booking_d,
            coalesce(s.shipping_fee_numeric, 0) as shipping_fee_numeric,
            coalesce(nullif(s.total_shipping_fee_numeric, 0), s.shipping_fee_numeric, 0) as revenue_numeric,
            z.zone_code,
            nullif(
                greatest(
                    coalesce(s.actual_weight_kg, 0),
                    coalesce(public.jt_normalized_volumetric_weight_kg(
                        s.imported_volumetric_weight_kg, s.length_cm, s.width_cm, s.height_cm
                    ), 0)
                ),
                0
            ) as billable_weight_kg,
            coalesce(s.remote_area_fee_cost, 0) as remote_area_fee_cost,
            coalesce(s.other_fee_cost, 0)      as other_fee_cost,
            coalesce(s.insurance_fee_cost, 0)  as insurance_fee_cost,
            coalesce(s.return_fee_cost, 0)     as return_fee_cost,
            coalesce(cod_fee.cost, 0)          as cod_fee_cost
        from normalized_shipments s
        left join public.jt_shipping_zone_provinces z
          on z.normalized_province_name = s.normalized_dest_province
         and z.is_active is true
        left join lateral (
            select case
                when r.fee_type = 'percent' then coalesce(s.cod_amount_numeric, 0) * r.fee_value / 100
                else r.fee_value
            end as cost
            from public.jt_cod_fee_rules r
            where r.is_active is true
              and coalesce(s.cod_amount_numeric, 0) > 0
              and coalesce(s.cod_amount_numeric, 0) >= r.min_cod_amount
              and (r.max_cod_amount is null or coalesce(s.cod_amount_numeric, 0) <= r.max_cod_amount)
              and (r.effective_from is null or r.effective_from <= v_global_max)
              and (r.effective_to   is null or r.effective_to   >= v_global_min)
            order by r.min_cod_amount desc, r.id asc
            limit 1
        ) cod_fee on true
    ),
    normalized_costs as (
        select
            public.jt_numeric_text(c.sale_price::text) as sale_price_numeric,
            public.jt_numeric_text(c.cost::text)       as cost_numeric
        from public.shipping_cost_master c
        where c.is_active is true
    ),
    priced_shipments as (
        select
            s.sender_key,
            s.customer_name,
            s.booking_d,
            s.revenue_numeric,
            coalesce(weight_cost.cost, sale_price_cost.cost_numeric, 15)
                + s.remote_area_fee_cost
                + s.other_fee_cost
                + s.insurance_fee_cost
                + s.return_fee_cost
                + s.cod_fee_cost as cost_numeric
        from billable_shipments s
        left join lateral (
            select r.cost
            from public.jt_shipping_cost_rates r
            where r.carrier = 'J&T'
              and r.zone_code = s.zone_code
              and r.is_active is true
              and (r.effective_from is null or r.effective_from <= v_global_max)
              and (r.effective_to   is null or r.effective_to   >= v_global_min)
              and s.billable_weight_kg is not null
              and r.max_billable_weight_kg >= s.billable_weight_kg
            order by r.max_billable_weight_kg asc, r.id asc
            limit 1
        ) weight_cost on true
        left join lateral (
            select c.cost_numeric
            from normalized_costs c
            where c.sale_price_numeric = s.shipping_fee_numeric
              and c.cost_numeric is not null
            limit 1
        ) sale_price_cost on true
    )
    insert into public.customer_financial_snapshot (
        sender_key, customer_name, shipment_count,
        total_revenue, total_cost, total_profit, avg_profit_per_shipment,
        date_from, date_to, refreshed_at
    )
    select
        p.sender_key,
        max(p.customer_name) as customer_name,
        count(*) as shipment_count,
        round(coalesce(sum(p.revenue_numeric), 0)::numeric, 2)               as total_revenue,
        round(coalesce(sum(p.cost_numeric), 0)::numeric, 2)                  as total_cost,
        round(coalesce(sum(p.revenue_numeric - p.cost_numeric), 0)::numeric, 2) as total_profit,
        case when count(*) > 0
            then round((coalesce(sum(p.revenue_numeric - p.cost_numeric), 0) / count(*))::numeric, 2)
            else 0
        end as avg_profit_per_shipment,
        min(p.booking_d) as date_from,
        max(p.booking_d) as date_to,
        v_now            as refreshed_at
    from priced_shipments p
    group by p.sender_key;

    get diagnostics v_rows = row_count;

    return query
    select
        v_rows::bigint,
        round(extract(milliseconds from clock_timestamp() - v_start)::numeric, 2),
        v_now;
end;
$$;

revoke all on function public.refresh_customer_financial_snapshot() from public;
grant execute on function public.refresh_customer_financial_snapshot() to service_role;

comment on function public.refresh_customer_financial_snapshot() is
    'Rebuild customer_financial_snapshot for all senders. Call nightly from n8n.';

-- ============================================================================
-- Replace get_customer_profile_summary to read financial from snapshot
-- (เปลี่ยนเฉพาะส่วน financial — KPI/weight/COD/shipments ยังคำนวณ live เหมือนเดิม)
-- ============================================================================

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
    v_shipments jsonb;
    v_total bigint;
    v_truncated boolean;
    v_financial jsonb;
    v_latest_vip text;
    v_snapshot_refreshed_at timestamptz;
begin
    if v_needle = '' then
        return jsonb_build_object(
            'kpi', jsonb_build_object('total',0,'closed',0,'pendingWithin3Days',0,'pendingWithin7Days',0,'withIssue',0),
            'weight', jsonb_build_object(
                'samples', jsonb_build_object('billed',0,'order',0,'gateway',0),
                'sum',     jsonb_build_object('billed',0,'order',0,'gateway',0),
                'avg',     jsonb_build_object('billed',0,'order',0,'gateway',0),
                'adjustedCount', 0
            ),
            'cod', jsonb_build_object('totalAmount',0,'paidCount',0,'paidAmount',0,'pendingCount',0,'pendingAmount',0,'noCollectionCount',0),
            'date_range', null,
            'shipments', '[]'::jsonb,
            'shipments_total', 0,
            'shipments_truncated', false,
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
            s.latest_scan_type,
            s.latest_scan_time,
            s.billed_weight,
            s.order_weight,
            s.gateway_weight,
            s.cod_amount,
            s.cod_status,
            s.cod_payment_time,
            s.vip_code,
            coalesce(public.jt_numeric_text(s.billed_weight::text),  0) as w_billed,
            coalesce(public.jt_numeric_text(s.order_weight::text),   0) as w_order,
            coalesce(public.jt_numeric_text(s.gateway_weight::text), 0) as w_gateway,
            coalesce(public.jt_numeric_text(s.cod_amount::text),     0) as cod_amt,
            case
                when substring(coalesce(s.booking_date::text, '') from 1 for 10) ~ '^\d{4}-\d{2}-\d{2}$'
                    then substring(s.booking_date::text from 1 for 10)::date
                else null
            end as booking_d,
            (s.signed_time is not null
             and trim(s.signed_time::text) <> ''
             and upper(trim(s.signed_time::text)) <> 'NULL'
             and trim(s.signed_time::text) <> '-') as is_closed,
            (s.issue_status is not null
             and trim(s.issue_status::text) <> ''
             and upper(trim(s.issue_status::text)) <> 'NULL'
             and trim(s.issue_status::text) <> '-') as has_issue,
            lower(coalesce(s.cod_status::text, '')) as cod_status_l,
            (s.cod_payment_time is not null
             and trim(s.cod_payment_time::text) <> ''
             and upper(trim(s.cod_payment_time::text)) <> 'NULL'
             and trim(s.cod_payment_time::text) <> '-') as cod_paid_time
        from public.jt_shipments s
        where lower(trim(s.sender_name)) = v_needle
    ),
    kpi_agg as (
        select
            count(*)::bigint as total,
            count(*) filter (where is_closed)::bigint as closed,
            count(*) filter (
                where not is_closed
                  and booking_d is not null
                  and (v_today - booking_d) between 0 and 3
            )::bigint as pending_w3,
            count(*) filter (
                where not is_closed
                  and booking_d is not null
                  and (v_today - booking_d) between 0 and 7
            )::bigint as pending_w7,
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
            )::bigint as adjusted
        from matched
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
    recent as (
        select
            awb_number, booking_date, issue_status, latest_scan_type,
            latest_scan_time, signer_name, billed_weight, order_weight,
            gateway_weight, cod_amount, cod_status, cod_payment_time
        from matched
        order by booking_date desc nulls last, awb_number desc
        limit 200
    ),
    recent_json as (
        select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) as data,
               (select count(*) from matched) as total_cnt
        from recent r
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
            'pendingWithin3Days', k.pending_w3,
            'pendingWithin7Days', k.pending_w7,
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
            'adjustedCount', w.adjusted
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
        rj.data,
        rj.total_cnt,
        (rj.total_cnt > 200),
        (select vip_code from latest_vip)
    into
        v_kpi, v_weight, v_cod, v_range, v_shipments, v_total, v_truncated, v_latest_vip
    from kpi_agg k, weight_agg w, cod_agg c, range_agg rg, recent_json rj;

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
        'shipments',              v_shipments,
        'shipments_total',        v_total,
        'shipments_truncated',    v_truncated,
        'financial',              v_financial,
        'financial_refreshed_at', v_snapshot_refreshed_at,
        'latest_vip_code',        v_latest_vip
    );

    return v_result;
end;
$$;

revoke all on function public.get_customer_profile_summary(text) from public;
grant execute on function public.get_customer_profile_summary(text) to service_role;
