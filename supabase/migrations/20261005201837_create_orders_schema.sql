create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.admin_users is
  'Usuarios con acceso total al panel. El producto solo contempla el rol administrador.';

create table public.routes (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.customers (
  id bigint generated always as identity primary key,
  customer_type text not null check (customer_type in ('retail', 'wholesale')),
  name text not null,
  business_name text,
  tax_id text,
  phone text not null,
  receiver_name text,
  receiver_phone text,
  email text,
  address text,
  neighborhood text,
  city text not null default 'Barranquilla',
  route_id bigint references public.routes (id) on delete set null,
  billing_address text,
  requires_e_invoice boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_type, phone)
);

create table public.products (
  id bigint generated always as identity primary key,
  sku text unique,
  name text not null unique,
  category text,
  aliases text[] not null default '{}',
  allowed_units text[] not null default array['kg', 'lb'],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_prices (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  customer_type text not null check (customer_type in ('retail', 'wholesale')),
  unit text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  valid_from date not null default current_date,
  valid_until date,
  created_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from),
  unique (product_id, customer_type, unit, valid_from)
);

create table public.orders (
  id bigint generated always as identity primary key,
  order_number text generated always as ('FEN-' || lpad(id::text, 6, '0')) stored unique,
  customer_type text not null check (customer_type in ('retail', 'wholesale')),
  customer_id bigint not null references public.customers (id) on delete restrict,
  route_id bigint references public.routes (id) on delete set null,
  source text not null check (source in ('form', 'agent', 'manual')),
  source_reference text,
  source_payload jsonb not null default '{}'::jsonb,
  extraction_confidence numeric(5, 4) check (
    extraction_confidence is null or extraction_confidence between 0 and 1
  ),
  status text not null default 'received' check (
    status in (
      'needs_review', 'received', 'quoted', 'confirmed', 'preparing',
      'ready', 'dispatched', 'delivered', 'cancelled', 'incident'
    )
  ),
  fulfillment_type text not null default 'delivery' check (
    fulfillment_type in ('delivery', 'pickup')
  ),
  requested_delivery_at timestamptz,
  delivery_address text,
  delivery_notes text,
  payment_method text check (
    payment_method is null or payment_method in ('cash', 'transfer', 'credit', 'other')
  ),
  payment_status text not null default 'pending' check (
    payment_status in ('not_required', 'pending', 'proof_received', 'verified', 'rejected', 'paid', 'credit')
  ),
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  adjustments numeric(12, 2) not null default 0,
  total numeric(12, 2) generated always as (subtotal + delivery_fee + adjustments) stored,
  notes text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  product_id bigint references public.products (id) on delete set null,
  product_name text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null,
  actual_quantity numeric(12, 3) check (actual_quantity is null or actual_quantity > 0),
  preparation text,
  notes text,
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  line_total numeric(12, 2) generated always as (
    coalesce(actual_quantity, quantity) * unit_price
  ) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.order_attachments (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  kind text not null check (kind in ('payment_proof', 'source_audio', 'source_image', 'other')),
  storage_path text not null unique,
  mime_type text,
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index orders_customer_type_status_idx
  on public.orders (customer_type, status, received_at desc);
create unique index orders_source_reference_uidx
  on public.orders (source, source_reference)
  where source_reference is not null;
create index orders_route_delivery_idx
  on public.orders (route_id, requested_delivery_at, status)
  where customer_type = 'wholesale';
create index order_items_order_idx on public.order_items (order_id, sort_order);
create index order_items_product_idx on public.order_items (product_id);
create index customers_route_idx on public.customers (route_id)
  where customer_type = 'wholesale';

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  ) then
    raise exception 'Administrator access required';
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (
      order_id,
      previous_status,
      new_status,
      changed_by
    ) values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      (select auth.uid())
    );
  end if;
  return new;
end;
$$;

create trigger orders_record_status_change
after insert or update of status on public.orders
for each row execute function private.record_order_status_change();

revoke all on function public.set_updated_at() from public, anon;
revoke all on function private.record_order_status_change() from public, anon, authenticated;
grant execute on function public.set_updated_at() to authenticated;

alter table public.admin_users enable row level security;
alter table public.routes enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_attachments enable row level security;
alter table public.order_status_history enable row level security;

create policy "Administrators can read their access record"
on public.admin_users for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Administrators manage routes"
on public.routes for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Administrators manage customers"
on public.customers for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Administrators manage products"
on public.products for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Administrators manage product prices"
on public.product_prices for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Administrators manage orders"
on public.orders for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Administrators manage order items"
on public.order_items for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Administrators manage order attachments"
on public.order_attachments for all
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

create policy "Administrators read order history"
on public.order_status_history for select
to authenticated
using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));

revoke all on table public.admin_users from anon;
revoke all on table public.routes from anon;
revoke all on table public.customers from anon;
revoke all on table public.products from anon;
revoke all on table public.product_prices from anon;
revoke all on table public.orders from anon;
revoke all on table public.order_items from anon;
revoke all on table public.order_attachments from anon;
revoke all on table public.order_status_history from anon;

grant select on table public.admin_users to authenticated;
grant select, insert, update, delete on table public.routes to authenticated;
grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.product_prices to authenticated;
grant select, insert, update, delete on table public.orders to authenticated;
grant select, insert, update, delete on table public.order_items to authenticated;
grant select, insert, update, delete on table public.order_attachments to authenticated;
grant select on table public.order_status_history to authenticated;

grant usage, select on all sequences in schema public to authenticated;

insert into public.routes (name, sort_order) values
  ('Soledad', 10),
  ('Centro', 20),
  ('Norte', 30),
  ('Sur', 40),
  ('Galapa', 50),
  ('Sin clasificar', 999)
on conflict (name) do nothing;
