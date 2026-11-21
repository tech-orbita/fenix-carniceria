-- Portal propio de pedidos mayoristas. Todo es aditivo para que los formularios
-- y workflows vigentes puedan seguir operando durante la transición.

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_type text not null check (form_type in ('wholesale_registration', 'wholesale_order')),
  source text not null default 'system' check (source in ('system', 'ghl', 'recovery')),
  idempotency_key uuid,
  customer_id bigint references public.customers (id) on delete set null,
  order_id bigint references public.orders (id) on delete set null,
  status text not null default 'received' check (
    status in ('received', 'processing', 'created', 'needs_review', 'failed')
  ),
  integration_status text not null default 'pending' check (
    integration_status in ('not_required', 'pending', 'sent', 'failed')
  ),
  payment_proof_status text not null default 'none' check (
    payment_proof_status in ('none', 'received', 'forwarded', 'failed')
  ),
  client_fingerprint text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  submitted_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index form_submissions_idempotency_uidx
  on public.form_submissions (form_type, idempotency_key)
  where idempotency_key is not null;
create index form_submissions_recent_idx
  on public.form_submissions (submitted_at desc);
create index form_submissions_customer_idx
  on public.form_submissions (customer_id, submitted_at desc);

create trigger form_submissions_set_updated_at
before update on public.form_submissions
for each row execute function public.set_updated_at();

create table public.integration_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index integration_outbox_pending_idx
  on public.integration_outbox (next_attempt_at, id)
  where status in ('pending', 'failed');

create table public.wholesale_portal_access_attempts (
  id bigint generated always as identity primary key,
  client_fingerprint text not null,
  succeeded boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index wholesale_portal_attempts_fingerprint_idx
  on public.wholesale_portal_access_attempts (client_fingerprint, attempted_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wholesale-payment-proofs',
  'wholesale-payment-proofs',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- La función permite que pedido, renglones, comprobante, auditoría y eventos
-- queden confirmados en una sola transacción. Solo la llave secreta del servidor
-- puede ejecutarla; nunca se expone al navegador.
create function public.create_wholesale_portal_order(
  p_submission_id uuid,
  p_customer_id bigint,
  p_source_reference text,
  p_source_payload jsonb,
  p_requested_delivery_at timestamptz,
  p_notes text,
  p_items jsonb,
  p_payment_storage_path text default null,
  p_payment_mime_type text default null
)
returns table (order_id bigint, order_number text, order_status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer public.customers%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_position integer := 0;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
    and customer_type = 'wholesale'
    and is_active = true
    and wholesale_registered_at is not null;

  if not found then
    raise exception 'Registered wholesale customer not found';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Order items must contain between 1 and 50 rows';
  end if;

  insert into public.orders (
    customer_type,
    customer_id,
    route_id,
    source,
    source_reference,
    source_payload,
    status,
    fulfillment_type,
    requested_delivery_at,
    delivery_address,
    payment_status,
    notes
  ) values (
    'wholesale',
    v_customer.id,
    v_customer.route_id,
    'form',
    p_source_reference,
    coalesce(p_source_payload, '{}'::jsonb),
    'received',
    'delivery',
    p_requested_delivery_at,
    v_customer.address,
    case when p_payment_storage_path is null then 'pending' else 'proof_received' end,
    nullif(trim(p_notes), '')
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(trim(v_item->>'product_name'), '') = ''
      or coalesce((v_item->>'quantity')::numeric, 0) <= 0
      or coalesce(trim(v_item->>'unit'), '') not in ('cantidad', 'kg', 'lb', 'und') then
      raise exception 'Invalid order item at row %', v_position + 1;
    end if;
    insert into public.order_items (
      order_id, product_name, quantity, unit, preparation, notes, unit_price, sort_order
    ) values (
      v_order.id,
      left(trim(v_item->>'product_name'), 160),
      (v_item->>'quantity')::numeric,
      trim(v_item->>'unit'),
      nullif(left(trim(v_item->>'preparation'), 250), ''),
      nullif(left(trim(v_item->>'notes'), 500), ''),
      0,
      v_position
    );
    v_position := v_position + 1;
  end loop;

  if p_payment_storage_path is not null then
    insert into public.order_attachments (order_id, kind, storage_path, mime_type)
    values (v_order.id, 'payment_proof', p_payment_storage_path, p_payment_mime_type);
  end if;

  update public.form_submissions
  set customer_id = v_customer.id,
      order_id = v_order.id,
      status = 'created',
      payment_proof_status = case when p_payment_storage_path is null then 'none' else 'received' end,
      integration_status = 'pending',
      completed_at = now(),
      error_message = null
  where id = p_submission_id;

  insert into public.integration_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'wholesale.order.created',
    'order',
    v_order.id::text,
    jsonb_build_object('order_id', v_order.id, 'submission_id', p_submission_id)
  );

  if p_payment_storage_path is not null then
    insert into public.integration_outbox (event_type, aggregate_type, aggregate_id, payload)
    values (
      'wholesale.payment_proof.received',
      'order',
      v_order.id::text,
      jsonb_build_object(
        'order_id', v_order.id,
        'submission_id', p_submission_id,
        'storage_path', p_payment_storage_path,
        'mime_type', p_payment_mime_type
      )
    );
  end if;

  return query select v_order.id, v_order.order_number, v_order.status;
end;
$$;

alter table public.form_submissions enable row level security;
alter table public.integration_outbox enable row level security;
alter table public.wholesale_portal_access_attempts enable row level security;

create policy "Administrators read form submissions"
on public.form_submissions for select
to authenticated
using (
  exists (
    select 1 from public.panel_users
    where panel_users.user_id = (select auth.uid())
      and panel_users.role = 'admin'
  )
);

revoke all on table public.form_submissions from anon, authenticated;
revoke all on table public.integration_outbox from anon, authenticated;
revoke all on table public.wholesale_portal_access_attempts from anon, authenticated;
grant select on table public.form_submissions to authenticated;

revoke all on function public.create_wholesale_portal_order(uuid, bigint, text, jsonb, timestamptz, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.create_wholesale_portal_order(uuid, bigint, text, jsonb, timestamptz, text, jsonb, text, text) to service_role;

comment on table public.form_submissions is
  'Auditoría de formularios propios: conserva envíos creados, fallidos y estado de integraciones.';
comment on table public.integration_outbox is
  'Eventos durables para sincronizar GHL, WhatsApp y otros servicios sin perder el pedido local.';
