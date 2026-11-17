-- Recupera todos los envíos del 16 de noviembre que HighLevel conservó pero
-- que el webhook anterior rechazó. Es idempotente mediante source_reference.

create temporary table wholesale_recovery_20261116 (
  received_at timestamptz not null,
  business_name text not null,
  customer_name text not null,
  phone text,
  tax_id text,
  address text,
  form_name text not null,
  order_text text not null,
  observations text,
  payment_proof text,
  order_status text not null,
  recovery_reference text not null,
  items jsonb not null
) on commit drop;

insert into wholesale_recovery_20261116 values
('2026-11-16 18:28:00-05', 'Sabor del río', 'Sabor del río', '+573006034732', null, null, 'mayorista-cliente',
 '25 libras de carne blanda relajada; 8 libras de punta gorda en mariposa (Gordita); 12 libras de atravesado tajado (Gordito); 6 libras de muchacho tajado; 12 libras de espaldilla; 16 libras de sobrebarriga delgada; 8 libras de costilla porcionada; 8 libras de chuleta partida a la mitad; 2 lenguas; 4 libras de capón molido; 4 libras de hueso blanco', null,
 'https://services.leadconnectorhq.com/documents/download/sYmt9VbAxJ09fbWZuA45', 'received', 'ghl-recovery:mayorista-cliente:202611161828:sabor-del-rio',
 '[{"product_name":"Blanda","quantity":25,"unit":"lb","preparation":"R"},{"product_name":"Punta gorda","quantity":8,"unit":"lb","preparation":"Mariposa (Gordita)"},{"product_name":"Atravesado","quantity":12,"unit":"lb","preparation":"Tajado (Gordito)"},{"product_name":"Comodín","quantity":6,"unit":"lb","preparation":"Muchacho tajado"},{"product_name":"Espaldilla","quantity":12,"unit":"lb"},{"product_name":"Sobrebarriga","quantity":16,"unit":"lb","preparation":"Delgada"},{"product_name":"Costilla","quantity":8,"unit":"lb","preparation":"Porcionada"},{"product_name":"Chuleta","quantity":8,"unit":"lb","preparation":"Partida a la mitad"},{"product_name":"Lenguas","quantity":2,"unit":"cantidad"},{"product_name":"Blanda","quantity":4,"unit":"lb","preparation":"C / molido"},{"product_name":"Hueso blanco","quantity":4,"unit":"lb"}]'),
('2026-11-16 18:16:00-05', 'Torre36', 'Torre36', '+573204723014', null, null, 'mayorista-cliente',
 'Medio capón 3 espaldilla 5 molida especial 3 costilla', 'La costilla que no esté gorda', null, 'received', 'ghl-recovery:mayorista-cliente:202611161816:torre36',
 '[{"product_name":"Blanda","quantity":0.5,"unit":"cantidad","preparation":"C"},{"product_name":"Espaldilla","quantity":3,"unit":"cantidad"},{"product_name":"Molida especial","quantity":5,"unit":"cantidad"},{"product_name":"Costilla","quantity":3,"unit":"cantidad"}]'),
('2026-11-16 18:02:00-05', 'La plazita santa cruz', 'La plazita santa cruz', '+573019589044', null, null, 'mayorista-cliente',
 '5 sobre barriga 3 de atrabesado', null, null, 'received', 'ghl-recovery:mayorista-cliente:202611161802:la-plazita-santa-cruz',
 '[{"product_name":"Sobrebarriga","quantity":5,"unit":"cantidad"},{"product_name":"Atravesado","quantity":3,"unit":"cantidad"}]'),
('2026-11-16 17:53:00-05', 'tienda la granja', 'tienda la granja', '+573135222698', null, null, 'mayorista-cliente',
 '35 L de blanda relajada; 1 lomo ancho; 35L de molida; 15 L de espaldilla; 1 atravesado; 1 bollo; 5 L jarrete; 7 L higado; 7 L de bofe; 1 corazón; 12 L costillita de tira; 12 L hueso carnudo; 10 L costillita de cerdo; 2 Pancetas; 7 L de panza; 12 L hueso de pollo; 40 L filete; 8 L hueso blanco; 10 L de chuleta ahumada', null, null, 'received', 'ghl-recovery:mayorista-cliente:202611161753:tienda-la-granja',
 '[{"product_name":"Blanda","quantity":35,"unit":"lb","preparation":"R"},{"product_name":"Blanda","quantity":1,"unit":"cantidad","preparation":"Ancho"},{"product_name":"Molida especial","quantity":35,"unit":"lb"},{"product_name":"Espaldilla","quantity":15,"unit":"lb"},{"product_name":"Atravesado","quantity":1,"unit":"cantidad"},{"product_name":"Bollo","quantity":1,"unit":"cantidad"},{"product_name":"Jarrete","quantity":5,"unit":"lb"},{"product_name":"Hígado","quantity":7,"unit":"lb"},{"product_name":"Bofe","quantity":7,"unit":"lb"},{"product_name":"Corazón","quantity":1,"unit":"cantidad"},{"product_name":"Costillita","quantity":12,"unit":"lb","preparation":"De tira"},{"product_name":"Hueso","quantity":12,"unit":"lb","preparation":"Carnudo"},{"product_name":"Costillita","quantity":10,"unit":"lb","preparation":"De cerdo"},{"product_name":"Comodín","quantity":2,"unit":"cantidad","preparation":"Pancetas"},{"product_name":"Panza","quantity":7,"unit":"lb"},{"product_name":"Hueso pollo","quantity":12,"unit":"lb"},{"product_name":"Filete","quantity":40,"unit":"lb"},{"product_name":"Hueso blanco","quantity":8,"unit":"lb"},{"product_name":"Chuleta","quantity":10,"unit":"lb","preparation":"Ahumada"}]'),
('2026-11-16 17:22:00-05', 'La plazita santa cruz', 'La plazita santa cruz', '+573019589044', null, null, 'mayorista-cliente',
 '6 de molida 4 de panza', null, null, 'received', 'ghl-recovery:mayorista-cliente:202611161722:la-plazita-santa-cruz',
 '[{"product_name":"Molida especial","quantity":6,"unit":"cantidad"},{"product_name":"Panza","quantity":4,"unit":"cantidad"}]'),
('2026-11-16 16:45:00-05', 'Frontera #2 villa olímpica', 'Frontera #2 villa olímpica', '+573023935949', null, null, 'mayorista-cliente',
 'Me envías por favor un lomo ancho limpio 2 lomos de cerdo limpio del que viene largo y descongelado', null, null, 'received', 'ghl-recovery:mayorista-cliente:202611161645:frontera-2-villa-olimpica',
 '[{"product_name":"Blanda","quantity":1,"unit":"cantidad","preparation":"Ancho / limpio"},{"product_name":"Lomo cerdo","quantity":2,"unit":"cantidad","preparation":"Limpio, largo y descongelado"}]'),
('2026-11-16 16:05:00-05', 'Restaurante Dónde Silva', 'Restaurante Dónde Silva', '+573246445825', null, null, 'mayorista-cliente',
 '2 libras de atravesado; 2 libras de falda; 2 libras de molida; 3 libras de sobrebarriga; 3 libras de Rabo', null, null, 'received', 'ghl-recovery:mayorista-cliente:202611161605:restaurante-donde-silva',
 '[{"product_name":"Atravesado","quantity":2,"unit":"lb"},{"product_name":"Falda","quantity":2,"unit":"lb"},{"product_name":"Molida especial","quantity":2,"unit":"lb"},{"product_name":"Sobrebarriga","quantity":3,"unit":"lb"},{"product_name":"Rabo res","quantity":3,"unit":"lb"}]'),
('2026-11-16 15:50:00-05', 'Tienda la preferida los almendros', 'Tienda la preferida los almendros', '+573337533730', null, null, 'mayorista-cliente',
 '15 lomo ancho. 1 bollo. 4 de pecho. 10 de molida especial. 3 de hueso carnudo. 3 libras asado de tira. Tres de panza costilla cerdo criollo 3 libras', 'Todo bonito', null, 'received', 'ghl-recovery:mayorista-cliente:202611161550:tienda-la-preferida-los-almendros',
 '[{"product_name":"Blanda","quantity":15,"unit":"cantidad","preparation":"Ancho"},{"product_name":"Bollo","quantity":1,"unit":"cantidad"},{"product_name":"Comodín","quantity":4,"unit":"cantidad","preparation":"Pecho"},{"product_name":"Molida especial","quantity":10,"unit":"cantidad"},{"product_name":"Hueso","quantity":3,"unit":"cantidad","preparation":"Carnudo"},{"product_name":"Asado de Tira","quantity":3,"unit":"lb"},{"product_name":"Panza","quantity":3,"unit":"cantidad"},{"product_name":"Costilla cerdo","quantity":3,"unit":"lb","preparation":"Criollo"}]'),
('2026-11-16 10:45:00-05', 'gonzalo almanza', 'gonzalo almanza', '+573116731681', null, null, 'mayorista-cliente',
 '20 kilos de lomo fino', null, null, 'received', 'ghl-recovery:mayorista-cliente:202611161045:gonzalo-almanza',
 '[{"product_name":"Lomo fino","quantity":20,"unit":"kg"}]'),
('2026-11-16 10:13:00-05', 'Ricolle Dwlivwry', 'Ricolle Dwlivwry', '+573185409197', null, null, 'mayorista-cliente',
 'Pago del pedido jueves 12 nov', 'El envío parece ser un comprobante o mensaje, no un pedido nuevo.', 'https://services.leadconnectorhq.com/documents/download/7FVBQtWudpGQnE3M3Gdz', 'needs_review', 'ghl-recovery:mayorista-cliente:202611161013:ricolle-dwlivwry',
 '[{"product_name":"Comodín","quantity":0,"unit":"cantidad","preparation":"Pago del pedido jueves 12 nov"}]'),
('2026-11-16 01:24:00-05', 'Mano de Dios', 'Mano de Dios', '+573102136691', null, null, 'mayorista-cliente',
 '2 libras de carne de cerdo 2 libras de carne molida', null, null, 'received', 'ghl-recovery:mayorista-cliente:202611160124:mano-de-dios',
 '[{"product_name":"Lomo cerdo","quantity":2,"unit":"lb"},{"product_name":"Molida especial","quantity":2,"unit":"lb"}]'),
('2026-11-16 16:55:00-05', 'Pizzeria Valparaíso', 'Jazmín Escorcia', '+573046040213', '72.155.712', 'Calle 53 # 52 - 02', 'nuevo-mayorista',
 '', 'El formulario llegó sin texto en Coloca tu Pedido.', null, 'needs_review', 'ghl-recovery:nuevo-mayorista:202611161655:pizzeria-valparaiso',
 '[{"product_name":"Comodín","quantity":0,"unit":"cantidad","preparation":"Pedido no especificado"}]'),
('2026-11-16 17:03:00-05', 'Terraza de asados y sancochos', 'Jazmín Escorcia', '+573046040213', '1002156542', 'Carrera 52 # 50 B-123', 'nuevo-mayorista',
 '', 'El formulario llegó sin texto en Coloca tu Pedido.', null, 'needs_review', 'ghl-recovery:nuevo-mayorista:202611161703:terraza-de-asados-y-sancochos',
 '[{"product_name":"Comodín","quantity":0,"unit":"cantidad","preparation":"Pedido no especificado"}]');

insert into public.customers (
  customer_type, identity_key, name, business_name, phone, tax_id, address, city, route_id,
  wholesale_registered_at
)
select
  'wholesale',
  'business:' || regexp_replace(lower(btrim(business_name)), '\s+', ' ', 'g'),
  customer_name,
  business_name,
  phone,
  tax_id,
  address,
  'Barranquilla',
  (select id from public.routes where name = 'Sin clasificar'),
  case when form_name = 'nuevo-mayorista' then received_at else null end
from (
  select distinct on (regexp_replace(lower(btrim(business_name)), '\s+', ' ', 'g')) *
  from wholesale_recovery_20261116
  order by regexp_replace(lower(btrim(business_name)), '\s+', ' ', 'g'), received_at desc
) newest_customer
on conflict (customer_type, identity_key) do update set
  name = coalesce(nullif(excluded.name, ''), public.customers.name),
  business_name = coalesce(nullif(excluded.business_name, ''), public.customers.business_name),
  phone = coalesce(nullif(excluded.phone, ''), public.customers.phone),
  tax_id = coalesce(nullif(excluded.tax_id, ''), public.customers.tax_id),
  address = coalesce(nullif(excluded.address, ''), public.customers.address),
  wholesale_registered_at = coalesce(public.customers.wholesale_registered_at, excluded.wholesale_registered_at);

insert into public.orders (
  customer_type, customer_id, route_id, source, source_reference, source_payload,
  status, fulfillment_type, delivery_address, notes, received_at, created_at, updated_at
)
select
  'wholesale',
  c.id,
  coalesce(c.route_id, (select id from public.routes where name = 'Sin clasificar')),
  'form',
  r.recovery_reference,
  jsonb_build_object(
    'source', 'form',
    'customer_type', 'wholesale',
    'customer', jsonb_strip_nulls(jsonb_build_object(
      'name', r.customer_name, 'business_name', r.business_name, 'phone', r.phone,
      'tax_id', r.tax_id, 'address', r.address
    )),
    'items', r.items,
    'form_data', jsonb_strip_nulls(jsonb_build_object(
      'form', r.form_name, 'order_text', r.order_text, 'tax_id', r.tax_id,
      'payment_proof', r.payment_proof,
      'original_payload', jsonb_build_object('recovered_from_highlevel', true, 'submitted_at', r.received_at)
    ))
  ),
  r.order_status,
  'delivery',
  r.address,
  r.observations,
  r.received_at,
  r.received_at,
  now()
from wholesale_recovery_20261116 r
join public.customers c
  on c.customer_type = 'wholesale'
 and c.identity_key = 'business:' || regexp_replace(lower(btrim(r.business_name)), '\s+', ' ', 'g')
on conflict (source, source_reference) where source_reference is not null do nothing;

insert into public.order_items (
  order_id, product_name, quantity, unit, preparation, notes, unit_price, sort_order
)
select
  o.id,
  item->>'product_name',
  (item->>'quantity')::numeric,
  item->>'unit',
  nullif(item->>'preparation', ''),
  nullif(item->>'notes', ''),
  0,
  item_index - 1
from wholesale_recovery_20261116 r
join public.orders o
  on o.source = 'form' and o.source_reference = r.recovery_reference
cross join lateral jsonb_array_elements(r.items) with ordinality as parsed(item, item_index)
where not exists (select 1 from public.order_items existing where existing.order_id = o.id);
