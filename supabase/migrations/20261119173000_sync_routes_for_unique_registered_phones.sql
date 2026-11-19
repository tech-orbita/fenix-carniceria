begin;

-- Historical order-created rows without identification can coexist with one
-- formally registered customer on the same phone. Do not merge them; only
-- inherit the route when exactly one registered customer owns that phone.
with phone_groups as (
  select
    regexp_replace(coalesce(phone, ''), '\D', '', 'g') as phone_key,
    min(id) filter (where wholesale_registered_at is not null) as registered_customer_id,
    count(*) filter (where wholesale_registered_at is not null) as registered_count
  from customers
  where customer_type = 'wholesale'
    and is_active
    and regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> ''
  group by regexp_replace(coalesce(phone, ''), '\D', '', 'g')
), route_sources as (
  select pg.phone_key, registered.route_id
  from phone_groups pg
  join customers registered on registered.id = pg.registered_customer_id
  where pg.registered_count = 1
    and registered.route_id is not null
    and registered.route_id <> 6
), aliases as (
  select alias.id, rs.route_id
  from customers alias
  join route_sources rs
    on regexp_replace(coalesce(alias.phone, ''), '\D', '', 'g') = rs.phone_key
  where alias.customer_type = 'wholesale'
    and alias.is_active
    and alias.wholesale_registered_at is null
    and (alias.route_id is null or alias.route_id = 6)
)
update customers alias
set route_id = aliases.route_id, updated_at = now()
from aliases
where alias.id = aliases.id;

with phone_groups as (
  select
    regexp_replace(coalesce(phone, ''), '\D', '', 'g') as phone_key,
    min(id) filter (where wholesale_registered_at is not null) as registered_customer_id,
    count(*) filter (where wholesale_registered_at is not null) as registered_count
  from customers
  where customer_type = 'wholesale'
    and is_active
    and regexp_replace(coalesce(phone, ''), '\D', '', 'g') <> ''
  group by regexp_replace(coalesce(phone, ''), '\D', '', 'g')
), route_sources as (
  select pg.phone_key, registered.route_id
  from phone_groups pg
  join customers registered on registered.id = pg.registered_customer_id
  where pg.registered_count = 1
    and registered.route_id is not null
    and registered.route_id <> 6
), aliases as (
  select alias.id, rs.route_id
  from customers alias
  join route_sources rs
    on regexp_replace(coalesce(alias.phone, ''), '\D', '', 'g') = rs.phone_key
  where alias.customer_type = 'wholesale'
    and alias.is_active
    and alias.wholesale_registered_at is null
)
update orders order_row
set route_id = aliases.route_id
from aliases
where order_row.customer_id = aliases.id
  and (order_row.route_id is null or order_row.route_id = 6);

commit;
