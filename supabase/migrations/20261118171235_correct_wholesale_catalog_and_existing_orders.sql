-- Corrige los pedidos ya visibles en el panel. Las reglas del parser viven en
-- la aplicación; esta migración conserva los datos históricos en las mismas
-- columnas operativas que usarán los pedidos nuevos.

update public.order_items oi
set product_name = 'Chuleta ahumada',
    preparation = null
from public.orders o
where oi.order_id = o.id
  and o.customer_type = 'wholesale'
  and oi.product_name = 'Chuleta'
  and (
    lower(coalesce(oi.preparation, '')) = 'ahumada'
    or (
      o.order_number = 'FEN-000094'
      and oi.sort_order = 11
      and lower(coalesce(o.source_payload #>> '{form_data,order_text}', '')) like '%chuleta ahumada%'
    )
  );

update public.order_items oi
set product_name = 'Costillita'
from public.orders o
where oi.order_id = o.id
  and o.customer_type = 'wholesale'
  and o.order_number = 'FEN-000094'
  and oi.sort_order = 12
  and oi.product_name = 'Costilla'
  and lower(coalesce(o.source_payload #>> '{form_data,order_text}', '')) like '%costillita%';

update public.order_items
set product_name = 'Costillita de cerdo',
    preparation = case when lower(coalesce(preparation, '')) = 'de cerdo' then null else preparation end
where product_name = 'Costilla cerdo'
   or (product_name = 'Costillita' and lower(coalesce(preparation, '')) = 'de cerdo');

update public.order_items oi
set product_name = 'Hueso de cerdo'
from public.orders o
where oi.order_id = o.id
  and o.customer_type = 'wholesale'
  and o.order_number = 'FEN-000094'
  and oi.sort_order = 17
  and oi.product_name = 'Hueso'
  and lower(coalesce(o.source_payload #>> '{form_data,order_text}', '')) like '%hueso de cerdo%';
