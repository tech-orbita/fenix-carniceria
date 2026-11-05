-- Los mayoristas se identifican por establecimiento, no por telefono. Esto permite
-- que Fenix registre varios negocios aunque el operador use un numero compartido.
alter table public.customers
  alter column phone drop not null;

alter table public.customers
  drop constraint if exists customers_customer_type_phone_key;

alter table public.customers
  add column identity_key text;

update public.customers
set identity_key = case
  when customer_type = 'wholesale' then
    'business:' || regexp_replace(lower(btrim(coalesce(nullif(business_name, ''), name))), '\s+', ' ', 'g')
  else
    'phone:' || regexp_replace(coalesce(phone, ''), '[^0-9]+', '', 'g')
end;

-- Recupera una ficha independiente para cada establecimiento conservado dentro
-- del payload original de los formularios ya recibidos.
with candidates as (
  select distinct on (identity_key)
    identity_key,
    coalesce(nullif(o.source_payload #>> '{customer,name}', ''), nullif(o.source_payload #>> '{customer,business_name}', ''), 'Cliente sin nombre') as customer_name,
    o.source_payload #>> '{customer,business_name}' as business_name,
    nullif(o.source_payload #>> '{customer,phone}', '') as phone,
    nullif(o.source_payload #>> '{customer,tax_id}', '') as tax_id,
    nullif(o.source_payload #>> '{customer,email}', '') as email,
    nullif(o.source_payload #>> '{customer,address}', '') as address,
    o.route_id
  from public.orders o
  cross join lateral (
    select 'business:' || regexp_replace(
      lower(btrim(coalesce(nullif(o.source_payload #>> '{customer,business_name}', ''), nullif(o.source_payload #>> '{customer,name}', '')))),
      '\s+', ' ', 'g'
    ) as identity_key
  ) submitted
  where o.customer_type = 'wholesale'
    and o.source = 'form'
    and submitted.identity_key <> 'business:'
  order by identity_key, o.received_at desc
)
insert into public.customers (
  customer_type, identity_key, name, business_name, phone, tax_id, email, address, route_id
)
select
  'wholesale', candidates.identity_key, customer_name, business_name, phone, tax_id, email, address, route_id
from candidates
where not exists (
  select 1 from public.customers c
  where c.customer_type = 'wholesale' and c.identity_key = candidates.identity_key
);

update public.orders o
set customer_id = c.id
from public.customers c
where o.customer_type = 'wholesale'
  and o.source = 'form'
  and c.customer_type = 'wholesale'
  and c.identity_key = 'business:' || regexp_replace(
    lower(btrim(coalesce(nullif(o.source_payload #>> '{customer,business_name}', ''), nullif(o.source_payload #>> '{customer,name}', '')))),
    '\s+', ' ', 'g'
  );

-- Si ya existieran fichas duplicadas del mismo establecimiento, conserva la mas
-- antigua y reasigna sus pedidos antes de crear la restriccion unica.
with canonical as (
  select customer_type, identity_key, min(id) as keep_id
  from public.customers
  group by customer_type, identity_key
)
update public.orders o
set customer_id = canonical.keep_id
from public.customers duplicate
join canonical
  on canonical.customer_type = duplicate.customer_type
 and canonical.identity_key = duplicate.identity_key
where o.customer_id = duplicate.id
  and duplicate.id <> canonical.keep_id;

with canonical as (
  select customer_type, identity_key, min(id) as keep_id
  from public.customers
  group by customer_type, identity_key
)
delete from public.customers duplicate
using canonical
where duplicate.customer_type = canonical.customer_type
  and duplicate.identity_key = canonical.identity_key
  and duplicate.id <> canonical.keep_id;

alter table public.customers
  alter column identity_key set not null,
  add constraint customers_customer_type_identity_key_key unique (customer_type, identity_key);

comment on column public.customers.identity_key is
  'Clave estable: telefono para minoristas y establecimiento para mayoristas.';

insert into public.routes (name, sort_order) values
  ('Centro', 10),
  ('Cacique', 20),
  ('Cordialidad', 30),
  ('Soledad', 40),
  ('Norte', 50),
  ('Galapa', 60),
  ('Barrio', 70),
  ('Sin clasificar', 999)
on conflict (name) do update set sort_order = excluded.sort_order;
