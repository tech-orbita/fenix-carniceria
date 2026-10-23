-- The same trigger function runs on orders, customers, and order_items.
-- Reading OLD.customer_type directly makes PostgreSQL resolve that field
-- against order_items too, where it does not exist. Normalize the active row
-- to JSONB first so table-specific fields are accessed safely.
create or replace function private.broadcast_order_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb;
  target text;
  previous_target text;
begin
  row_data := case
    when tg_op = 'DELETE' then to_jsonb(old)
    else to_jsonb(new)
  end;

  if tg_table_name = 'order_items' then
    select customer_type into target
    from public.orders
    where id = (row_data ->> 'order_id')::bigint;
  else
    target := row_data ->> 'customer_type';
  end if;

  perform private.broadcast_order_change(target, tg_table_name, tg_op);

  -- If an order or customer changes segment, notify the previous segment too.
  if tg_op = 'UPDATE' and tg_table_name <> 'order_items' then
    previous_target := to_jsonb(old) ->> 'customer_type';
    if previous_target is distinct from target then
      perform private.broadcast_order_change(previous_target, tg_table_name, tg_op);
    end if;
  end if;

  return null;
end;
$$;
