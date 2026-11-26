do $$
declare
  v_original_customer_id bigint := 209;
  v_holman_customer_id bigint;
  v_unassigned_route_id bigint;
begin
  select id into v_unassigned_route_id
  from public.routes
  where name = 'Sin clasificar';

  update public.customers
  set
    business_name = 'Tienda La Fe · Stiven',
    identity_key = 'business:tienda la fe|phone:573173737077',
    ghl_contact_id = 'THk9IK454Nrkc6nT8tVb',
    updated_at = now()
  where id = v_original_customer_id;

  insert into public.customers (
    customer_type,
    identity_key,
    name,
    business_name,
    phone,
    email,
    address,
    city,
    route_id,
    is_active,
    wholesale_registered_at,
    registration_source,
    registration_metadata,
    ghl_contact_id,
    ghl_sync_status
  ) values (
    'wholesale',
    'business:tienda la fe|phone:573150285755',
    'Holman García Cepeda',
    'Tienda La Fe · Holman',
    '+573150285755',
    'garciacepedaholman@gmail.com',
    'Carrera 8E #55A-07',
    'Barranquilla',
    v_unassigned_route_id,
    true,
    '2026-10-30T02:35:55.460Z'::timestamptz,
    'ghl_wholesale_form',
    jsonb_build_object('split_from_customer_id', v_original_customer_id, 'indicator', 'Holman'),
    'lrL8vg0syIF2TbP7VYqB',
    'synced'
  )
  returning id into v_holman_customer_id;

  update public.orders
  set customer_id = v_holman_customer_id, updated_at = now()
  where customer_id = v_original_customer_id
    and source_payload #>> '{form_data,contact_id}' = 'lrL8vg0syIF2TbP7VYqB';
end $$;
