-- Nelson opera únicamente los pedidos mayoristas. La cartera permanece
-- reservada a role = admin en la aplicación y en sus acciones de servidor.
update public.panel_users as panel_user
set role = 'operator', customer_type = 'wholesale'
from auth.users as auth_user
where panel_user.user_id = auth_user.id
  and lower(auth_user.email) = 'nelsonalbeiroricodiaz@gmail.com';
