-- Lista vigente recibida el 2 de noviembre de 2026. Conserva los precios
-- anteriores para auditoría y activa solamente los ocho productos modificados.
do $$
declare
  effective_at timestamptz := now();
  inserted_count integer;
begin
  update public.product_prices pp
  set valid_until = effective_at
  from public.products p
  where pp.product_id = p.id
    and pp.valid_until is null
    and (
      (pp.segment = 'mayorista' and p.catalog_key in (
        'cerdo:costilla de cerdo con piel',
        'cerdo:pulpa de cerdo criollo',
        'cerdo:pezuna de cerdo',
        'cerdo:chuleta de cerdo criollo'
      ))
      or
      (pp.segment = 'minorista' and p.catalog_key in (
        'cerdo:pulpa',
        'cerdo:costilla',
        'cerdo:chuleta',
        'cerdo:chicharron carnudo'
      ))
    );

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
    prices.segment,
    prices.unit,
    prices.amount,
    'COP',
    prices.source_file,
    prices.source_product_name,
    date '2026-11-02',
    effective_at,
    null
  from (values
    ('cerdo:costilla de cerdo con piel', 'mayorista', 'libra', 8000::numeric, '1793303840843_2A944A64837EAEC1CD1A.jpg', 'Costilla de cerdo con piel'),
    ('cerdo:costilla de cerdo con piel', 'mayorista', 'kilo', 16000::numeric, '1793303840843_2A944A64837EAEC1CD1A.jpg', 'Costilla de cerdo con piel'),
    ('cerdo:pulpa de cerdo criollo', 'mayorista', 'libra', 8500::numeric, '1793303840843_2A944A64837EAEC1CD1A.jpg', 'Pulpa de cerdo criollo'),
    ('cerdo:pulpa de cerdo criollo', 'mayorista', 'kilo', 17000::numeric, '1793303840843_2A944A64837EAEC1CD1A.jpg', 'Pulpa de cerdo criollo'),
    ('cerdo:pezuna de cerdo', 'mayorista', 'libra', 3000::numeric, '1793303840843_2A944A64837EAEC1CD1A.jpg', 'Pezuña de cerdo'),
    ('cerdo:pezuna de cerdo', 'mayorista', 'kilo', 6000::numeric, '1793303840843_2A944A64837EAEC1CD1A.jpg', 'Pezuña de cerdo'),
    ('cerdo:chuleta de cerdo criollo', 'mayorista', 'libra', 6000::numeric, '1793303840843_2A944A64837EAEC1CD1A.jpg', 'Chuleta de cerdo criollo'),
    ('cerdo:chuleta de cerdo criollo', 'mayorista', 'kilo', 12000::numeric, '1793303840843_2A944A64837EAEC1CD1A.jpg', 'Chuleta de cerdo criollo'),
    ('cerdo:pulpa', 'minorista', 'libra', 10000::numeric, '1793303841476_2A8C5CCC7E328B9227F6.jpg', 'Pulpa'),
    ('cerdo:pulpa', 'minorista', 'kilo', 20000::numeric, '1793303841476_2A8C5CCC7E328B9227F6.jpg', 'Pulpa'),
    ('cerdo:costilla', 'minorista', 'libra', 9000::numeric, '1793303841476_2A8C5CCC7E328B9227F6.jpg', 'Costilla'),
    ('cerdo:costilla', 'minorista', 'kilo', 18000::numeric, '1793303841476_2A8C5CCC7E328B9227F6.jpg', 'Costilla'),
    ('cerdo:chuleta', 'minorista', 'libra', 6500::numeric, '1793303841476_2A8C5CCC7E328B9227F6.jpg', 'Chuleta'),
    ('cerdo:chuleta', 'minorista', 'kilo', 13000::numeric, '1793303841476_2A8C5CCC7E328B9227F6.jpg', 'Chuleta'),
    ('cerdo:chicharron carnudo', 'minorista', 'libra', 6000::numeric, '1793303841476_2A8C5CCC7E328B9227F6.jpg', 'Chicharrón carnudo (papada)'),
    ('cerdo:chicharron carnudo', 'minorista', 'kilo', 12000::numeric, '1793303841476_2A8C5CCC7E328B9227F6.jpg', 'Chicharrón carnudo (papada)')
  ) as prices(catalog_key, segment, unit, amount, source_file, source_product_name)
  join public.products p on p.catalog_key = prices.catalog_key;

  get diagnostics inserted_count = row_count;
  if inserted_count <> 16 then
    raise exception 'Se esperaban 16 precios nuevos y se insertaron %', inserted_count;
  end if;
end
$$;
