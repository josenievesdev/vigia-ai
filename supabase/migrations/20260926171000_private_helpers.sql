-- Asesor de seguridad de Supabase: las funciones de apoyo de las políticas no deben poder
-- llamarse desde la API (/rest/v1/rpc). Se mueven a un esquema privado que la API no expone.
-- Las políticas siguen funcionando: guardan la referencia interna de la función, no su nombre.
--
-- Quedan en public, a propósito, las tres funciones que la app sí llama; cada una valida a quien
-- la llama: mark_password_changed (solo el propio perfil), set_paid_until (solo el administrador)
-- y my_installer_contact (solo el instalador del propio usuario).

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_admin() set schema private;
alter function public.subscription_active() set schema private;

-- set_paid_until llamaba a public.is_admin(): se actualiza al esquema nuevo (conserva sus permisos).
create or replace function public.set_paid_until(p_client_id uuid, p_paid_until date)
returns date
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Solo el administrador registra pagos.' using errcode = '42501';
  end if;
  update public.profiles set paid_until = p_paid_until where id = p_client_id and role = 'client';
  if not found then
    raise exception 'Cliente no encontrado.' using errcode = 'P0002';
  end if;
  return p_paid_until;
end;
$$;
