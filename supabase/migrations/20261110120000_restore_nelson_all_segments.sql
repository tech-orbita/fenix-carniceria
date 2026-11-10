-- Nelson opera pedidos mayoristas y minoristas, pero sigue siendo operador.
-- La cartera mayorista y sus comprobantes permanecen reservados a administradores.
update public.panel_users as panel_user
set role = 'operator', customer_type = null
from auth.users as auth_user
where panel_user.user_id = auth_user.id
  and lower(auth_user.email) = 'nelsonalbeiroricodiaz@gmail.com';
