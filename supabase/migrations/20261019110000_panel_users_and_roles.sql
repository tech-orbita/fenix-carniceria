-- Usuarios del panel con dos roles:
--   admin    → ve y gestiona pedidos minoristas y mayoristas, y administra usuarios.
--   operator → solo ve y gestiona los pedidos del segmento que tiene asignado.
create table public.panel_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'operator')),
  customer_type text check (customer_type in ('retail', 'wholesale')),
  created_at timestamptz not null default now(),
  constraint panel_users_scope check (
    (role = 'admin' and customer_type is null)
    or (role = 'operator' and customer_type is not null)
  )
);

comment on table public.panel_users is
  'Usuarios con acceso al panel. Los operadores solo acceden al segmento (customer_type) asignado.';

insert into public.panel_users (user_id, role)
select user_id, 'admin' from public.admin_users
on conflict (user_id) do nothing;

-- Funciones de autorización usadas por las políticas RLS.
grant usage on schema private to authenticated;

create function private.is_panel_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.panel_users
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create function private.can_access_customer_type(target text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.panel_users
    where user_id = (select auth.uid())
      and (role = 'admin' or customer_type = target)
  );
$$;

create function private.is_panel_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.panel_users where user_id = (select auth.uid()));
$$;

revoke all on function private.is_panel_admin() from public, anon;
revoke all on function private.can_access_customer_type(text) from public, anon;
revoke all on function private.is_panel_user() from public, anon;
grant execute on function private.is_panel_admin() to authenticated;
grant execute on function private.can_access_customer_type(text) to authenticated;
grant execute on function private.is_panel_user() to authenticated;

-- El historial de estados también valida el segmento de quien cambia el pedido.
create or replace function private.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.can_access_customer_type(new.customer_type) then
    raise exception 'No tienes acceso a este tipo de pedido';
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

-- Reemplaza las políticas de "solo administrador" por políticas por segmento.
drop policy "Administrators can read their access record" on public.admin_users;
drop policy "Administrators manage routes" on public.routes;
drop policy "Administrators manage customers" on public.customers;
drop policy "Administrators manage orders" on public.orders;
drop policy "Administrators manage order items" on public.order_items;
drop policy "Administrators manage order attachments" on public.order_attachments;
drop policy "Administrators read order history" on public.order_status_history;

-- Si algo más depende de admin_users la migración falla aquí en vez de borrar en cascada.
drop table public.admin_users;

alter table public.panel_users enable row level security;
revoke all on table public.panel_users from anon;

create policy "Panel users read their own access record"
on public.panel_users for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Panel users read routes"
on public.routes for select
to authenticated
using ((select private.is_panel_user()));

create policy "Administrators manage routes"
on public.routes for all
to authenticated
using ((select private.is_panel_admin()))
with check ((select private.is_panel_admin()));

create policy "Panel users manage customers of their segment"
on public.customers for all
to authenticated
using (private.can_access_customer_type(customer_type))
with check (private.can_access_customer_type(customer_type));

create policy "Panel users manage orders of their segment"
on public.orders for all
to authenticated
using (private.can_access_customer_type(customer_type))
with check (private.can_access_customer_type(customer_type));

create policy "Panel users manage items of their segment"
on public.order_items for all
to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_items.order_id
    and private.can_access_customer_type(orders.customer_type)
))
with check (exists (
  select 1 from public.orders
  where orders.id = order_items.order_id
    and private.can_access_customer_type(orders.customer_type)
));

create policy "Panel users manage attachments of their segment"
on public.order_attachments for all
to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_attachments.order_id
    and private.can_access_customer_type(orders.customer_type)
))
with check (exists (
  select 1 from public.orders
  where orders.id = order_attachments.order_id
    and private.can_access_customer_type(orders.customer_type)
));

create policy "Panel users read history of their segment"
on public.order_status_history for select
to authenticated
using (exists (
  select 1 from public.orders
  where orders.id = order_status_history.order_id
    and private.can_access_customer_type(orders.customer_type)
));
