-- VigíaAI · Fase 9a — Cuentas, granjas y suscripción
--
-- Roles:
--   admin      ve y gestiona todo: clientes, instaladores y pagos.
--   installer  crea clientes con su granja y ve las granjas que instaló.
--   client     dueño de la granja: ve y configura solo lo suyo, y solo con la suscripción al día.
--
-- Inicio de sesión: la cédula es el usuario. Supabase Auth trabaja con correo, así que cada usuario
-- tiene un alias interno "<cédula>@vigia.local" que nadie ve (el correo real va en profiles.email).
-- Los usuarios los crea la Edge Function `manage-users`; el registro público está desactivado.

create type public.app_role as enum ('admin', 'installer', 'client');

-- Fecha de hoy en Colombia: las suscripciones vencen a medianoche local, no en UTC.
create function public.bogota_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Perfiles -------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  full_name text not null check (char_length(btrim(full_name)) between 3 and 120),
  national_id text not null unique check (national_id ~ '^[0-9]{6,10}$'),
  phone text check (phone is null or phone ~ '^[0-9]{7,15}$'),
  email text check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  municipality text check (municipality is null or char_length(municipality) <= 80),
  must_change_password boolean not null default true,
  paid_until date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Usuarios de VigíaAI: administrador, instaladores y clientes (dueños de granja).';
comment on column public.profiles.national_id is 'Cédula: es el usuario para iniciar sesión.';
comment on column public.profiles.must_change_password is 'La contraseña inicial es la cédula: se cambia en el primer ingreso.';
comment on column public.profiles.paid_until is 'Suscripción del cliente. Vencida o vacía, la base de datos bloquea sus granjas.';
comment on column public.profiles.created_by is 'Instalador o administrador que creó la cuenta.';

create index profiles_created_by_idx on public.profiles (created_by);
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Granjas --------------------------------------------------------------------------------------

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  installer_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  place_name text not null,
  region text not null default '',
  district text,
  country text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  elevation double precision not null default 0,
  timezone text not null default 'America/Bogota',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.farms is 'Granjas de los clientes. La ubicación define el clima y el sol reales.';

create index farms_owner_id_idx on public.farms (owner_id);
create index farms_installer_id_idx on public.farms (installer_id);
create trigger farms_touch_updated_at before update on public.farms
  for each row execute function public.touch_updated_at();

-- Galpones -------------------------------------------------------------------------------------

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  species text not null default 'layingHens',
  population integer not null check (population between 1 and 200000),
  hatch_date date not null,
  lighting jsonb not null default '{"type": "natural"}'::jsonb
    check (lighting ->> 'type' in ('natural', 'extended')),
  thresholds jsonb not null check (
    jsonb_typeof(thresholds) = 'object'
    and thresholds ?& array[
      'ventilationOn', 'ventilationOff', 'tempWarning', 'tempCritical',
      'pumpOn', 'pumpOff', 'waterWarning', 'waterCritical',
      'feederOn', 'feederOff', 'feedWarning', 'feedCritical'
    ]
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.zones is 'Galpones de cada granja: lote de aves, programa de luz y umbrales de control.';
comment on column public.zones.hatch_date is 'Fecha de nacimiento del lote: define la edad y la curva de postura.';

create index zones_farm_id_idx on public.zones (farm_id);
create trigger zones_touch_updated_at before update on public.zones
  for each row execute function public.touch_updated_at();

-- Funciones de apoyo para las políticas ----------------------------------------------------------
-- security definer: leen el perfil del usuario actual sin pasar por RLS (evita recursión).

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  )
$$;

create function public.subscription_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and paid_until >= public.bogota_today()
  )
$$;

-- Permisos y reglas de acceso (RLS) --------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.zones enable row level security;

-- Sin sesión no se ve nada. Con sesión: leer lo que permitan las políticas y editar solo las
-- columnas de abajo. Rol, cédula, pagos y dueños cambian únicamente por funciones controladas.
revoke all on public.profiles, public.farms, public.zones from anon;
revoke insert, update, delete, truncate on public.profiles, public.farms, public.zones from authenticated;
grant select on public.profiles, public.farms, public.zones to authenticated;
grant update (full_name, phone, email, municipality) on public.profiles to authenticated;
grant update (name, place_name, region, district, country, latitude, longitude, elevation, timezone)
  on public.farms to authenticated;
grant update (name, population, hatch_date, lighting, thresholds) on public.zones to authenticated;

-- Perfiles: el propio, los clientes que creó el instalador y todos para el administrador.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or created_by = (select auth.uid())
    or (select public.is_admin())
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or created_by = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    id = (select auth.uid())
    or created_by = (select auth.uid())
    or (select public.is_admin())
  );

-- Granjas: el administrador todas; el instalador las que instaló; el dueño las suyas si está al día.
create policy farms_select on public.farms
  for select to authenticated
  using (
    (select public.is_admin())
    or installer_id = (select auth.uid())
    or (owner_id = (select auth.uid()) and (select public.subscription_active()))
  );

create policy farms_update on public.farms
  for update to authenticated
  using (
    (select public.is_admin())
    or installer_id = (select auth.uid())
    or (owner_id = (select auth.uid()) and (select public.subscription_active()))
  )
  with check (
    (select public.is_admin())
    or installer_id = (select auth.uid())
    or (owner_id = (select auth.uid()) and (select public.subscription_active()))
  );

-- Galpones: los de las granjas que el usuario puede ver (la consulta a farms aplica su RLS).
create policy zones_select on public.zones
  for select to authenticated
  using (exists (select 1 from public.farms f where f.id = farm_id));

create policy zones_update on public.zones
  for update to authenticated
  using (exists (select 1 from public.farms f where f.id = farm_id))
  with check (exists (select 1 from public.farms f where f.id = farm_id));

-- Funciones que llama la app ------------------------------------------------------------------------

-- El usuario confirma que ya cambió su contraseña inicial.
create function public.mark_password_changed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = (select auth.uid())
$$;

-- Administrador: hasta cuándo pagó un cliente. Una fecha pasada lo bloquea.
create function public.set_paid_until(p_client_id uuid, p_paid_until date)
returns date
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador registra pagos.' using errcode = '42501';
  end if;
  update public.profiles set paid_until = p_paid_until where id = p_client_id and role = 'client';
  if not found then
    raise exception 'Cliente no encontrado.' using errcode = 'P0002';
  end if;
  return p_paid_until;
end;
$$;

-- Contacto del instalador que creó la cuenta (lo muestra la pantalla de suscripción vencida).
create function public.my_installer_contact()
returns table (full_name text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select i.full_name, i.phone
  from public.profiles me
  join public.profiles i on i.id = me.created_by
  where me.id = (select auth.uid())
$$;

-- Crea el perfil del cliente, su granja y su primer galpón en una sola transacción.
-- Solo la llama la Edge Function `manage-users` (clave secreta) después de crear el usuario de Auth.
create function public.provision_client(
  p_user_id uuid,
  p_created_by uuid,
  p_profile jsonb,
  p_farm jsonb,
  p_zone jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_farm_id uuid;
begin
  insert into public.profiles (id, role, full_name, national_id, phone, email, municipality, created_by, paid_until)
  values (
    p_user_id,
    'client',
    btrim(p_profile ->> 'fullName'),
    p_profile ->> 'nationalId',
    nullif(p_profile ->> 'phone', ''),
    nullif(lower(p_profile ->> 'email'), ''),
    nullif(btrim(p_profile ->> 'municipality'), ''),
    p_created_by,
    public.bogota_today() + 30
  );

  insert into public.farms (
    owner_id, installer_id, name, place_name, region, district, country,
    latitude, longitude, elevation, timezone
  )
  values (
    p_user_id,
    p_created_by,
    btrim(p_farm ->> 'name'),
    p_farm ->> 'placeName',
    coalesce(p_farm ->> 'region', ''),
    nullif(p_farm ->> 'district', ''),
    coalesce(p_farm ->> 'country', ''),
    (p_farm ->> 'latitude')::double precision,
    (p_farm ->> 'longitude')::double precision,
    coalesce((p_farm ->> 'elevation')::double precision, 0),
    coalesce(p_farm ->> 'timezone', 'America/Bogota')
  )
  returning id into v_farm_id;

  insert into public.zones (farm_id, name, population, hatch_date, lighting, thresholds)
  values (
    v_farm_id,
    btrim(p_zone ->> 'name'),
    (p_zone ->> 'population')::integer,
    (p_zone ->> 'hatchDate')::date,
    coalesce(p_zone -> 'lighting', '{"type": "natural"}'::jsonb),
    p_zone -> 'thresholds'
  );

  return v_farm_id;
end;
$$;

-- Quién puede ejecutar cada función (Supabase da permiso a anon por defecto: se quita).
revoke execute on function
  public.bogota_today(),
  public.touch_updated_at(),
  public.is_admin(),
  public.subscription_active(),
  public.mark_password_changed(),
  public.set_paid_until(uuid, date),
  public.my_installer_contact(),
  public.provision_client(uuid, uuid, jsonb, jsonb, jsonb)
from public, anon;

revoke execute on function public.provision_client(uuid, uuid, jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.provision_client(uuid, uuid, jsonb, jsonb, jsonb) to service_role;

grant execute on function
  public.bogota_today(),
  public.is_admin(),
  public.subscription_active(),
  public.mark_password_changed(),
  public.set_paid_until(uuid, date),
  public.my_installer_contact()
to authenticated;
