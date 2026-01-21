-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Settings (Site Config)
create table public.settings (
  id bigint generated always as identity primary key,
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- 2. Categories
create table public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text unique not null,
  image_url text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. Products (Inventory Items)
create table public.products (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  price decimal(10,2) not null default 0,
  sku text unique,
  image_url text,
  stock_quantity int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 4. Bundles (Sellable Units)
create table public.bundles (
  id bigint generated always as identity primary key,
  name text not null,
  slug text unique not null,
  description text,
  price decimal(10,2) not null,
  image_urls text[], -- Array of images
  type text check (type in ('fixed', 'configurable')) not null default 'fixed',
  is_active boolean default true,
  category_id bigint references public.categories(id),
  created_at timestamptz default now()
);

-- 5. Bundle Items (For Fixed Sets)
create table public.bundle_items (
  id bigint generated always as identity primary key,
  bundle_id bigint references public.bundles(id) on delete cascade,
  product_id bigint references public.products(id),
  quantity int not null default 1
);

-- 5b. Bundle Configurable Options (New)
create table public.bundle_option_groups (
  id bigint generated always as identity primary key,
  bundle_id bigint references public.bundles(id) on delete cascade,
  name text not null, -- e.g. "Choose Box Size"
  sort_order int default 0
);

create table public.bundle_options (
  id bigint generated always as identity primary key,
  group_id bigint references public.bundle_option_groups(id) on delete cascade,
  product_id bigint references public.products(id), -- The underlying item
  name text, -- Optional override name, otherwise use product name
  price_modifier decimal(10,2) default 0, -- Extra cost
  sort_order int default 0
);

-- 6. Customers
create table public.customers (
  id uuid default uuid_generate_v4() primary key,
  line_user_id text unique, -- Linked to LINE
  name text,
  phone text,
  address text,
  created_at timestamptz default now()
);

-- 7. Orders
create table public.orders (
  id bigint generated always as identity primary key,
  order_no text unique not null, -- e.g. OD-20240109-001
  customer_id uuid references public.customers(id),
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  customer_location_url text, -- Map link
  total_amount decimal(10,2) not null,
  status text check (status in ('new', 'confirmed', 'preparing', 'ready', 'completed', 'canceled')) default 'new',
  payment_method text check (payment_method in ('shop', 'transfer', 'promptpay')),
  payment_slip_url text,
  payment_status text check (payment_status in ('pending', 'paid', 'rejected')) default 'pending',
  notes text,
  line_user_id text, -- Snapshot if customer isn't registered
  stock_reserved_until timestamptz, -- Reservation
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Order Items
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint references public.orders(id) on delete cascade,
  bundle_id bigint references public.bundles(id),
  bundle_name text not null, -- Snapshot
  price decimal(10,2) not null, -- Snapshot
  quantity int not null,
  chosen_options jsonb -- For configurable bundles: [{ group_name: "Box", option_name: "Large", product_id: 123 }]
);

-- RLS Policies (Simple for now)
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.bundles enable row level security;
alter table public.bundle_items enable row level security;
alter table public.bundle_option_groups enable row level security;
alter table public.bundle_options enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Public Read
create policy "Public read settings" on public.settings for select using (true);
create policy "Public read categories" on public.categories for select using (true);
create policy "Public read products" on public.products for select using (true);
create policy "Public read bundles" on public.bundles for select using (true);
create policy "Public read bundle_items" on public.bundle_items for select using (true);
create policy "Public read bundle_option_groups" on public.bundle_option_groups for select using (true);
create policy "Public read bundle_options" on public.bundle_options for select using (true);

-- Allow insert orders
create policy "Allow insert orders" on public.orders for insert with check (true);
create policy "Allow insert order_items" on public.order_items for insert with check (true);

-- Functions
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

create trigger update_orders_updated_at before update on public.orders
for each row execute procedure update_updated_at_column();
