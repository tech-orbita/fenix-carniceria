-- Avisa al panel por Supabase Realtime (Broadcast) cada vez que cambian los pedidos.
-- Cada segmento tiene su canal privado (orders:retail / orders:wholesale) y RLS sobre
-- realtime.messages decide quién puede escucharlo. El mensaje no lleva datos: el panel
-- solo vuelve a pedir la información al servidor.
create function private.broadcast_order_change(target_customer_type text, source_table text, operation text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_customer_type is null then
    return;
  end if;
  perform realtime.send(
    jsonb_build_object('table', source_table, 'operation', operation),
    'changed',
    'orders:' || target_customer_type,
    true
  );
end;
$$;

create function private.broadcast_order_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text;
begin
  if tg_table_name = 'order_items' then
    select customer_type into target
    from public.orders
    where id = coalesce(new.order_id, old.order_id);
  else
    target := coalesce(new.customer_type, old.customer_type);
  end if;

  perform private.broadcast_order_change(target, tg_table_name, tg_op);
  -- Si un pedido o cliente cambia de segmento, avisa también al segmento anterior.
  if tg_op = 'UPDATE' and tg_table_name <> 'order_items' and old.customer_type is distinct from new.customer_type then
    perform private.broadcast_order_change(old.customer_type, tg_table_name, tg_op);
  end if;
  return null;
end;
$$;

revoke all on function private.broadcast_order_change(text, text, text) from public, anon, authenticated;
revoke all on function private.broadcast_order_row_change() from public, anon, authenticated;

create trigger orders_broadcast_change
after insert or update or delete on public.orders
for each row execute function private.broadcast_order_row_change();

create trigger order_items_broadcast_change
after insert or update or delete on public.order_items
for each row execute function private.broadcast_order_row_change();

create trigger customers_broadcast_change
after insert or update or delete on public.customers
for each row execute function private.broadcast_order_row_change();

create policy "Panel users receive changes of their segment"
on realtime.messages for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (select realtime.topic()) in ('orders:retail', 'orders:wholesale')
  and private.can_access_customer_type(split_part((select realtime.topic()), ':', 2))
);
