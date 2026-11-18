-- Separa los tipos de hueso que el parser anterior guardó en la columna
-- genérica. Se usan número de pedido y posición, no ids generados.
with corrections(order_number, sort_order, product_name) as (
  values
    ('FEN-000044', 4,  'Hueso especial'),
    ('FEN-000051', 11, 'Hueso carnudo'),
    ('FEN-000055', 4,  'Hueso carnudo'),
    ('FEN-000061', 8,  'Hueso negro'),
    ('FEN-000066', 1,  'Hueso carnudo'),
    ('FEN-000091', 1,  'Hueso carnudo'),
    ('FEN-000094', 3,  'Hueso carnudo'),
    ('FEN-000098', 1,  'Hueso negro'),
    ('FEN-000098', 2,  'Hueso especial'),
    ('FEN-000107', 8,  'Hueso negro'),
    ('FEN-000107', 9,  'Hueso negro'),
    ('FEN-000107', 16, 'Hueso paleta')
)
update public.order_items oi
set product_name = corrections.product_name,
    preparation = case
      when lower(coalesce(oi.preparation, '')) in ('carnudo', 'negro', 'especial', 'paletero') then null
      else oi.preparation
    end
from public.orders o, corrections
where oi.order_id = o.id
  and o.order_number = corrections.order_number
  and oi.sort_order = corrections.sort_order
  and oi.product_name = 'Hueso';

-- Este formulario antiguo llegó como "producto: cantidad" y dejó la
-- cantidad en el renglón Comodín siguiente. Renombrarlo permite que el panel
-- la agregue a la columna correcta sin borrar el registro original.
with corrections(sort_order, product_name) as (
  values
    (11, 'Hueso blanco'),
    (13, 'Hueso pollo'),
    (15, 'Hueso pollo'),
    (17, 'Hueso paleta')
)
update public.order_items oi
set product_name = corrections.product_name,
    unit = 'lb',
    preparation = null
from public.orders o, corrections
where oi.order_id = o.id
  and o.order_number = 'FEN-000107'
  and oi.sort_order = corrections.sort_order
  and oi.product_name = 'Comodín'
  and lower(coalesce(oi.preparation, '')) = 'lb';
