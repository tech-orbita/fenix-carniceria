begin;

-- Consolidate the six active wholesale pairs that share the same normalized
-- identification. The source row is retained as an inactive recovery record.
with merge_map(source_id, target_id) as (
  values
    (331::bigint, 305::bigint),
    (302::bigint, 218::bigint),
    (338::bigint, 293::bigint),
    (442::bigint, 232::bigint),
    (238::bigint, 236::bigint),
    (291::bigint, 332::bigint)
)
update customers as target
set
  name = coalesce(nullif(target.name, ''), source.name),
  business_name = coalesce(nullif(target.business_name, ''), source.business_name),
  tax_id = coalesce(nullif(target.tax_id, ''), source.tax_id),
  phone = coalesce(nullif(target.phone, ''), source.phone),
  receiver_name = coalesce(nullif(target.receiver_name, ''), source.receiver_name),
  receiver_phone = coalesce(nullif(target.receiver_phone, ''), source.receiver_phone),
  email = coalesce(nullif(target.email, ''), source.email),
  address = case
    when target.id in (218, 293) then coalesce(nullif(source.address, ''), target.address)
    else coalesce(nullif(target.address, ''), source.address)
  end,
  neighborhood = coalesce(nullif(target.neighborhood, ''), source.neighborhood),
  city = coalesce(nullif(target.city, ''), source.city),
  route_id = case
    when target.route_id is not null and target.route_id <> 6 then target.route_id
    when source.route_id is not null and source.route_id <> 6 then source.route_id
    else coalesce(target.route_id, source.route_id)
  end,
  billing_address = coalesce(nullif(target.billing_address, ''), source.billing_address),
  requires_e_invoice = coalesce(target.requires_e_invoice, false) or coalesce(source.requires_e_invoice, false),
  wholesale_registered_at = coalesce(target.wholesale_registered_at, source.wholesale_registered_at),
  registration_source = coalesce(nullif(target.registration_source, ''), source.registration_source),
  registration_metadata = coalesce(source.registration_metadata, '{}'::jsonb)
    || coalesce(target.registration_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'merged_customer_ids', jsonb_build_array(source.id),
      'merged_business_aliases', jsonb_build_array(coalesce(source.business_name, source.name)),
      'merged_at', now()
    ),
  ghl_contact_id = coalesce(nullif(target.ghl_contact_id, ''), source.ghl_contact_id),
  ghl_sync_status = coalesce(nullif(target.ghl_sync_status, ''), source.ghl_sync_status),
  ghl_sync_error = coalesce(nullif(target.ghl_sync_error, ''), source.ghl_sync_error),
  updated_at = now()
from merge_map
join customers as source on source.id = merge_map.source_id
where target.id = merge_map.target_id
  and target.customer_type = 'wholesale'
  and source.customer_type = 'wholesale';

-- Move every order to the surviving customer. Only replace an unclassified
-- order route; an explicitly classified historical route remains untouched.
with merge_map(source_id, target_id) as (
  values
    (331::bigint, 305::bigint),
    (302::bigint, 218::bigint),
    (338::bigint, 293::bigint),
    (442::bigint, 232::bigint),
    (238::bigint, 236::bigint),
    (291::bigint, 332::bigint)
)
update orders as order_row
set
  customer_id = merge_map.target_id,
  route_id = case
    when order_row.route_id is null or order_row.route_id = 6 then target.route_id
    else order_row.route_id
  end
from merge_map
join customers as target on target.id = merge_map.target_id
where order_row.customer_id = merge_map.source_id;

-- Keep the merged rows recoverable, but remove them from active directories.
with merge_map(source_id, target_id) as (
  values
    (331::bigint, 305::bigint),
    (302::bigint, 218::bigint),
    (338::bigint, 293::bigint),
    (442::bigint, 232::bigint),
    (238::bigint, 236::bigint),
    (291::bigint, 332::bigint)
)
update customers as source
set
  is_active = false,
  route_id = target.route_id,
  registration_metadata = coalesce(source.registration_metadata, '{}'::jsonb)
    || jsonb_build_object('merged_into_customer_id', target.id, 'merged_at', now()),
  updated_at = now()
from merge_map
join customers as target on target.id = merge_map.target_id
where source.id = merge_map.source_id;

commit;
