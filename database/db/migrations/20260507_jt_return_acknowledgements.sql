-- Store admin acknowledgements for returned J&T parcels outside generic settings.
-- Active acknowledgements hide the AWB from the return dashboard count/list.

create table if not exists public.jt_return_acknowledgements (
    id bigint generated always as identity primary key,
    awb_number text not null,
    reason text not null,
    status text not null default 'active' check (status in ('active', 'cancelled')),
    acknowledged_by text,
    acknowledged_at timestamptz not null default now(),
    cancelled_reason text,
    cancelled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists jt_return_acknowledgements_active_awb_idx
    on public.jt_return_acknowledgements (awb_number)
    where status = 'active';

create index if not exists jt_return_acknowledgements_status_ack_at_idx
    on public.jt_return_acknowledgements (status, acknowledged_at desc);

create index if not exists jt_return_acknowledgements_awb_idx
    on public.jt_return_acknowledgements (awb_number);

-- Migrate existing settings-based acknowledgements, if any.
insert into public.jt_return_acknowledgements (
    awb_number,
    reason,
    acknowledged_at,
    acknowledged_by,
    status
)
select
    left(trim(item ->> 'awb_number'), 80) as awb_number,
    left(trim(item ->> 'reason'), 500) as reason,
    coalesce(nullif(item ->> 'acknowledged_at', '')::timestamptz, now()) as acknowledged_at,
    'settings-migration' as acknowledged_by,
    'active' as status
from public.settings s
cross join lateral jsonb_array_elements(
    case
        when jsonb_typeof(s.value) = 'array' then s.value
        when jsonb_typeof(s.value) = 'string' then (s.value #>> '{}')::jsonb
        else '[]'::jsonb
    end
) as item
where s.key = 'jt_dashboard_return_acknowledgements'
  and nullif(trim(item ->> 'awb_number'), '') is not null
  and nullif(trim(item ->> 'reason'), '') is not null
on conflict do nothing;

alter table public.jt_return_acknowledgements enable row level security;

revoke all on table public.jt_return_acknowledgements from anon, authenticated;
grant all on table public.jt_return_acknowledgements to service_role;

