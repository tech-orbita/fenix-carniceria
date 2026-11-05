-- Recuperacion puntual de los envios historicos que HighLevel conservo pero que
-- no llegaron a orders. Es idempotente: source_reference y la comprobacion por
-- establecimiento/fecha evitan duplicar un pedido que ya hubiese sido reparado.
-- Los envios cuyo propio contenido indica que son pruebas se conservan como
-- cancelados y nunca entran a la operacion de preparacion o despacho.
with recovered (
  received_at, business_name, customer_name, phone, tax_id, address,
  legacy_zone, billing, order_text, observations, is_test
) as (
  values
    ('2026-11-04 17:02:00-05'::timestamptz, 'Lorenzo', 'Andres', '+573103990661', '123', '123', 'Centro Histórico', null, '5 capones; 2 lomo; rabo; puntagorda; 70 costilla; 2 atravesados; 15 panza; 30 hueso de cerdo', null, false),
    ('2026-11-04 16:52:00-05'::timestamptz, 'Mercadito', 'Andres', '+573103990661', '123', '123', 'Metropolitana', 'Factura Normal', 'Medio capon; 3 hueso; 2 jarrete; 2 pezuñas', null, false),
    ('2026-10-29 15:14:00-05'::timestamptz, 'Tienda Doña Yenifer', 'Andres', '+573103990661', '1098778323', 'Cra 1A4 # 47-02', 'Metropolitana', null, '8 de lomo ancho; 3 de costilla especial; chocozuela un kilo', null, false),
    ('2026-10-29 10:21:00-05'::timestamptz, 'Sas so', 'SARA TORRES', '+573502582969', '1022424759', 'CRA 39A 2B 48', 'Centro Histórico', 'Factura Electrónica', '10 kg blanda C; 8 lb murillo', null, false),
    ('2026-10-29 09:35:00-05'::timestamptz, 'Sas sa', 'SARA TORRES', '+573502582962', '1022424758', 'CRA 39A 2B 44', 'Suroccidente', 'Factura Normal', '1 kg blanda L; 1 kg molida; 1 kg sobrebarriga porcionado', null, false),
    ('2026-10-29 07:43:00-05'::timestamptz, 'Pamela', 'Pamela', '+573502582962', '1022424756', 'Av Americas 71-36', 'Soledad', 'Factura Electronica', '10 kg carne molida; 10 kg blanda C', null, false),
    ('2026-10-29 06:30:00-05'::timestamptz, 'Sas', 'Sas', '+573219733259', '1022424756', 'CRA 35C 2B 58', 'Suroccidente', 'Factura Normal', '3 patas de marrano; 4 kg lomo; 5 kg falda', null, false),
    ('2026-10-28 22:42:00-05'::timestamptz, 'NUBIA GALLEGO', 'NUBIA GALLEGO', '+573206362598', '2036985', 'AV AMERICAS 71-30', 'Suroccidente', 'Factura Electronica', '10 kg bola; 10 lb blanda C; 20 lb molida; 5 kg sobrebarriga', null, false),
    ('2026-10-28 06:44:00-05'::timestamptz, 'prueba pamela torres', 'prueba pamela torres', '+573024111311', '1022424575', 'calle 7 34 56', 'Soledad', 'Factura Electronica', '6 kg blanda L; 5 pechugas de pollo; 4 pierna pernil', 'Registro de prueba del formulario.', true),
    ('2026-10-28 05:50:00-05'::timestamptz, 'PAMELA TORRES', 'PAMELA TORRES', '+573104809169', '52062091', 'CALLE 8 A 69B 38', 'Metropolitano (Zona Sur)', 'Factura Normal', '10 capon; 2 sobrebarriga; 10 molida; 15 churrasco; 6 patas de res', null, false),
    ('2026-10-27 17:55:00-05'::timestamptz, 'Prueba Pamela 1', 'Prueba Pamela 1', '+573502582962', '1032470643', 'cra 39a 2b 44', 'Riomar (Zona Norte)', 'Factura Electronica', '10 kg churrasco; 10 kg blanda L', 'Registro de prueba del formulario.', true),
    ('2026-10-27 17:43:00-05'::timestamptz, 'Prueba Pamela', 'Prueba Pamela', '+573502582962', '1032470643', 'cra 39a 2b 44', 'Riomar (Zona Norte)', 'Factura Electronica', '10 kg molida; 10 kg blanda C', 'Registro de prueba del formulario.', true),
    ('2026-10-27 05:46:00-05'::timestamptz, 'Prueba Sara', 'Prueba Sara', '+573502582962', '1032470643', 'cra 46 # 76sur - 69', 'Riomar (Zona Norte)', 'Factura Electronica', '10 kg capon; 20 pechugas completas; 3 kg molida', 'Registro de prueba del formulario.', true),
    ('2026-10-22 18:08:00-05'::timestamptz, 'SARA', 'SARA', '+573502876547', '103459867', 'CRA 39A 2B 44', 'Galapa', 'Factura Electronica', '1 lb churrasco; 2 pechugas; 3 kg lomo', null, false),
    ('2026-10-15 18:43:00-05'::timestamptz, 'NEGOCIO PRUEBA FINAL CODEX', 'NEGOCIO PRUEBA FINAL CODEX', '+573001118765', 'TEST-FINAL-20261015', 'Dirección de prueba final, Barranquilla', 'Riomar (Zona Norte)', 'Factura Normal', 'PRUEBA FINAL - 3 kg carne molida. NO PREPARAR.', 'Validación de integración. No preparar ni despachar.', true),
    ('2026-10-15 18:38:00-05'::timestamptz, 'NEGOCIO PRUEBA CODEX WEBHOOK', 'NEGOCIO PRUEBA CODEX WEBHOOK', '+573001119876', 'TEST-20261015-B', 'Dirección de prueba, Barranquilla', 'Riomar (Zona Norte)', 'Factura Normal', 'PRUEBA WEBHOOK - 5 kg pechuga. NO PREPARAR.', 'Prueba de integración. No preparar ni despachar.', true),
    ('2026-10-15 18:36:00-05'::timestamptz, 'NEGOCIO PRUEBA CODEX', 'NEGOCIO PRUEBA CODEX', '+573001110002', 'TEST-20261015', 'Dirección de prueba, Bogotá', 'Centro Histórico (Zona Centro)', 'Factura Normal', 'PRUEBA AUTOMATIZADA - 5 kg pechuga. NO PREPARAR.', 'Pedido de prueba de integración. No preparar ni despachar.', true),
    ('2026-10-15 18:22:00-05'::timestamptz, 'prueba', 'prueba', '+573000000000', '1000000000', 'cra 00 prueba', 'Centro Histórico (Zona Centro)', 'Factura Electrónica', '1 lb carne tajada', 'Registro de prueba del formulario.', true)
), distinct_customers as (
  select distinct on (identity_key)
    identity_key, business_name, customer_name, phone, tax_id, address
  from (
    select
      'business:' || regexp_replace(lower(btrim(business_name)), '\s+', ' ', 'g') as identity_key,
      business_name, customer_name, phone, tax_id, address, received_at
    from recovered
  ) normalized
  order by identity_key, received_at desc
)
insert into public.customers (
  customer_type, identity_key, name, business_name, phone, tax_id, address, city, route_id
)
select
  'wholesale', c.identity_key, c.customer_name, c.business_name, c.phone,
  c.tax_id, c.address, 'Barranquilla', routes.id
from distinct_customers c
cross join lateral (
  select id from public.routes where name = 'Sin clasificar' limit 1
) routes
on conflict (customer_type, identity_key) do nothing;

with recovered (
  received_at, business_name, customer_name, phone, tax_id, address,
  legacy_zone, billing, order_text, observations, is_test
) as (
  values
    ('2026-11-04 17:02:00-05'::timestamptz, 'Lorenzo', 'Andres', '+573103990661', '123', '123', 'Centro Histórico', null, '5 capones; 2 lomo; rabo; puntagorda; 70 costilla; 2 atravesados; 15 panza; 30 hueso de cerdo', null, false),
    ('2026-11-04 16:52:00-05'::timestamptz, 'Mercadito', 'Andres', '+573103990661', '123', '123', 'Metropolitana', 'Factura Normal', 'Medio capon; 3 hueso; 2 jarrete; 2 pezuñas', null, false),
    ('2026-10-29 15:14:00-05'::timestamptz, 'Tienda Doña Yenifer', 'Andres', '+573103990661', '1098778323', 'Cra 1A4 # 47-02', 'Metropolitana', null, '8 de lomo ancho; 3 de costilla especial; chocozuela un kilo', null, false),
    ('2026-10-29 10:21:00-05'::timestamptz, 'Sas so', 'SARA TORRES', '+573502582969', '1022424759', 'CRA 39A 2B 48', 'Centro Histórico', 'Factura Electrónica', '10 kg blanda C; 8 lb murillo', null, false),
    ('2026-10-29 09:35:00-05'::timestamptz, 'Sas sa', 'SARA TORRES', '+573502582962', '1022424758', 'CRA 39A 2B 44', 'Suroccidente', 'Factura Normal', '1 kg blanda L; 1 kg molida; 1 kg sobrebarriga porcionado', null, false),
    ('2026-10-29 07:43:00-05'::timestamptz, 'Pamela', 'Pamela', '+573502582962', '1022424756', 'Av Americas 71-36', 'Soledad', 'Factura Electronica', '10 kg carne molida; 10 kg blanda C', null, false),
    ('2026-10-29 06:30:00-05'::timestamptz, 'Sas', 'Sas', '+573219733259', '1022424756', 'CRA 35C 2B 58', 'Suroccidente', 'Factura Normal', '3 patas de marrano; 4 kg lomo; 5 kg falda', null, false),
    ('2026-10-28 22:42:00-05'::timestamptz, 'NUBIA GALLEGO', 'NUBIA GALLEGO', '+573206362598', '2036985', 'AV AMERICAS 71-30', 'Suroccidente', 'Factura Electronica', '10 kg bola; 10 lb blanda C; 20 lb molida; 5 kg sobrebarriga', null, false),
    ('2026-10-28 06:44:00-05'::timestamptz, 'prueba pamela torres', 'prueba pamela torres', '+573024111311', '1022424575', 'calle 7 34 56', 'Soledad', 'Factura Electronica', '6 kg blanda L; 5 pechugas de pollo; 4 pierna pernil', 'Registro de prueba del formulario.', true),
    ('2026-10-28 05:50:00-05'::timestamptz, 'PAMELA TORRES', 'PAMELA TORRES', '+573104809169', '52062091', 'CALLE 8 A 69B 38', 'Metropolitano (Zona Sur)', 'Factura Normal', '10 capon; 2 sobrebarriga; 10 molida; 15 churrasco; 6 patas de res', null, false),
    ('2026-10-27 17:55:00-05'::timestamptz, 'Prueba Pamela 1', 'Prueba Pamela 1', '+573502582962', '1032470643', 'cra 39a 2b 44', 'Riomar (Zona Norte)', 'Factura Electronica', '10 kg churrasco; 10 kg blanda L', 'Registro de prueba del formulario.', true),
    ('2026-10-27 17:43:00-05'::timestamptz, 'Prueba Pamela', 'Prueba Pamela', '+573502582962', '1032470643', 'cra 39a 2b 44', 'Riomar (Zona Norte)', 'Factura Electronica', '10 kg molida; 10 kg blanda C', 'Registro de prueba del formulario.', true),
    ('2026-10-27 05:46:00-05'::timestamptz, 'Prueba Sara', 'Prueba Sara', '+573502582962', '1032470643', 'cra 46 # 76sur - 69', 'Riomar (Zona Norte)', 'Factura Electronica', '10 kg capon; 20 pechugas completas; 3 kg molida', 'Registro de prueba del formulario.', true),
    ('2026-10-22 18:08:00-05'::timestamptz, 'SARA', 'SARA', '+573502876547', '103459867', 'CRA 39A 2B 44', 'Galapa', 'Factura Electronica', '1 lb churrasco; 2 pechugas; 3 kg lomo', null, false),
    ('2026-10-15 18:43:00-05'::timestamptz, 'NEGOCIO PRUEBA FINAL CODEX', 'NEGOCIO PRUEBA FINAL CODEX', '+573001118765', 'TEST-FINAL-20261015', 'Dirección de prueba final, Barranquilla', 'Riomar (Zona Norte)', 'Factura Normal', 'PRUEBA FINAL - 3 kg carne molida. NO PREPARAR.', 'Validación de integración. No preparar ni despachar.', true),
    ('2026-10-15 18:38:00-05'::timestamptz, 'NEGOCIO PRUEBA CODEX WEBHOOK', 'NEGOCIO PRUEBA CODEX WEBHOOK', '+573001119876', 'TEST-20261015-B', 'Dirección de prueba, Barranquilla', 'Riomar (Zona Norte)', 'Factura Normal', 'PRUEBA WEBHOOK - 5 kg pechuga. NO PREPARAR.', 'Prueba de integración. No preparar ni despachar.', true),
    ('2026-10-15 18:36:00-05'::timestamptz, 'NEGOCIO PRUEBA CODEX', 'NEGOCIO PRUEBA CODEX', '+573001110002', 'TEST-20261015', 'Dirección de prueba, Bogotá', 'Centro Histórico (Zona Centro)', 'Factura Normal', 'PRUEBA AUTOMATIZADA - 5 kg pechuga. NO PREPARAR.', 'Pedido de prueba de integración. No preparar ni despachar.', true),
    ('2026-10-15 18:22:00-05'::timestamptz, 'prueba', 'prueba', '+573000000000', '1000000000', 'cra 00 prueba', 'Centro Histórico (Zona Centro)', 'Factura Electrónica', '1 lb carne tajada', 'Registro de prueba del formulario.', true)
), normalized as (
  select
    r.*,
    'business:' || regexp_replace(lower(btrim(r.business_name)), '\s+', ' ', 'g') as identity_key,
    'highlevel-recovery:' || to_char(r.received_at at time zone 'America/Bogota', 'YYYYMMDDHH24MI') || ':' ||
      regexp_replace(lower(r.business_name), '[^a-z0-9]+', '-', 'g') as recovery_reference
  from recovered r
)
insert into public.orders (
  customer_type, customer_id, route_id, source, source_reference, source_payload,
  status, fulfillment_type, delivery_address, subtotal, notes, received_at, created_at
)
select
  'wholesale', c.id, routes.id, 'form', r.recovery_reference,
  jsonb_build_object(
    'source', 'form',
    'source_reference', r.recovery_reference,
    'customer_type', 'wholesale',
    'customer', jsonb_build_object(
      'name', r.customer_name,
      'business_name', r.business_name,
      'phone', r.phone,
      'tax_id', r.tax_id,
      'address', r.address
    ),
    'route', r.legacy_zone,
    'form_data', jsonb_build_object(
      'form', 'nuevo-mayorista',
      'order_text', r.order_text,
      'tax_id', r.tax_id,
      'billing', r.billing,
      'original_payload', jsonb_build_object('recovered_from_highlevel', true, 'submitted_at', r.received_at)
    )
  ),
  case when r.is_test then 'cancelled' else 'received' end,
  'delivery', r.address, 0,
  coalesce(r.observations, 'Recuperado del historial de envios de HighLevel.'),
  r.received_at, r.received_at
from normalized r
join public.customers c
  on c.customer_type = 'wholesale' and c.identity_key = r.identity_key
cross join lateral (
  select id from public.routes where name = 'Sin clasificar' limit 1
) routes
where not exists (
  select 1
  from public.orders existing
  where existing.customer_type = 'wholesale'
    and existing.source = 'form'
    and abs(extract(epoch from (existing.received_at - r.received_at))) < 90
    and lower(coalesce(
      nullif(existing.source_payload #>> '{customer,business_name}', ''),
      nullif(existing.source_payload #>> '{customer,name}', '')
    )) = lower(r.business_name)
)
on conflict (source, source_reference) where source_reference is not null do nothing;
