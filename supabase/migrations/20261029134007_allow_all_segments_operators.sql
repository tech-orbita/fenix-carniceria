-- Un operador puede quedar asignado a un segmento concreto o a ambos.
-- `customer_type = null` significa ambos únicamente para role = operator;
-- los privilegios administrativos siguen dependiendo exclusivamente de role = admin.
alter table public.panel_users
  drop constraint panel_users_scope;

alter table public.panel_users
  add constraint panel_users_scope check (
    (role = 'admin' and customer_type is null)
    or (role = 'operator')
  );

comment on table public.panel_users is
  'Usuarios del panel. Administradores gestionan usuarios; operadores acceden a retail, wholesale o ambos cuando customer_type es null.';

create or replace function private.can_access_customer_type(target text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.panel_users
    where user_id = (select auth.uid())
      and (
        role = 'admin'
        or (role = 'operator' and (customer_type is null or customer_type = target))
      )
  );
$$;

-- Nelson opera ambos segmentos, pero no administra usuarios.
update public.panel_users
set role = 'operator', customer_type = null
where user_id = '9ef8e0df-2bfa-47d2-8ff3-a1558091b287';
