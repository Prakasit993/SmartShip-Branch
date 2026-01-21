-- MASTER REPAIR SCRIPT: Schema + Operations Upgrade
-- Run this ENTIRE script in Source Supabase SQL Editor

-- ==========================================
-- PART 1: ENSURE BASE TABLES EXIST
-- ==========================================

create extension if not exists "uuid-ossp";

-- 1. Settings
create table if not exists public.settings (
  id bigint generated always as identity primary key,
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- 2. Categories
create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text unique not null,
  image_url text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. Products
create table if not exists public.products (
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

-- 4. Bundles
create table if not exists public.bundles (
  id bigint generated always as identity primary key,
  name text not null,
  slug text unique not null,
  description text,
  price decimal(10,2) not null,
  image_urls text[],
  type text check (type in ('fixed', 'configurable')) not null default 'fixed',
  is_active boolean default true,
  category_id bigint references public.categories(id),
  created_at timestamptz default now()
);

-- 5. Bundle Items
create table if not exists public.bundle_items (
  id bigint generated always as identity primary key,
  bundle_id bigint references public.bundles(id) on delete cascade,
  product_id bigint references public.products(id),
  quantity int not null default 1
);

-- Bundle Options
create table if not exists public.bundle_option_groups (
  id bigint generated always as identity primary key,
  bundle_id bigint references public.bundles(id) on delete cascade,
  name text not null,
  sort_order int default 0
);

create table if not exists public.bundle_options (
  id bigint generated always as identity primary key,
  group_id bigint references public.bundle_option_groups(id) on delete cascade,
  product_id bigint references public.products(id),
  name text,
  price_modifier decimal(10,2) default 0,
  sort_order int default 0
);

-- 6. Customers
create table if not exists public.customers (
  id uuid default uuid_generate_v4() primary key,
  line_user_id text unique,
  name text,
  phone text,
  address text,
  created_at timestamptz default now()
);

-- 7. Orders (Base Definition)
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  order_no text unique not null, 
  customer_id uuid references public.customers(id),
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  customer_location_url text,
  total_amount decimal(10,2) not null,
  status text check (status in ('new', 'confirmed', 'preparing', 'ready', 'completed', 'canceled')) default 'new',
  payment_method text check (payment_method in ('shop', 'transfer', 'promptpay')),
  payment_slip_url text,
  notes text,
  line_user_id text,
  stock_reserved_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. Order Items
create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint references public.orders(id) on delete cascade,
  bundle_id bigint references public.bundles(id),
  bundle_name text not null,
  price decimal(10,2) not null,
  quantity int not null,
  chosen_options jsonb
);

-- Enable RLS (Safe to re-run)
alter table public.orders enable row level security;
drop policy if exists "Allow insert orders" on public.orders;
create policy "Allow insert orders" on public.orders for insert with check (true);

-- ==========================================
-- PART 2: APPLY OPERATIONS UPGRADE
-- ==========================================

-- 1. Create a sequence for Order IDs
CREATE SEQUENCE IF NOT EXISTS order_id_seq START 1;

-- 2. Function to generate Friendly ID (EX-2026-XXXXXX)
CREATE OR REPLACE FUNCTION generate_order_id()
RETURNS text AS $$
DECLARE
  year_text text;
  seq_val integer;
  formatted_id text;
BEGIN
  year_text := to_char(now(), 'YYYY');
  seq_val := nextval('order_id_seq');
  formatted_id := 'EX-' || year_text || '-' || lpad(seq_val::text, 6, '0');
  RETURN formatted_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Add columns to orders table (Safe modification)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS friendly_id text UNIQUE DEFAULT generate_order_id(),
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';

-- 4. Backfill friendly_id if NULL
UPDATE public.orders 
SET friendly_id = generate_order_id() 
WHERE friendly_id IS NULL;
