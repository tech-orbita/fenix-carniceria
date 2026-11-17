alter table public.order_items
  add column if not exists is_prepared boolean not null default false;

comment on column public.order_items.is_prepared is
  'Indica que el producto ya fue alistado dentro del pedido mayorista.';

-- Los formularios originales ya contienen una línea por producto. Se reemplazan
-- únicamente estos dos pedidos del despacho del 18 de noviembre de 2026 para
-- unir cantidad de porciones y gramaje en el mismo renglón.
delete from public.order_items
where order_id in (
  select id
  from public.orders
  where order_number in ('FEN-000086', 'FEN-000087')
    and customer_type = 'wholesale'
    and received_at >= timestamptz '2026-11-17 00:00:00-05'
    and received_at < timestamptz '2026-11-18 00:00:00-05'
);

insert into public.order_items (
  order_id, product_name, quantity, unit, preparation, notes, unit_price, sort_order
)
select o.id, v.product_name, v.quantity, v.unit, v.preparation, v.notes, 0, v.sort_order
from public.orders o
join (values
  ('FEN-000086', 'Lomo fino',       21::numeric, 'lb',        'Entero',                                      '21 LIBRA DE LOMO FINO ENTERO', 0),
  ('FEN-000086', 'Punta gorda',     10::numeric, 'porciones', '350 GR SABANA QUE ESTE BIEN BONITA Y BLANDA', '10 PORCIONES DE PUNTA GORDA 350 GR SABANA QUE ESTE BIEN BONITA Y BLANDA', 1),
  ('FEN-000086', 'Churrasco',       10::numeric, 'porciones', '350 GR MARIPOSA SIN RELAJAR',                 '10 PORCIONES DE CHURRASCO 350 GR MARIPOSA SIN RELAJAR', 2),
  ('FEN-000086', 'Pulpa cerdo',     10::numeric, 'porciones', '120 GR SABANA',                               '10 PORCIONES PULPA DE CERDO 120 GR SABANA', 3),
  ('FEN-000086', 'Blanda',          10::numeric, 'porciones', '120 GR SABANA',                               '10 PORCIONES CARNE BLANDA 120 GR SABANA', 4),
  ('FEN-000087', 'Comodín',          8::numeric, 'lb',        'Morro',                                       '8 LIBRAS DE MORRO', 0),
  ('FEN-000087', 'Espaldilla',       8::numeric, 'lb',        null,                                          '8 LIBRAS DE ESPALDILLA', 1),
  ('FEN-000087', 'Molida especial',  8::numeric, 'lb',        null,                                          '8 LIBRAS DE CARNE MOLIDA', 2),
  ('FEN-000087', 'Panza',            6::numeric, 'lb',        'Picada',                                      '6 LIBRAS DE PANZA PICADA', 3),
  ('FEN-000087', 'Lenguas',          3::numeric, 'cantidad',  null,                                          '3 LENGUAS', 4),
  ('FEN-000087', 'Pata',             3::numeric, 'cantidad',  null,                                          '3 PATAS DE RES', 5),
  ('FEN-000087', 'Blanda',          30::numeric, 'porciones', '120 GR SABANA',                               '30 PORCIONES DE CARNE BLANDA 120 GR SABANA', 6),
  ('FEN-000087', 'Pulpa cerdo',     20::numeric, 'porciones', '120 GR SABANA',                               '20 PORCIONES PULPA DE CERDO 120 GR SABANA', 7),
  ('FEN-000087', 'Hígado',           3::numeric, 'lb',        'R',                                           '3 LIBRAS DE HIGADO RELAJADO', 8),
  ('FEN-000087', 'Churrasco',        4::numeric, 'porciones', '350 GR MARIPOSA SIN RELAJAR',                 '4 PORCIONES CHURRASCO 350 GR MARIPOSA SIN RELAJAR', 9),
  ('FEN-000087', 'Punta gorda',      3::numeric, 'porciones', '350 GR SABANA QUE ESTE BLANDA',               '3 PORCIONES PUNTA GORDA 350 GR SABANA QUE ESTE BLANDA', 10),
  ('FEN-000087', 'Hueso',           10::numeric, 'lb',        'Bien picada',                                 '10 LIBRAS DE HUESO BIEN PICADA', 11),
  ('FEN-000087', 'Chuleto',         10::numeric, 'porciones', '130 GR',                                      '10 PORCIONES DE CHULETO 130 GR', 12)
) as v(order_number, product_name, quantity, unit, preparation, notes, sort_order)
  on v.order_number = o.order_number
where o.customer_type = 'wholesale'
  and o.received_at >= timestamptz '2026-11-17 00:00:00-05'
  and o.received_at < timestamptz '2026-11-18 00:00:00-05';
