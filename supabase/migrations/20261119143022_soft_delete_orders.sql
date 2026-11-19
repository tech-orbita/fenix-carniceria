alter table public.orders
  add column if not exists deleted_at timestamptz;

comment on column public.orders.deleted_at is
  'Marca un pedido eliminado por el usuario sin destruirlo, para permitir su restauración desde el panel.';

create index if not exists orders_customer_type_deleted_received_idx
  on public.orders (customer_type, deleted_at, received_at desc);
