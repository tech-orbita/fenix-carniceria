-- La nota de voz del 10 de noviembre correspondía a una compra nueva, no a un
-- anexo del pedido del día anterior. La migración es idempotente y conserva el
-- cliente, la conversación y los productos originales de cada compra.
do $$
declare
  previous_order public.orders%rowtype;
  new_order_id bigint;
  voice_event text;
begin
  select * into previous_order
  from public.orders
  where order_number = 'FEN-000076'
  for update;

  if previous_order.id is null then
    return;
  end if;

  voice_event := previous_order.source_payload ->> 'sourceEventId';
  if voice_event is null or exists (
    select 1 from public.orders where source_reference = 'ghl:retail:' || voice_event
  ) then
    return;
  end if;

  insert into public.orders (
    customer_type, customer_id, route_id, source, source_reference,
    source_payload, extraction_confidence, status, fulfillment_type,
    requested_delivery_at, delivery_address, delivery_notes, payment_method,
    payment_status, subtotal, delivery_fee, adjustments, notes, received_at
  ) values (
    previous_order.customer_type,
    previous_order.customer_id,
    previous_order.route_id,
    previous_order.source,
    'ghl:retail:' || voice_event,
    previous_order.source_payload || jsonb_build_object(
      'orderAction', 'new',
      'rawOrderText', E'3 libras de muslos\n10 mil de carne para desmechar\n1 libra de chuletas ahumadas\n15 mil de lomo ancho relajado en mariposas',
      'orderWindowStart', '2026-11-10T05:00:00.000Z'
    ),
    previous_order.extraction_confidence,
    'received',
    previous_order.fulfillment_type,
    previous_order.requested_delivery_at,
    previous_order.delivery_address,
    previous_order.delivery_notes,
    previous_order.payment_method,
    'pending',
    42015,
    0,
    0,
    previous_order.notes,
    (previous_order.source_payload ->> 'contextUntil')::timestamptz
  ) returning id into new_order_id;

  update public.order_items
  set order_id = new_order_id,
      sort_order = sort_order - 8
  where order_id = previous_order.id
    and sort_order >= 8;

  update public.orders
  set subtotal = 173000,
      source_payload = source_payload || jsonb_build_object(
        'orderAction', 'new',
        'sourceEventId', replace(previous_order.source_reference, 'ghl:retail:', ''),
        'contextUntil', to_char(previous_order.received_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'rawOrderText', E'1 lengua\n3 libras de lomo ancho relajado\n3 libras de atravesado en posticas\n3 libras de espaldilla gruesa\n1 libra de hígado\n1 libra de corazón\n2 libras de lomo ancho relajado\n2 libras de huesos carnudo',
        'orderWindowStart', '2026-11-09T05:00:00.000Z'
      )
  where id = previous_order.id;
end
$$;
