-- La lista mayorista vigente también ofrece pescado, butifarra y chorizo.
do $$
declare
  effective_at timestamptz := now();
  inserted_count integer;
begin
  insert into public.product_prices (
    product_id,
    segment,
    unit,
    amount,
    currency,
    source_file,
    source_product_name,
    source_date,
    valid_from,
    valid_until
  )
  select
    p.id,
    'mayorista',
    prices.unit,
    prices.amount,
    'COP',
    '1793303840843_2A944A64837EAEC1CD1A.jpg',
    prices.source_product_name,
    date '2026-11-02',
    effective_at,
    null
  from (values
    ('pescado:bassa', 'libra', 10200::numeric, 'Bassa'),
    ('pescado:bassa', 'kilo', 20400::numeric, 'Bassa'),
    ('pescado:bassa selecta', 'libra', 11200::numeric, 'Bassa selecta'),
    ('pescado:bassa selecta', 'kilo', 22400::numeric, 'Bassa selecta'),
    ('otros:butifarra', 'libra', 4500::numeric, 'Butifarra'),
    ('otros:butifarra', 'kilo', 9000::numeric, 'Butifarra'),
    ('otros:chorizo', 'libra', 4500::numeric, 'Chorizo'),
    ('otros:chorizo', 'kilo', 9000::numeric, 'Chorizo')
  ) as prices(catalog_key, unit, amount, source_product_name)
  join public.products p on p.catalog_key = prices.catalog_key
  where not exists (
    select 1
    from public.product_prices active
    where active.product_id = p.id
      and active.segment = 'mayorista'
      and active.unit = prices.unit
      and active.valid_until is null
  );

  get diagnostics inserted_count = row_count;
  if inserted_count <> 8 then
    raise exception 'Se esperaban 8 precios mayoristas nuevos y se insertaron %', inserted_count;
  end if;
end
$$;
