-- El formulario de inscripción reutiliza customers para que el panel, los pedidos
-- y HighLevel compartan una sola identidad. Solo los registros enviados desde el
-- formulario participan en la unicidad por correo; así no bloqueamos la migración
-- por datos históricos que todavía no han sido confirmados por el cliente.
alter table public.customers
  add column wholesale_registered_at timestamptz,
  add column registration_source text,
  add column registration_metadata jsonb not null default '{}'::jsonb,
  add column ghl_contact_id text,
  add column ghl_sync_status text check (ghl_sync_status in ('pending', 'synced', 'error')),
  add column ghl_sync_error text;

create unique index customers_wholesale_registration_email_uidx
  on public.customers (lower(email))
  where customer_type = 'wholesale'
    and wholesale_registered_at is not null
    and email is not null;

create unique index customers_ghl_contact_id_uidx
  on public.customers (ghl_contact_id)
  where ghl_contact_id is not null;

create index customers_wholesale_registered_at_idx
  on public.customers (wholesale_registered_at desc)
  where customer_type = 'wholesale' and wholesale_registered_at is not null;

comment on column public.customers.wholesale_registered_at is
  'Última confirmación del cliente mediante el formulario público de inscripción mayorista.';
comment on column public.customers.ghl_sync_status is
  'Estado del upsert y etiquetado del contacto correspondiente en HighLevel.';
