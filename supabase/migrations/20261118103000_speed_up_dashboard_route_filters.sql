-- Acelera la carga paginada del panel y los filtros por ruta sin cambiar
-- la estructura ni el comportamiento de los pedidos existentes.
create index if not exists orders_customer_type_received_at_idx
  on public.orders (customer_type, received_at desc);

create index if not exists orders_customer_type_route_received_at_idx
  on public.orders (customer_type, route_id, received_at desc);

-- La asignación de rutas actualiza los pedidos abiertos de cada cliente.
create index if not exists orders_wholesale_customer_status_idx
  on public.orders (customer_id, status)
  where customer_type = 'wholesale';
