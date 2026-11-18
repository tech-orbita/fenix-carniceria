-- La separación de tipos de hueso aplica a pedidos nuevos. Restaura los
-- renglones históricos que ya habían sido despachados antes de esa regla.
with originals(order_number, sort_order, product_name, preparation) as (
  values
    ('FEN-000044', 4,  'Hueso', null::text),
    ('FEN-000051', 11, 'Hueso', 'Carnudo'),
    ('FEN-000055', 4,  'Hueso', 'Carnudo'),
    ('FEN-000061', 8,  'Hueso', null::text),
    ('FEN-000066', 1,  'Hueso', null::text),
    ('FEN-000091', 1,  'Hueso', null::text),
    ('FEN-000094', 3,  'Hueso', null::text),
    ('FEN-000098', 1,  'Hueso', null::text),
    ('FEN-000098', 2,  'Hueso', null::text),
    ('FEN-000107', 8,  'Hueso', null::text),
    ('FEN-000107', 9,  'Hueso', null::text),
    ('FEN-000107', 16, 'Hueso', null::text)
)
update public.order_items oi
set product_name = originals.product_name,
    preparation = originals.preparation
from public.orders o, originals
where oi.order_id = o.id
  and o.order_number = originals.order_number
  and oi.sort_order = originals.sort_order;

with original_rows(sort_order) as (
  values (11), (13), (15), (17)
)
update public.order_items oi
set product_name = 'Comodín',
    unit = 'cantidad',
    preparation = 'Lb'
from public.orders o, original_rows
where oi.order_id = o.id
  and o.order_number = 'FEN-000107'
  and oi.sort_order = original_rows.sort_order;
