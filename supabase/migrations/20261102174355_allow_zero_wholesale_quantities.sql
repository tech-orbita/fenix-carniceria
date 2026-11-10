-- Los mayoristas habituales pueden pedir un corte sin indicar cantidad ("lo
-- que salga"). La planilla lo conserva como 0 hasta que el equipo define el
-- despacho. Las API de la aplicación solo aceptan cero para Mayoristas.
alter table public.order_items
  drop constraint if exists order_items_quantity_check,
  add constraint order_items_quantity_check check (quantity >= 0),
  drop constraint if exists order_items_actual_quantity_check,
  add constraint order_items_actual_quantity_check check (actual_quantity is null or actual_quantity >= 0);
