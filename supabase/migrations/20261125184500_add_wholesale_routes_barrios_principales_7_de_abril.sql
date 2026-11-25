insert into public.routes (name, sort_order, is_active)
values
  ('Barrios principales', 80, true),
  ('7 de Abril', 90, true)
on conflict (name) do update
set
  sort_order = excluded.sort_order,
  is_active = true;
